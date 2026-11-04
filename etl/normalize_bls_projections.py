"""Validate and join public BLS projections to O*NET's official SOC crosswalk.

The resulting values describe the broader U.S. SOC parent occupation, not an
independent projection for an O*NET subdivision and not AI-caused job loss.
No match is made to KSCO. Source extracts are never modified.
"""
import csv
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data' / 'bls-2025-2035'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def read_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def main():
    bls_path = DATA / 'official-table-extract.json'
    raw_percent_path = DATA / 'raw-percent-by-code.json'
    crosswalk_path = DATA / 'onet-soc-crosswalk.csv'
    occupation_path = ROOT / 'data/onet-31.0/occupation_data.json'
    exclusions_path = ROOT / 'data/translation/onet-31.0-exclusions.json'
    source = read_json(bls_path)
    if source['metadata']['baselineYear'] != 2025 or source['metadata']['horizonYear'] != 2035:
        raise ValueError('unexpected projection years')
    rows = source['rows']
    by_soc = {row['code']: row for row in rows}
    if len(rows) != 831 or len(by_soc) != len(rows):
        raise ValueError('unexpected BLS coverage or duplicate SOC codes')
    raw_percent = read_json(raw_percent_path)
    if set(raw_percent) != set(by_soc):
        raise ValueError('original percentage coverage mismatch')
    for code, value in by_soc.items():
        original = raw_percent[code]
        if original['sourceLine'] != value['sourceLine']:
            raise ValueError(f'original percentage line mismatch: {code}')
        text = original['changePercentRaw']
        parsed = None if text == '—' else float(text.replace(',', ''))
        if parsed != value['changePercent']:
            raise ValueError(f'original percentage value mismatch: {code}')
    with crosswalk_path.open(encoding='utf-8-sig', newline='') as f:
        entries = list(csv.DictReader(f))
    crosswalk = {entry['O*NET-SOC 2019 Code']: entry for entry in entries}
    if len(entries) != 1016 or len(crosswalk) != len(entries):
        raise ValueError('unexpected O*NET crosswalk coverage')
    jobs = read_json(occupation_path)['row']
    excluded = {entry['code'] for entry in read_json(exclusions_path)}
    if len(jobs) != 1016 or not excluded.issubset({j['onetsoc_code'] for j in jobs}):
        raise ValueError('unexpected occupations or exclusions')
    output = {}
    missing = []
    for job in jobs:
        code = job['onetsoc_code']
        mapping = crosswalk.get(code)
        if not mapping or job['title'] != mapping['O*NET-SOC 2019 Title']:
            raise ValueError(f'crosswalk identity mismatch: {code}')
        if code in excluded:
            continue
        parent_code = mapping['2018 SOC Code']
        value = by_soc.get(parent_code)
        if not value:
            missing.append(code)
            continue
        for field in ('employment2025Thousands','employment2035Thousands','changeThousands','changePercent'):
            v = value[field]
            if v is not None and (not isinstance(v, (int, float)) or not math.isfinite(v)):
                raise ValueError(f'invalid number {code} {field}')
        output[code] = {
            'socCode': parent_code,
            'socTitle': value['title'],
            'employment2025Thousands': value['employment2025Thousands'],
            'employment2035Thousands': value['employment2035Thousands'],
            'changeThousands': value['changeThousands'],
            'changePercent': value['changePercent'],
            'changePercentRaw': raw_percent[parent_code]['changePercentRaw'],
            'sourceLine': value['sourceLine'],
            'relation': 'official_crosswalk_soc_parent',
        }
    result = {
        'metadata': {
            'sourceUrl': source['metadata']['sourceUrl'],
            'crosswalkUrl': 'https://www.onetcenter.org/taxonomy/2019/soc.html',
            'crosswalkCsvUrl': 'https://www.onetcenter.org/taxonomy/2019/soc/2019_to_SOC_Crosswalk.csv?fmt=csv',
            'country': 'US', 'baselineYear': 2025, 'horizonYear': 2035,
            'sourceLastModified': source['metadata']['sourceLastModified'],
            'accessed': source['metadata']['accessed'],
            'blsSocRows': len(rows), 'activeOnet': len(jobs) - len(excluded),
            'matchedOnet': len(output), 'missingOnet': sorted(missing),
            'projectionsSha256': digest(bls_path), 'crosswalkSha256': digest(crosswalk_path),
            'rawPercentSha256': digest(raw_percent_path),
            'limitations': 'U.S. SOC parent-level employment projection; not AI-attributable or an independently estimated O*NET subdivision value.',
        },
        'occupations': dict(sorted(output.items())),
    }
    (DATA / 'normalized.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: result['metadata'][k] for k in ('blsSocRows','activeOnet','matchedOnet')}, ensure_ascii=False))

if __name__ == '__main__':
    main()

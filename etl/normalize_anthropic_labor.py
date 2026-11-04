"""Validate and normalize Anthropic's published SOC-level exposure data.

The observations describe measured Claude task coverage, not the probability
or timing of job displacement. This script does not map scores to O*NET
specialties or occupations in another classification system.
"""
from pathlib import Path
import csv
import hashlib
import json
import re
from decimal import Decimal, InvalidOperation

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/anthropic-labor-2026/job_exposure.csv'
DESTINATION = ROOT / 'data/anthropic-labor-2026/normalized.json'
EXPECTED_SHA256 = '4f0a3adf5feeb2ec5f5d02ab18cc5e851a2a4b8470bde84c0c9335017be12d68'
EXPECTED_FIELDS = ['occ_code', 'title', 'observed_exposure']


def main():
    source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    if source_hash != EXPECTED_SHA256:
        raise ValueError('source_checksum_mismatch')
    with SOURCE.open(encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != EXPECTED_FIELDS:
            raise ValueError('unexpected_fields')
        rows = list(reader)
    if len(rows) != 756:
        raise ValueError('unexpected_row_count')
    records = []
    seen = set()
    for row in rows:
        code, title, raw = (row[name] for name in EXPECTED_FIELDS)
        if not re.fullmatch(r'\d{2}-\d{4}', code) or code in seen or not title.strip():
            raise ValueError(f'invalid_soc_record:{code}')
        seen.add(code)
        try:
            score = Decimal(raw)
        except InvalidOperation as exc:
            raise ValueError(f'invalid_exposure:{code}') from exc
        if not score.is_finite() or not 0 <= score <= 1:
            raise ValueError(f'exposure_out_of_range:{code}')
        records.append({'soc_code': code, 'title': title, 'observed_exposure': raw})
    dataset = {
        'metadata': {
            'source_title': 'Labor market impacts of AI: A new measure and early evidence',
            'source_date': '2026-03-05',
            'retrieved_date': '2026-11-01',
            'source_url': 'https://www.anthropic.com/research/labor-market-impacts',
            'dataset_url': 'https://huggingface.co/datasets/Anthropic/EconomicIndex/blob/main/labor_market_impacts/job_exposure.csv',
            'source_commit': '7a1cc3c',
            'source_sha256': source_hash,
            'count': len(records),
            'score_definition': 'SOC-group-level observed Claude task exposure; not a displacement probability, employment forecast, or date',
            'license_notice': 'Repository card states data CC-BY and code MIT, but its machine-readable license field says MIT; CC-BY version is unspecified.',
        },
        'records': records,
    }
    DESTINATION.write_text(json.dumps(dataset, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'records': len(records), 'sha256': source_hash}, ensure_ascii=False))


if __name__ == '__main__':
    main()

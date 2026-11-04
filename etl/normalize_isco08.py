"""Verify and normalize official ISCO-08 CSV (local review; not publication).

The ILO file includes several ISCO versions and its 2021 CSV serializes the
leading zero of military unit-group codes as a number.  Restore it solely for
rows where the source major group is 0; preserve all other codes as written.
"""
import csv
import hashlib
import json
import sys
from pathlib import Path

SOURCE_URL = 'https://www.ilo.org/ilostat-files/ISCO/newdocs-08-2021/ISCO-08/ISCO-08%20EN.csv'
SHA256 = '9afc6377d6ed6738d59aa0476777042e180397400d7dcd932e084045228b4d49'

def normalize(source):
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != SHA256:
        raise ValueError('Source digest changed. Review the source before replacing this verified snapshot.')
    with source.open(encoding='cp1252', newline='') as stream:
        rows = [r for r in csv.DictReader(stream) if r['ISCO_version'] == 'ISCO-08']
    entries = []
    for row in rows:
        code = row['unit'].strip()
        if row['major'] == '0' and len(code) == 3:
            code = '0' + code
        if len(code) != 4 or not code.isascii() or not code.isdigit() or not row['description'].strip():
            raise ValueError(f'Invalid ISCO-08 row: {row}')
        entries.append({'code': code, 'name': row['description'].strip(), 'locale': 'en', 'sourceUrl': SOURCE_URL})
    if len(entries) != 436 or len({x['code'] for x in entries}) != 436:
        raise ValueError('The ILO states 436 unit groups; count or codes do not match.')
    if {x['code'] for x in entries if x['code'].startswith('0')} != {'0110','0210','0310'}:
        raise ValueError('Unexpected armed-forces code set; review leading-zero normalization.')
    return entries

if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('Usage: python etl/normalize_isco08.py SOURCE.csv OUTPUT.json')
    entries = normalize(Path(sys.argv[1]))
    out = {'system':'ISCO', 'version':'ISCO-08', 'source_url':SOURCE_URL, 'input_sha256':SHA256,
           'scope':'436 unit groups', 'rights_status':'pre-2023 ILO source; reproduction permission not established',
           'occupations':entries}
    Path(sys.argv[2]).write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Validated {len(entries)} ISCO-08 unit groups; publication rights must be checked.')

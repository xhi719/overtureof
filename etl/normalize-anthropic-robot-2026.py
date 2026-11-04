"""Normalize the pinned Anthropic robot-exposure release without changing scores."""
import csv
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/anthropic-robot-2026/robot_exposure_occupations.csv'
TARGET = ROOT / 'data/anthropic-robot-2026/normalized.json'
EXPECTED_SHA256 = 'bdb193200e2cf8f1cf353bbaa6e447ca97da7db2f29c830b0d05601801e7b271'
REVISION = '4e5f69fab13a9c3f7d0dcc31a6f893a9818738f6'
SOURCE_URL = f'https://huggingface.co/datasets/Anthropic/EconomicIndex/resolve/{REVISION}/robot_exposure/robot_exposure_occupations.csv'

source_bytes = SOURCE.read_bytes()
if hashlib.sha256(source_bytes).hexdigest() != EXPECTED_SHA256:
    raise ValueError('unexpected source bytes; verify a new release before updating')

records = {}
with SOURCE.open('r', encoding='utf-8-sig', newline='') as stream:
    reader = csv.DictReader(stream)
    if reader.fieldnames != ['onetsoc_code', 'occupation_title', 'robot_exposure_index']:
        raise ValueError('unexpected source schema')
    for row in reader:
        code, title, raw = row['onetsoc_code'], row['occupation_title'], row['robot_exposure_index']
        if not re.fullmatch(r'\d{2}-\d{4}\.\d{2}', code) or code in records or not title.strip():
            raise ValueError(f'invalid or duplicate code {code}')
        value = float(raw)
        if not 0 <= value <= 3:
            raise ValueError(f'invalid exposure index for {code}')
        records[code] = {'title': title, 'value': value, 'raw': raw}
if len(records) != 923:
    raise ValueError('unexpected source count')

result = {
    'metadata': {
        'title': 'What work can robots do?',
        'authors': ['Russell Legate-Yang', 'Maxim Massenkoff'],
        'publisher': 'Anthropic',
        'publishedAt': '2026-09-30',
        'sourceVersion': '29.3',
        'measure': 'robot_exposure_index',
        'scale': [0, 3],
        'sourceUrl': 'https://www.anthropic.com/research/what-work-can-robots-do',
        'datasetUrl': SOURCE_URL,
        'datasetReadmeUrl': f'https://huggingface.co/datasets/Anthropic/EconomicIndex/blob/{REVISION}/robot_exposure/README.md',
        'license': 'CC BY 4.0',
        'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
        'sourceSha256': EXPECTED_SHA256,
        'revision': REVISION,
        'count': len(records),
    },
    'occupations': records,
}
TARGET.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Normalized {len(records)} unchanged exposure values')

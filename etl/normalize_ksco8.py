"""Extract the public-notice Korean classification table without external libraries.
Only the official Korean codes and titles are used; no KDCA translations are copied.
"""
import argparse
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path
from zipfile import ZipFile

NOTICE_URL = 'https://mods.go.kr/board.es?act=view&bid=107&list_no=431582&mid=a10403040000'
SOURCE_SHA256 = '9d344859fc201e23b2270bb5667fe77636708c08aa5957e800786e03705396a1'
COUNTS = {1: 10, 2: 57, 3: 167, 4: 495, 5: 1270}
CODE = re.compile(r'(?:[1-9]\d*|A\d*)\Z')

def extract(source):
    if hashlib.sha256(source.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise ValueError('Unexpected official source digest; inspect the new release before importing')
    with ZipFile(source) as archive:
        root = ET.fromstring(archive.read('Contents/section0.xml'))
    tables = [x for x in root.iter() if x.tag.endswith('}tbl')]
    if len(tables) != 4:
        raise ValueError('Unexpected official notice structure')
    items = {}
    # First table lists all major groups, second table contains the remaining levels.
    for table in (tables[2], tables[3]):
        for row in (x for x in table if x.tag.endswith('}tr')):
            cells = [''.join(x.text or '' for x in cell.iter() if x.tag.endswith('}t')).strip()
                     for cell in row if cell.tag.endswith('}tc')]
            if len(cells) != 2 or not CODE.fullmatch(cells[0]):
                continue
            code, name = cells
            if not name or code in items:
                raise ValueError(f'Invalid or duplicate code {code}')
            items[code] = name
    if Counter(map(len, items)) != COUNTS:
        raise ValueError('Classification level counts do not match the official announcement')
    if any(code[:-1] not in items for code in items if len(code) > 1):
        raise ValueError('Classification hierarchy is incomplete')
    return {'system': 'KSCO', 'version': '8', 'sourceUrl': NOTICE_URL,
            'sourceSha256': SOURCE_SHA256, 'countsByLevel': {str(k): v for k, v in COUNTS.items()},
            'items': [{'code': code, 'name': name} for code, name in items.items()]}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    data = extract(args.source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Validated {len(data['items'])} KSCO-8 classification entries")

if __name__ == '__main__':
    main()

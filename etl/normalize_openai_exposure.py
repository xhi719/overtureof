"""Normalize the original OpenAI research CSV without changing its values."""
from pathlib import Path
import csv, hashlib, json, math
root=Path(__file__).resolve().parents[1]
source=root/'data/openai-gpts-2023/occ_level.csv'
raw=source.read_bytes()
expected='40c74f53de40aec91c0017d80690cbba915f83a8bb414bcf2f884692f1749acb'
if hashlib.sha256(raw).hexdigest()!=expected: raise ValueError('Research source checksum mismatch')
with source.open(encoding='utf-8-sig',newline='') as f: rows=list(csv.DictReader(f))
fields=['dv_rating_alpha','dv_rating_beta','dv_rating_gamma','human_rating_alpha','human_rating_beta','human_rating_gamma']
if len(rows)!=923 or len({r['O*NET-SOC Code'] for r in rows})!=len(rows): raise ValueError('Unexpected research row count or duplicate codes')
normalized=[]
for row in rows:
  values={}
  for field in fields:
    value=float(row[field])
    if not math.isfinite(value) or not 0<=value<=1: raise ValueError('Invalid exposure score')
    values[field]=row[field]
  normalized.append({'code':row['O*NET-SOC Code'],'title':row['Title'],'values':values})
out={'sourceSha256':expected,'sourceUrl':'https://github.com/openai/GPTs-are-GPTs/blob/main/data/occ_level.csv','records':normalized}
(root/'data/openai-gpts-2023/normalized.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Validated {len(normalized)} occupation records; exposure is not job loss probability.')

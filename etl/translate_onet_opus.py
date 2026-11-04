import json, pathlib
import ctranslate2, sentencepiece as sp
source=pathlib.Path('data/onet-31.0/occupation_data.json')
entries=json.loads(source.read_text(encoding='utf-8'))['row']
s=sp.SentencePieceProcessor(model_file='.runtime/opus-en-ko/source.spm')
d=sp.SentencePieceProcessor(model_file='.runtime/opus-en-ko/target.spm')
t=ctranslate2.Translator('.runtime/opus-en-ko',device='cpu',intra_threads=4,compute_type='int8')
result=[]
for i in range(0,len(entries),48):
 rows=entries[i:i+48]
 translated=t.translate_batch([s.encode(row['title'],out_type=str) for row in rows],beam_size=4,max_batch_size=48)
 for row,item in zip(rows,translated): result.append({'code':row['onetsoc_code'],'english':row['title'],'korean':d.decode(item.hypotheses[0])})
 print(f'{len(result)}/{len(entries)}',flush=True)
pathlib.Path('data/translation/onet-31.0-opus-candidates.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

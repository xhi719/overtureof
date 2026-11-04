"""Build a deterministic, explicitly unvalidated Korean-title proxy for a hypothetical scenario.

This is not an occupation crosswalk, a displacement probability model, or a forecast.
Requires numpy, scipy, and scikit-learn. Original input files are preserved.
"""
from pathlib import Path
import hashlib
import json
import re
import unicodedata
import numpy as np
import sklearn
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.model_selection import GroupShuffleSplit

ROOT = Path(__file__).resolve().parents[1]

def load(relative):
    return json.loads((ROOT / relative).read_text(encoding='utf-8-sig'))

def digest(relative):
    return hashlib.sha256((ROOT / relative).read_bytes()).hexdigest()

def normal(text):
    text = unicodedata.normalize('NFKC', text).lower()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9가-힣]+', ' ', text)).strip()

def vectorize(titles):
    model = TfidfVectorizer(analyzer='char', ngram_range=(2, 4), min_df=1, sublinear_tf=True, dtype=np.float64)
    matrix = model.fit_transform([normal(t) for t in titles])
    return model, matrix

def infer(train_matrix, candidate_matrix, train_scores):
    similarities = cosine_similarity(candidate_matrix, train_matrix)
    k = min(5, len(train_scores))
    indices = np.argsort(-similarities, axis=1, kind='stable')[:, :k]
    ordered = np.take_along_axis(similarities, indices, axis=1)
    peak = ordered[:, 0]
    weights = ordered ** 4
    totals = weights.sum(axis=1)
    prior = float(np.mean(train_scores))
    weighted = np.divide((weights * train_scores[indices]).sum(axis=1), totals, out=np.full(len(peak), prior), where=totals > 0)
    strength = np.clip((peak - 0.15) / 0.85, 0.0, 1.0) ** 2
    prediction = np.clip(prior + strength * (weighted - prior), 0, 1)
    return prediction, peak, strength

def main():
    translations = load('data/translation/onet-31.0-ko.json')
    exclusions = load('data/translation/onet-31.0-exclusions.json')
    source = load('data/openai-gpts-2023/normalized.json')
    ksco = load('data/ksco8/classification.json')
    excluded = {x['code'] for x in exclusions}
    if len(excluded) != len(exclusions): raise ValueError('duplicate exclusions')
    korean = {x['code']: x['korean'] for x in translations if x['code'] not in excluded}
    observed = {x['code']: float(x['values']['human_rating_beta']) for x in source['records'] if x['code'] in korean}
    if len(translations) != 1016 or len(source['records']) != 923 or len(ksco['items']) != 1999: raise ValueError('unexpected official source coverage')
    if len(korean) != len(translations) - len(excluded) or not excluded.issubset({x['code'] for x in translations}): raise ValueError('invalid exclusion coverage')
    if len(observed) < 10 or len(set(normal(korean[c]) for c in observed)) < 5: raise ValueError('insufficient training data')
    if any(not 0 <= v <= 1 for v in observed.values()): raise ValueError('invalid observed score')
    train_codes = sorted(observed)
    train_names = [korean[c] for c in train_codes]
    y = np.array([observed[c] for c in train_codes], dtype=np.float64)
    signature_text = '\n'.join(f'{c}\t{korean[c]}\t{observed[c]:.10f}' for c in train_codes)
    signature = hashlib.sha256(signature_text.encode('utf8')).hexdigest()
    groups = [normal(name) for name in train_names]
    splitter = GroupShuffleSplit(n_splits=1, test_size=.2, random_state=42)
    train_idx, test_idx = next(splitter.split(train_names, y, groups))
    val_model, val_train = vectorize([train_names[i] for i in train_idx])
    val_query = val_model.transform([normal(train_names[i]) for i in test_idx])
    predicted, val_peaks, _ = infer(val_train, val_query, y[train_idx])
    validation = {
      'kind': 'grouped-title-holdout', 'train': int(len(train_idx)), 'test': int(len(test_idx)),
      'mae': round(float(np.mean(np.abs(predicted-y[test_idx]))), 6),
      'priorMeanBaselineMae': round(float(np.mean(np.abs(float(y[train_idx].mean()) - y[test_idx]))), 6),
      'shareMaxSimilarityBelow05': round(float(np.mean(val_peaks < .5)), 6),
      'note': 'Cross-sectional proxy of the 2023 task-exposure score, not validation of displacement, adoption or timing.'
    }
    candidates = [dict(system='O*NET-SOC', version='31.0', code=c, name=korean[c]) for c in sorted(korean) if c not in observed]
    candidates += [dict(system='KSCO', version='8', code=str(x['code']), name=x['name']) for x in ksco['items']]
    if len(candidates) != len(korean) - len(observed) + len(ksco['items']): raise ValueError('unexpected proxy count')
    model, matrix = vectorize(train_names)
    candidate_matrix = model.transform([normal(x['name']) for x in candidates])
    predicted, peaks, strengths = infer(matrix, candidate_matrix, y)
    result = {}
    for row, val, sim, strength in zip(candidates, predicted, peaks, strengths):
        key = f"{row['system']}|{row['version']}|{row['code']}"
        if key in result: raise ValueError('duplicate occupation key')
        result[key] = {'name': row['name'], 'score': round(float(val), 12), 'similarity': round(float(sim), 12), 'strength': round(float(strength), 12), 'basis': 'name_proxy' if sim >= .15 else 'default'}
    metadata = {'method':'korean-char-tfidf-cosine-top5-shrunk-v1','sourceTrainingSignature':signature,'trainingCount':len(train_codes),'candidateCount':len(candidates),'prior':round(float(y.mean()),12),'similarityFloor':.15,'neighbors':5,'maxSyntheticVariation':.03,'validation':validation,'libraries':{'numpy':np.__version__,'sklearn':sklearn.__version__},'inputs':{p:digest(p) for p in ['data/translation/onet-31.0-ko.json','data/translation/onet-31.0-exclusions.json','data/openai-gpts-2023/normalized.json','data/ksco8/classification.json']}}
    out = {'metadata': metadata, 'occupations': result}
    (ROOT / 'data/scenario/name-proxy-v1.json').write_text(json.dumps(out,ensure_ascii=False,sort_keys=True,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'training':len(train_codes),'candidates':len(candidates),'prior':metadata['prior'],'coverageNameProxy':sum(x['basis']=='name_proxy' for x in result.values()),'default':sum(x['basis']=='default' for x in result.values()),'validation':validation},ensure_ascii=False))

if __name__ == '__main__': main()

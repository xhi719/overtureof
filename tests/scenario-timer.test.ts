import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import baseConfig from '../data/scenario/model-v6.json';
import timerConfig from '../data/scenario/timer-v7.json';
import { calculateCoverage, type CoverageJob, type ProxyArtifact } from '../lib/scenario-coverage';
import { calculateTimers, cachedTimers } from '../lib/scenario-timer';

const jobs: CoverageJob[] = [
  {id:'high',code:'99-0001.00',system:'O*NET-SOC',version:'31.0',koreanName:'A',observed:.8},
  {id:'low',code:'99-0002.00',system:'O*NET-SOC',version:'31.0',koreanName:'B',observed:.2},
  {id:'actor',code:'29321',system:'KSCO',version:'8',koreanName:'C',observed:null},
  {id:'other',code:'99999',system:'KSCO',version:'8',koreanName:'D',observed:null},
  {id:'singer',code:'27-2042.00',system:'O*NET-SOC',version:'31.0',koreanName:'E',observed:.8},
];
const artifact: ProxyArtifact = { metadata: { sourceTrainingSignature: '', trainingCount: 0, prior: .5, maxSyntheticVariation: .03 }, occupations: {} };

test('timer-only research and entertainment adjustments preserve every original non-timer field', () => {
  const base = calculateCoverage(baseConfig,jobs,artifact,true);
  const result = calculateTimers(timerConfig,jobs,base,true);
  const reversed = calculateTimers(timerConfig,[...jobs].reverse(),base,true);
  for (const job of jobs) {
    const previous = base.get(job.id)!, current = result.get(job.id)!;
    const { targetAt, timerModelVersion, timerResearchFactor, timerEntertainmentFactor, timerAdjustmentSeconds, ...rest } = current;
    const { targetAt: original, ...oldRest } = previous;
    assert.deepEqual(rest,oldRest);
    assert.equal(targetAt,reversed.get(job.id)!.targetAt);
    if (job.id === 'actor' || job.id === 'singer') assert.ok(Date.parse(targetAt) > Date.parse(original));
    if (job.id === 'other') assert.equal(targetAt,original);
  }
  assert.ok(result.get('high')!.timerResearchFactor < 1);
  assert.ok(result.get('low')!.timerResearchFactor > 1);
  assert.equal(result.get('actor')!.timerResearchFactor,1);
  assert.equal(result.get('actor')!.timerEntertainmentFactor,1.5);
  assert.equal(result.get('other')!.timerResearchFactor,1);
  const times = [...result.values()].map(v => Date.parse(v.targetAt)).sort((a,b) => a-b);
  for(let i=1;i<times.length;i++) assert.ok(times[i]-times[i-1]>=1000);
});

test('source revocation disables research adjustment but preserves entertainment adjustment', () => {
  const base = calculateCoverage(baseConfig,jobs,artifact,false);
  const result = calculateTimers(timerConfig,jobs,base,false);
  assert.equal(result.get('high')!.timerResearchFactor,1);
  assert.equal(result.get('singer')!.timerResearchFactor,1);
  assert.equal(result.get('singer')!.timerEntertainmentFactor,1.5);
  assert.ok(Date.parse(result.get('singer')!.targetAt) > Date.parse(base.get('singer')!.targetAt));
});

test('unchanged targets win collisions with moving timers', () => {
  const base = calculateCoverage(baseConfig,jobs,artifact,true);
  const start = Date.parse(baseConfig.baselineAt);
  const collision = start + 1_500_000;
  base.set('other',{...base.get('other')!,targetAt:new Date(collision).toISOString()});
  base.set('actor',{...base.get('actor')!,targetAt:new Date(start+1_000_000).toISOString()});
  const result = calculateTimers(timerConfig,jobs,base,true);
  assert.equal(Date.parse(result.get('other')!.targetAt),collision);
  assert.ok(Math.abs(Date.parse(result.get('actor')!.targetAt)-collision)>=1000);
  assert.ok(Date.parse(result.get('actor')!.targetAt)>Date.parse(base.get('actor')!.targetAt));
});

test('timer cache keys data, source status and timer configuration', () => {
  const base=calculateCoverage(baseConfig,jobs,artifact,true);
  const a=cachedTimers(timerConfig,jobs,base,true);
  assert.equal(cachedTimers(timerConfig,[...jobs].reverse(),base,true),a);
  assert.notEqual(cachedTimers(timerConfig,jobs,base,false),a);
  assert.notEqual(cachedTimers({...timerConfig,researchExposureSlope:.2},jobs,base,true),a);
  assert.notEqual(cachedTimers(timerConfig,jobs.map(j=>j.id==='high'?{...j,observed:.7}:j),base,true),a);
});

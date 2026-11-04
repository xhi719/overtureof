import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import config from '../data/scenario/model-v8.json';
import prior from '../data/scenario/model-v6.json';
import priorTimer from '../data/scenario/timer-v7.json';
import { AnthropicDatasetUnavailableError, createAnthropicObservationLookup, loadAnthropicObservationLookup } from '../lib/anthropic-observations';
import { blsProjection } from '../lib/bls-projections';
import { calculateCoverage, type CoverageJob, type ProxyArtifact } from '../lib/scenario-coverage';
import { calculateTimers } from '../lib/scenario-timer';

// Synthetic data for tests: no third-party dataset is needed in a public checkout.
const anthropicObservation = createAnthropicObservationLookup({
  metadata: { source_url: 'test', source_date: 'test', dataset_url: 'test', source_sha256: 'test', retrieved_date: 'test', count: 2 },
  records: [
    { soc_code: '15-1252', title: 'test', observed_exposure: '0.5000' },
    { soc_code: '27-2011', title: 'test', observed_exposure: '0.0000' },
  ],
});
const artifact: ProxyArtifact = { metadata: { sourceTrainingSignature: '', trainingCount: 0, prior: .5, maxSyntheticVariation: .03 }, occupations: {} };
const jobs: CoverageJob[] = [
  { id: 'actor', code: '29321', system: 'KSCO', version: '8', koreanName: '배우', observed: null },
  { id: 'otherperformer', code: '29461', system: 'KSCO', version: '8', koreanName: '가수', observed: null },
  { id: 'government', code: '11121', system: 'KSCO', version: '8', koreanName: '공무원', observed: null },
  { id: 'doctor', code: '24111', system: 'KSCO', version: '8', koreanName: '의사', observed: null },
  { id: 'programmer', code: '15-1252.00', system: 'O*NET-SOC', version: '31.0', koreanName: '개발자', observed: .68, anthropicObservation: anthropicObservation('O*NET-SOC', '31.0', '15-1252.00'), blsProjection: blsProjection('O*NET-SOC', '31.0', '15-1252.00') },
  { id: 'onetactor', code: '27-2011.00', system: 'O*NET-SOC', version: '31.0', koreanName: '배우', observed: .2, anthropicObservation: anthropicObservation('O*NET-SOC', '31.0', '27-2011.00'), blsProjection: blsProjection('O*NET-SOC', '31.0', '27-2011.00') },
];

test('missing Anthropic input fails closed without inventing a replacement', () => {
  assert.throws(() => loadAnthropicObservationLookup('missing-test-input-directory'), AnthropicDatasetUnavailableError);
});

test('SOC data preserves original zero, distinguishes specialty groups, and excludes KSCO', () => {
  const direct = anthropicObservation('O*NET-SOC','31.0','27-2011.00')!;
  assert.equal(direct.socCode, '27-2011');
  assert.equal(direct.mapping, 'soc_exact');
  assert.equal(Number(direct.originalValue), direct.value);
  assert.equal(anthropicObservation('O*NET-SOC','31.0','27-2011.01')?.mapping, 'soc_group');
  assert.equal(anthropicObservation('KSCO','8','27-2011.00'), null);
  assert.equal(anthropicObservation('O*NET-SOC','31.0','99-9999.00'), null);
});

test('v8 changes probability and time together, preserves prior relative categories, and shortens every actor', () => {
  const old = calculateCoverage(prior, jobs, artifact, true);
  const oldTimers = calculateTimers(priorTimer, jobs, old, true);
  const values = calculateCoverage(config, jobs, artifact, true);
  const reverse = calculateCoverage(config, [...jobs].reverse(), artifact, true);
  const origin = Date.parse(config.baselineAt), yearMs = config.daysPerYear * 86400000;
  for (const job of jobs) {
    const v = values.get(job.id)!;
    assert.equal(v.targetAt, reverse.get(job.id)!.targetAt);
    const elapsed = (Date.parse(v.targetAt) - origin) / yearMs;
    const hazard = v.hazardMultiplier * (config.annualBaseHazard + config.annualExposureHazard * v.effectiveExposure);
    assert.ok(Math.abs(-Math.expm1(-hazard * elapsed) - config.crossingProbability) < 1e-9);
    assert.ok(v.probabilities.every((p, i, all) => p.probability >= 0 && p.probability <= 1 && (i === 0 || p.probability >= all[i - 1].probability)));
    assert.ok(v.probability > old.get(job.id)!.probability);
    assert.ok(Date.parse(v.targetAt) < Date.parse(oldTimers.get(job.id)!.targetAt));
  }
  assert.equal(values.get('actor')!.scenarioActorFactor, config.scenarioActorFactor);
  assert.equal(values.get('onetactor')!.scenarioActorFactor, config.scenarioActorFactor);
  assert.equal(values.get('otherperformer')!.scenarioActorFactor, 1);
  assert.equal(values.get('actor')!.scenarioEntertainmentTimeFactor, 1.5);
  assert.equal(values.get('otherperformer')!.scenarioEntertainmentTimeFactor, 1.5);
  assert.equal(values.get('government')!.governmentAdjustmentFactor, .75);
  assert.equal(values.get('doctor')!.medicalAccelerationFactor, 2);
  const times=[...values.values()].map(v=>Date.parse(v.targetAt)).sort((a,b)=>a-b);
  assert.ok(times.slice(1).every((value, i) => value-times[i] >= 1000));
});

test('measured Anthropic zero is not the same as no matching SOC and source checks are independent', () => {
  const template = anthropicObservation('O*NET-SOC','31.0','27-2011.00')!;
  const zero: CoverageJob = { ...jobs[5], id: 'zero', anthropicObservation: { ...template, value: 0, originalValue: '0.0000' } };
  const missing: CoverageJob = { ...jobs[4], id: 'missing', anthropicObservation: null };
  const result = calculateCoverage(config, [zero, missing], artifact, false);
  assert.equal(result.get('zero')!.scenarioAnthropicFactor, .8);
  assert.equal(result.get('missing')!.scenarioAnthropicFactor, 1);
  assert.equal(result.get('zero')!.researchAccelerationFactor, 1);
  assert.equal(result.get('zero')!.scenarioResearchTimeFactor, 1);
  assert.throws(() => calculateCoverage(config, [{ ...zero, anthropicObservation: { ...template, socCode: '99-9999' } }], artifact, true), /invalid_anthropic_link/);
});

test('BLS raw zero, missing and suppressed change are distinct and bounded', () => {
  const actor = blsProjection('O*NET-SOC','31.0','27-2011.00')!;
  assert.equal(actor.changePercent, 0);
  assert.equal(actor.changePercentRaw, '0.0');
  assert.equal(actor.relation, 'official_crosswalk_soc_parent');
  assert.equal(blsProjection('KSCO','8','27-2011.00'), null);
  assert.equal(blsProjection('O*NET-SOC','31.0','99-9999.00'), null);
  const suppressed: CoverageJob = { ...jobs[5], id: 's', blsProjection: { ...actor, changePercent: null, changePercentRaw: '—' } };
  const zero = { ...jobs[5], id: 'z' };
  const growing = { ...jobs[5], id: 'g', blsProjection: { ...actor, changePercent: 25, changePercentRaw: '25.0' } };
  const falling = { ...jobs[5], id: 'f', blsProjection: { ...actor, changePercent: -25, changePercentRaw: '-25.0' } };
  // Unique codes are required, so evaluate each occupation separately.
  assert.equal(calculateCoverage(config,[zero],artifact,true).get('z')!.scenarioBlsFactor,1);
  assert.equal(calculateCoverage(config,[suppressed],artifact,true).get('s')!.scenarioBlsFactor,1);
  assert.equal(calculateCoverage(config,[growing],artifact,true).get('g')!.scenarioBlsFactor,.9);
  assert.equal(calculateCoverage(config,[falling],artifact,true).get('f')!.scenarioBlsFactor,1.1);
  assert.throws(() => calculateCoverage(config,[{ ...zero, blsProjection: { ...actor, onetCode: '99-9999.00' } }],artifact,true), /invalid_bls_link/);
});

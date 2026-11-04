import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import config from '../data/scenario/model-v3.json';
import previousConfig from '../data/scenario/model-v2.json';
import { calculateScenario } from '../lib/scenario';

test('accelerated scenario reaches the same threshold in one third of v2 time', () => {
  assert.equal(config.version, '3.0.0');
  assert.equal(config.baselineAt, previousConfig.baselineAt);
  for (const exposure of [0, 0.2, 0.5, 1]) {
    const v2 = calculateScenario(previousConfig, exposure);
    const v3 = calculateScenario(config, exposure);
    const baseline = Date.parse(config.baselineAt);
    const oldDuration = Date.parse(v2.targetAt) - baseline;
    const newDuration = Date.parse(v3.targetAt) - baseline;
    assert.ok(Math.abs(newDuration * 3 - oldDuration) <= 3);
    assert.ok(v3.probability > v2.probability);
  }
});

test('crossing timestamp is the continuous 50% cumulative-hazard threshold', () => {
  const result = calculateScenario(config, 0.5);
  const elapsedYears = (Date.parse(result.targetAt) - Date.parse(config.baselineAt)) / (config.daysPerYear * 86400000);
  const probability = 1 - Math.exp(-(config.annualBaseHazard + config.annualExposureHazard * 0.5) * elapsedYears);
  assert.ok(Math.abs(probability - config.crossingProbability) < 1e-10);
  assert.equal(result.baselineAt, config.baselineAt);
  assert.equal(result.eventEmploymentReduction, 0.1);
});
test('all horizon probabilities are bounded and nondecreasing', () => {
  for (const exposure of [0, 0.2, 0.5, 1]) {
    const result = calculateScenario(config, exposure);
    for (const [index, row] of result.probabilities.entries()) {
      assert.ok(row.probability >= 0 && row.probability <= 1);
      if (index) assert.ok(row.probability >= result.probabilities[index - 1].probability);
    }
    assert.equal(result.probability, result.probabilities.at(-1)!.probability);
  }
});
test('higher input under the scenario raises probability and advances crossing', () => {
  const low = calculateScenario(config, 0);
  const high = calculateScenario(config, 1);
  assert.ok(high.probability > low.probability);
  assert.ok(Date.parse(high.targetAt) < Date.parse(low.targetAt));
});
test('rejects invalid scenario inputs and invalid parameters', () => {
  for (const e of [-0.1, 1.1, Number.NaN, Infinity]) assert.throws(() => calculateScenario(config, e));
  assert.throws(() => calculateScenario({ ...config, annualBaseHazard: 0 }, 0.5));
  assert.throws(() => calculateScenario({ ...config, crossingProbability: 1 }, 0.5));
  assert.throws(() => calculateScenario({ ...config, horizons: [2040, 2030] }, 0.5));
  assert.throws(() => calculateScenario({ ...config, baselineAt: '2026-10-31' }, 0.5));
  assert.throws(() => calculateScenario({ ...config, baselineAt: '2025-02-29T00:00:00Z' }, 0.5));
});

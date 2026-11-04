import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { scenarioComparisonKey, type ScenarioComparable } from '../lib/scenario-compare';
const base: ScenarioComparable = { event: 'illustrative_employment_displacement', modelId: 'm', modelVersion: '1', baselineAt: '2026-10-31T00:00:00Z', horizonYear: 2040, threshold: 0.5, parameters: { annualBaseHazard: 0.012, annualExposureHazard: 0.06, daysPerYear: 365.2425, defaultExposure: 0.5, eventEmploymentReduction: 0.1 } };
test('same scenario assumptions share a comparison group', () => assert.equal(scenarioComparisonKey(base), scenarioComparisonKey({ ...base })));
test('different horizon, event or model parameters do not share a comparison group', () => {
  for (const different of [{ ...base, horizonYear: 2035 }, { ...base, event: 'other' }, { ...base, parameters: { ...base.parameters, eventEmploymentReduction: 0.2 } }, { ...base, baselineAt: '2027-01-01T00:00:00Z' }, { ...base, modelVersion: '2' }]) assert.notEqual(scenarioComparisonKey(base), scenarioComparisonKey(different));
});

test('occupation-specific effective hazards share a group only when common model configuration matches', () => {
  const first: ScenarioComparable = { ...base, comparisonConfigId: 'model-config-a' };
  const anotherJob = { ...first, parameters: { ...first.parameters, annualBaseHazard: .05, annualExposureHazard: .25 } };
  assert.equal(scenarioComparisonKey(first), scenarioComparisonKey(anotherJob));
  assert.notEqual(scenarioComparisonKey(first), scenarioComparisonKey({ ...anotherJob, comparisonConfigId: 'model-config-b' }));
  assert.notEqual(scenarioComparisonKey(first), scenarioComparisonKey(base));
});

test('without a shared configuration fingerprint, different effective coefficients remain separate', () => {
  const different = { ...base, parameters: { ...base.parameters, annualBaseHazard: .04 } };
  assert.notEqual(scenarioComparisonKey(base), scenarioComparisonKey(different));
});

test('shared configuration does not override the event, time or horizon comparability checks', () => {
  const shared: ScenarioComparable = { ...base, comparisonConfigId: 'model-config-a' };
  const incompatible = [
    { ...shared, threshold: .6 },
    { ...shared, horizonYear: 2035 },
    { ...shared, event: 'other' },
    { ...shared, modelId: 'other' },
    { ...shared, modelVersion: '2' },
    { ...shared, baselineAt: '2027-01-01T00:00:00Z' },
    { ...shared, parameters: { ...shared.parameters, eventEmploymentReduction: .2 } },
    { ...shared, parameters: { ...shared.parameters, daysPerYear: 365 } },
    { ...shared, parameters: { ...shared.parameters, defaultExposure: .4 } },
  ];
  for (const other of incompatible) assert.notEqual(scenarioComparisonKey(shared), scenarioComparisonKey(other));
});

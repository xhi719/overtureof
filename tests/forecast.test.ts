import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { validateForecastSeries } from '../lib/forecast-validation';
const base = { occupationId:'id', event:'task_automation', country:'KR', baselineYear:2025, horizonYear:2030, threshold:0.5, probability:0.2, lowerBound:0.1, upperBound:0.3, status:'available', origin:'model', modelId:'m', sourceId:null };
test('accepts a bounded non-decreasing comparable series', () => assert.deepEqual(validateForecastSeries([base, {...base,horizonYear:2035,probability:0.4,lowerBound:0.3,upperBound:0.5}]), []));
test('rejects decreasing cumulative probabilities and duplicate horizons', () => { const errors = validateForecastSeries([base, {...base,horizonYear:2035,probability:0.1,lowerBound:0.05,upperBound:0.15}, {...base}]); assert.ok(errors.includes('decreasing_cumulative_probability')); assert.ok(errors.includes('duplicate_horizon')); });
test('rejects unsupported and invalid probabilities', () => { const errors = validateForecastSeries([{...base,probability:1.2,modelId:null,lowerBound:null,upperBound:null}]); assert.ok(errors.includes('invalid_probability')); assert.ok(errors.includes('missing_model')); });

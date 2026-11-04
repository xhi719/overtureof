import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { hasScenarioAdjustment } from '../lib/scenario-display';
test('adjustment notice requires an actual nonzero input or time adjustment', () => {
  const mode = 'collision-resolution';
  assert.equal(hasScenarioAdjustment({ clockAdjustment: mode, syntheticDelta: 0, adjustmentSeconds: 0 }), false);
  assert.equal(hasScenarioAdjustment({ clockAdjustment: mode, syntheticDelta: -0.01, adjustmentSeconds: 0 }), true);
  assert.equal(hasScenarioAdjustment({ clockAdjustment: mode, syntheticDelta: 0, adjustmentSeconds: 1 }), true);
  assert.equal(hasScenarioAdjustment({ clockAdjustment: mode, syntheticDelta: Number.EPSILON / 2, adjustmentSeconds: 0 }), false);
  assert.equal(hasScenarioAdjustment({ syntheticDelta: 0.01, adjustmentSeconds: 1 }), false);
});

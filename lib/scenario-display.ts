export type ScenarioAdjustment = { clockAdjustment?: string; syntheticDelta?: number; adjustmentSeconds?: number };
/** Show the adjustment notice only when the scenario actually changes an input or time. */
export function hasScenarioAdjustment(value: ScenarioAdjustment): boolean {
  return value.clockAdjustment === 'collision-resolution' && [value.syntheticDelta, value.adjustmentSeconds].some(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) > Number.EPSILON);
}

export type ScenarioComparable = {
  event: string; modelId: string; modelVersion: string; baselineAt: string; horizonYear: number; threshold: number;
  /** Stable fingerprint of shared model configuration, excluding occupation-specific adjustments. */
  comparisonConfigId?: string;
  parameters: { annualBaseHazard: number; annualExposureHazard: number; daysPerYear: number; defaultExposure: number; eventEmploymentReduction: number };
};
/** Only results from the same assumed event, model and horizon share a comparison table. */
export function scenarioComparisonKey(s: ScenarioComparable): string {
  // Occupation-specific effective hazards can differ even when results use the
  // same model and event. A shared config fingerprint permits that comparison;
  // older responses without one retain the conservative coefficient check.
  const assumptions = s.comparisonConfigId
    ? ['shared', s.comparisonConfigId]
    : ['legacy', s.parameters.annualBaseHazard, s.parameters.annualExposureHazard];
  return JSON.stringify([s.event, s.modelId, s.modelVersion, s.baselineAt, s.horizonYear, s.threshold, s.parameters.eventEmploymentReduction, s.parameters.daysPerYear, s.parameters.defaultExposure, assumptions]);
}

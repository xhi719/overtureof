export type ScenarioConfig = {
  id: string; version: string; baselineAt: string; annualBaseHazard: number; annualExposureHazard: number;
  defaultExposure: number; eventEmploymentReduction: number; crossingProbability: number; daysPerYear: number;
  horizons: number[]; sourceMetricKind: string; sourceUrl: string;
};
export type ScenarioValues = { probability: number; targetAt: string; baseYear: number; horizonYear: number; baselineAt: string; threshold: number; eventEmploymentReduction: number; probabilities: { year: number; probability: number }[] };
export function calculateScenario(config: ScenarioConfig, exposure: number): ScenarioValues {
  const start = Date.parse(config.baselineAt);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(config.baselineAt) || !Number.isFinite(start)) throw new Error('invalid_scenario_baseline');
  const canonicalBaseline = config.baselineAt.replace(/(?:\.(\d{1,3}))?Z$/, (_, fraction: string | undefined) => `.${(fraction || '').padEnd(3, '0')}Z`);
  if (new Date(start).toISOString() !== canonicalBaseline) throw new Error('invalid_scenario_baseline');
  if (!Number.isFinite(exposure) || exposure < 0 || exposure > 1 || !Number.isFinite(config.defaultExposure) || config.defaultExposure < 0 || config.defaultExposure > 1) throw new Error('invalid_scenario_exposure');
  if (!Number.isFinite(config.annualBaseHazard) || config.annualBaseHazard <= 0 || !Number.isFinite(config.annualExposureHazard) || config.annualExposureHazard < 0 || !Number.isFinite(config.daysPerYear) || config.daysPerYear <= 0 || !Number.isFinite(config.crossingProbability) || config.crossingProbability <= 0 || config.crossingProbability >= 1 || !Number.isFinite(config.eventEmploymentReduction) || config.eventEmploymentReduction <= 0 || config.eventEmploymentReduction >= 1) throw new Error('invalid_scenario_parameters');
  if (!Array.isArray(config.horizons) || !config.horizons.length || config.horizons.some((y, i) => !Number.isInteger(y) || y < new Date(start).getUTCFullYear() || y > 9998 || (i > 0 && y <= config.horizons[i - 1]))) throw new Error('invalid_scenario_horizons');
  const yearMs = config.daysPerYear * 86_400_000;
  const hazard = config.annualBaseHazard + config.annualExposureHazard * exposure;
  const crossingMs = start + (-Math.log1p(-config.crossingProbability) / hazard) * yearMs;
  const target = new Date(crossingMs);
  if (!Number.isFinite(target.getTime())) throw new Error('invalid_scenario_target');
  const probabilities = config.horizons.map(year => {
    // End-of-year horizon boundary, not an estimated event timestamp.
    const end = Date.UTC(year + 1, 0, 1);
    return { year, probability: -Math.expm1(-hazard * Math.max(0, (end - start) / yearMs)) };
  });
  const last = probabilities[probabilities.length - 1];
  return { probability: last.probability, targetAt: target.toISOString(), baseYear: new Date(start).getUTCFullYear(), horizonYear: last.year, baselineAt: config.baselineAt, threshold: config.crossingProbability, eventEmploymentReduction: config.eventEmploymentReduction, probabilities };
}

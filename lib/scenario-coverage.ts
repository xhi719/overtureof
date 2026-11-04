import { createHash } from 'node:crypto';
import { calculateScenario, type ScenarioConfig, type ScenarioValues } from '@/lib/scenario';
import type { AnthropicObservation } from '@/lib/anthropic-observations';
import type { BlsProjection } from '@/lib/bls-projections';

export type ProxyRecord = { name: string; score: number; similarity: number; strength: number; basis: 'name_proxy' | 'default' };
export type ProxyArtifact = { metadata: { sourceTrainingSignature: string; trainingCount: number; prior: number; maxSyntheticVariation: number }; occupations: Record<string, ProxyRecord> };
export type CoverageJob = { id: string; code: string; system: string; version: string; koreanName: string | null; observed: number | null; anthropicObservation?: AnthropicObservation | null; blsProjection?: BlsProjection | null };
export type CoverageValues = ScenarioValues & { basis: 'occupation' | 'name_proxy' | 'default'; exposure: number; syntheticDelta: number; effectiveExposure: number; adjustmentSeconds: number; proxySimilarity: number | null; clockAdjustment: 'collision-resolution'; researchBased: boolean; hazardMultiplier: number; researchAccelerationFactor: number; medicalAccelerationFactor: number; governmentAdjustmentFactor: number; scenarioGlobalFactor: number; scenarioResearchTimeFactor: number; scenarioEntertainmentTimeFactor: number; scenarioActorFactor: number; anthropicObservation: AnthropicObservation | null; scenarioAnthropicFactor: number; blsProjection: BlsProjection | null; scenarioBlsFactor: number };
type ClassificationGroup = { system: string; version: string; codes: string[] };
export type CoverageConfig = ScenarioConfig & { syntheticMaxVariation: number; accelerationExposureThreshold?: number; accelerationFactor?: number; medicalAccelerationFactor?: number; medicalClassifications?: ClassificationGroup[]; governmentAdjustmentFactor?: number; governmentClassifications?: ClassificationGroup[]; scenarioGlobalFactor?: number; scenarioResearchExposureCenter?: number; scenarioResearchExposureSlope?: number; scenarioEntertainmentFactor?: number; scenarioEntertainmentClassifications?: ClassificationGroup[]; scenarioActorFactor?: number; scenarioActorClassifications?: ClassificationGroup[]; scenarioAnthropicFloor?: number; scenarioAnthropicRange?: number; scenarioBlsClampPercent?: number; scenarioBlsCoefficient?: number };
const keyOf = (job: CoverageJob) => `${job.system}|${job.version}|${job.code}`;
const order = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const valid = (v: number | null): v is number => v !== null && Number.isFinite(v) && v >= 0 && v <= 1;
function trainingSignature(jobs: CoverageJob[]): string {
  const lines = jobs.filter(job => job.system === 'O*NET-SOC' && job.version === '31.0' && valid(job.observed) && job.koreanName !== null)
    .sort((a,b) => order(a.code,b.code))
    .map(job => `${job.code}\t${job.koreanName}\t${job.observed!.toFixed(10)}`);
  return createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex');
}
export function calculateCoverage(config: CoverageConfig, jobs: CoverageJob[], artifact: ProxyArtifact, sourceApproved: boolean): Map<string, CoverageValues> {
  if (!Number.isFinite(config.syntheticMaxVariation) || config.syntheticMaxVariation < 0 || config.syntheticMaxVariation > 0.03 || config.annualExposureHazard <= 0) throw new Error('invalid_coverage_parameters');
  if ((config.accelerationExposureThreshold === undefined) !== (config.accelerationFactor === undefined) || (config.accelerationExposureThreshold !== undefined && (!Number.isFinite(config.accelerationExposureThreshold) || config.accelerationExposureThreshold < 0 || config.accelerationExposureThreshold > 1 || !Number.isFinite(config.accelerationFactor) || config.accelerationFactor! < 1))) throw new Error('invalid_acceleration_parameters');
  if ((config.medicalAccelerationFactor === undefined) !== (config.medicalClassifications === undefined) || (config.medicalAccelerationFactor !== undefined && (!Number.isFinite(config.medicalAccelerationFactor) || config.medicalAccelerationFactor < 1 || !Array.isArray(config.medicalClassifications) || config.medicalClassifications.some(c => !c.system || !c.version || !Array.isArray(c.codes) || c.codes.some(code => typeof code !== 'string'))))) throw new Error('invalid_medical_acceleration_parameters');
  if ((config.governmentAdjustmentFactor === undefined) !== (config.governmentClassifications === undefined) || (config.governmentAdjustmentFactor !== undefined && (!Number.isFinite(config.governmentAdjustmentFactor) || config.governmentAdjustmentFactor <= 0 || config.governmentAdjustmentFactor > 1 || !Array.isArray(config.governmentClassifications) || config.governmentClassifications.some(c => !c.system || !c.version || !Array.isArray(c.codes) || c.codes.some(code => typeof code !== 'string'))))) throw new Error('invalid_government_adjustment_parameters');
  const scenarioFields = [config.scenarioGlobalFactor, config.scenarioResearchExposureCenter, config.scenarioResearchExposureSlope, config.scenarioEntertainmentFactor, config.scenarioEntertainmentClassifications, config.scenarioActorFactor, config.scenarioActorClassifications];
  if (scenarioFields.some(x => x !== undefined)) {
    const groupsValid = (groups: ClassificationGroup[] | undefined) => Array.isArray(groups) && groups.every(c => Boolean(c.system) && Boolean(c.version) && Array.isArray(c.codes) && c.codes.every(code => typeof code === 'string' && code.length > 0));
    if (scenarioFields.some(x => x === undefined) || !Number.isFinite(config.scenarioGlobalFactor) || config.scenarioGlobalFactor! <= 0 || !Number.isFinite(config.scenarioResearchExposureCenter) || config.scenarioResearchExposureCenter! < 0 || config.scenarioResearchExposureCenter! > 1 || !Number.isFinite(config.scenarioResearchExposureSlope) || config.scenarioResearchExposureSlope! < 0 || config.scenarioResearchExposureSlope! >= 1 || !Number.isFinite(config.scenarioEntertainmentFactor) || config.scenarioEntertainmentFactor! <= 0 || !groupsValid(config.scenarioEntertainmentClassifications) || !Number.isFinite(config.scenarioActorFactor) || config.scenarioActorFactor! <= 0 || !groupsValid(config.scenarioActorClassifications)) throw new Error('invalid_scenario_adjustment_parameters');
  }
  if ((config.scenarioAnthropicFloor === undefined) !== (config.scenarioAnthropicRange === undefined) || (config.scenarioAnthropicFloor !== undefined && (!Number.isFinite(config.scenarioAnthropicFloor) || config.scenarioAnthropicFloor <= 0 || !Number.isFinite(config.scenarioAnthropicRange) || config.scenarioAnthropicRange! < 0))) throw new Error('invalid_anthropic_adjustment_parameters');
  if ((config.scenarioBlsClampPercent === undefined) !== (config.scenarioBlsCoefficient === undefined) || (config.scenarioBlsClampPercent !== undefined && (!Number.isFinite(config.scenarioBlsClampPercent) || config.scenarioBlsClampPercent < 0 || !Number.isFinite(config.scenarioBlsCoefficient) || config.scenarioBlsCoefficient! < 0 || config.scenarioBlsCoefficient! * config.scenarioBlsClampPercent >= 1))) throw new Error('invalid_bls_adjustment_parameters');
  const training = jobs.filter(j => j.system === 'O*NET-SOC' && j.version === '31.0' && valid(j.observed) && j.koreanName !== null);
  const proxyUsable = sourceApproved && training.length === artifact.metadata.trainingCount && trainingSignature(jobs) === artifact.metadata.sourceTrainingSignature;
  const sorted = [...jobs].sort((a,b) => order(keyOf(a),keyOf(b)) || order(a.id,b.id));
  if (new Set(sorted.map(j => j.id)).size !== sorted.length || new Set(sorted.map(keyOf)).size !== sorted.length) throw new Error('duplicate_coverage_job');
  const results = new Map<string, CoverageValues>();
  const occupied = new Map<number, number>();
  const collides = (ms: number) => {
    const second = Math.floor(ms / 1000);
    return [second - 1, second, second + 1].some(slot => { const other = occupied.get(slot); return other !== undefined && Math.abs(other - ms) < 1000; });
  };
  const baselineMs = Date.parse(config.baselineAt);
  const yearMs = config.daysPerYear * 86400000;
  const constant = -Math.log1p(-config.crossingProbability);
  for (const job of sorted) {
    const key = keyOf(job);
    const proxy = proxyUsable ? artifact.occupations[key] : undefined;
    const proxyValid = proxy && job.koreanName === proxy.name && valid(proxy.score) && valid(proxy.similarity) && valid(proxy.strength) && (proxy.basis === 'name_proxy' || proxy.basis === 'default');
    const direct = sourceApproved && job.system === 'O*NET-SOC' && job.version === '31.0' && valid(job.observed);
    const basis: CoverageValues['basis'] = direct ? 'occupation' : proxyValid ? proxy!.basis : 'default';
    const exposure = direct ? job.observed! : proxyValid ? proxy!.score : config.defaultExposure;
    // Eligibility is based on the original directly linked research metric,
    // never a title proxy, hash adjustment or collision correction.
    const researchAccelerationFactor = direct && config.accelerationExposureThreshold !== undefined && exposure > config.accelerationExposureThreshold ? config.accelerationFactor! : 1;
    const medicalAccelerationFactor = config.medicalClassifications?.some(group => group.system === job.system && group.version === job.version && group.codes.includes(job.code)) ? config.medicalAccelerationFactor! : 1;
    const governmentAdjustmentFactor = config.governmentClassifications?.some(group => group.system === job.system && group.version === job.version && group.codes.includes(job.code)) ? config.governmentAdjustmentFactor! : 1;
    // v8 folds the previous independent time assumptions into the same hazard
    // used for every probability. These multipliers are scenario choices, not research estimates.
    const scenarioGlobalFactor = config.scenarioGlobalFactor ?? 1;
    const scenarioResearchTimeFactor = direct && config.scenarioResearchExposureCenter !== undefined ? 1 + config.scenarioResearchExposureSlope! * (config.scenarioResearchExposureCenter - job.observed!) : 1;
    const scenarioEntertainmentTimeFactor = config.scenarioEntertainmentClassifications?.some(group => group.system === job.system && group.version === job.version && group.codes.includes(job.code)) ? config.scenarioEntertainmentFactor! : 1;
    const scenarioActorFactor = config.scenarioActorClassifications?.some(group => group.system === job.system && group.version === job.version && group.codes.includes(job.code)) ? config.scenarioActorFactor! : 1;
    const anthropicObservation = job.anthropicObservation ?? null;
    if (anthropicObservation && (job.system !== 'O*NET-SOC' || job.version !== '31.0' || !/^\d{2}-\d{4}\.\d{2}$/.test(job.code) || anthropicObservation.socCode !== job.code.slice(0, 7) || anthropicObservation.mapping !== (job.code.endsWith('.00') ? 'soc_exact' : 'soc_group') || !Number.isFinite(anthropicObservation.value) || anthropicObservation.value < 0 || anthropicObservation.value > 1)) throw new Error('invalid_anthropic_link');
    const scenarioAnthropicFactor = anthropicObservation && config.scenarioAnthropicFloor !== undefined ? config.scenarioAnthropicFloor + config.scenarioAnthropicRange! * anthropicObservation.value : 1;
    const blsProjection = job.blsProjection ?? null;
    if (blsProjection && (job.system !== 'O*NET-SOC' || job.version !== '31.0' || blsProjection.onetCode !== job.code || blsProjection.relation !== 'official_crosswalk_soc_parent' || (blsProjection.changePercent !== null && !Number.isFinite(blsProjection.changePercent)))) throw new Error('invalid_bls_link');
    const scenarioBlsFactor = blsProjection?.changePercent != null && config.scenarioBlsClampPercent !== undefined ? 1 - config.scenarioBlsCoefficient! * Math.max(-config.scenarioBlsClampPercent, Math.min(config.scenarioBlsClampPercent, blsProjection.changePercent)) : 1;
    const hazardMultiplier = researchAccelerationFactor * medicalAccelerationFactor * governmentAdjustmentFactor * scenarioGlobalFactor * scenarioActorFactor * scenarioAnthropicFactor * scenarioBlsFactor / (scenarioResearchTimeFactor * scenarioEntertainmentTimeFactor);
    const jobConfig = { ...config, annualBaseHazard: config.annualBaseHazard * hazardMultiplier, annualExposureHazard: config.annualExposureHazard * hazardMultiplier };
    const minTarget = Date.parse(calculateScenario(jobConfig, 1).targetAt);
    const maxTarget = Date.parse(calculateScenario(jobConfig, 0).targetAt);
    const strength = proxyValid && basis === 'name_proxy' ? proxy!.strength : 0;
    const hash = Number.parseInt(createHash('sha256').update(key, 'utf8').digest('hex').slice(0, 8), 16) / 0xffffffff;
    const requestedDelta = direct ? 0 : (hash * 2 - 1) * config.syntheticMaxVariation * (1 - strength);
    const unadjustedInput = Math.max(0, Math.min(1, exposure + requestedDelta));
    const syntheticDelta = unadjustedInput - exposure;
    const unadjusted = calculateScenario(jobConfig, unadjustedInput);
    const originalMs = Date.parse(unadjusted.targetAt);
    let result = unadjusted;
    let effectiveExposure = unadjustedInput;
    if (collides(originalMs)) {
      let resolved = false;
      for (let distance = 1; distance <= sorted.length + 1 && !resolved; distance++) {
        for (const signed of [distance, -distance]) {
          const candidate = originalMs + signed * 1000;
          if (candidate < minTarget || candidate > maxTarget || collides(candidate)) continue;
          const derived = (constant * yearMs / (candidate - baselineMs) - jobConfig.annualBaseHazard) / jobConfig.annualExposureHazard;
          if (!Number.isFinite(derived) || derived < -1e-12 || derived > 1 + 1e-12) continue;
          const nextExposure = Math.min(1, Math.max(0, derived));
          const next = calculateScenario(jobConfig, nextExposure);
          if (collides(Date.parse(next.targetAt))) continue;
          result = next; effectiveExposure = nextExposure; resolved = true; break;
        }
      }
      if (!resolved) throw new Error('clock_collision_resolution_failed');
    }
    occupied.set(Math.floor(Date.parse(result.targetAt) / 1000), Date.parse(result.targetAt));
    const adjustmentSeconds = (Date.parse(result.targetAt) - originalMs) / 1000;
    results.set(job.id, { ...result, basis, exposure, syntheticDelta, effectiveExposure, adjustmentSeconds, proxySimilarity: proxyValid ? proxy!.similarity : null, clockAdjustment: 'collision-resolution', researchBased: direct || Boolean(proxyValid), hazardMultiplier, researchAccelerationFactor, medicalAccelerationFactor, governmentAdjustmentFactor, scenarioGlobalFactor, scenarioResearchTimeFactor, scenarioEntertainmentTimeFactor, scenarioActorFactor, anthropicObservation, scenarioAnthropicFactor, blsProjection, scenarioBlsFactor });
  }
  return results;
}

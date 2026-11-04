import type { CoverageJob, CoverageValues } from '@/lib/scenario-coverage';

export type TimerConfig = {
  version: string; researchExposureCenter: number; researchExposureSlope: number; entertainmentMultiplier: number;
  entertainmentClassifications: { system: string; version: string; codes: string[] }[];
};
export type TimerValues = CoverageValues & { timerModelVersion: string; timerResearchFactor: number; timerEntertainmentFactor: number; timerAdjustmentSeconds: number };
const order = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const key = (j: CoverageJob) => `${j.system}|${j.version}|${j.code}`;

/** Preserve all v6 probability data; adjust only the independently simulated timer. */
export function calculateTimers(config: TimerConfig, jobs: CoverageJob[], baseline: Map<string, CoverageValues>, sourceApproved: boolean): Map<string, TimerValues> {
  if (!config.version || !Number.isFinite(config.researchExposureCenter) || config.researchExposureCenter < 0 || config.researchExposureCenter > 1 || !Number.isFinite(config.researchExposureSlope) || config.researchExposureSlope < 0 || config.researchExposureSlope >= 1 || !Number.isFinite(config.entertainmentMultiplier) || config.entertainmentMultiplier <= 1 || !Array.isArray(config.entertainmentClassifications)) throw new Error('invalid_timer_parameters');
  if (config.entertainmentMultiplier * (1 - config.researchExposureSlope * (1 - config.researchExposureCenter)) <= 1) throw new Error('entertainment_must_be_delayed');
  const sorted = [...jobs].sort((a,b) => order(key(a),key(b)) || order(a.id,b.id));
  if (baseline.size !== sorted.length || new Set(sorted.map(j => j.id)).size !== sorted.length || new Set(sorted.map(key)).size !== sorted.length) throw new Error('invalid_timer_jobs');
  const candidates = sorted.map(job => {
    const value = baseline.get(job.id);
    if (!value) throw new Error('missing_timer_base');
    const research = sourceApproved && value.basis === 'occupation' && job.system === 'O*NET-SOC' && job.version === '31.0' && Number.isFinite(job.observed) && job.observed !== null && job.observed >= 0 && job.observed <= 1;
    const timerResearchFactor = research ? 1 + config.researchExposureSlope * (config.researchExposureCenter - job.observed!) : 1;
    const timerEntertainmentFactor = config.entertainmentClassifications.some(g => g.system === job.system && g.version === job.version && g.codes.includes(job.code)) ? config.entertainmentMultiplier : 1;
    const start = Date.parse(value.baselineAt), original = Date.parse(value.targetAt);
    const candidate = Math.round(start + (original - start) * timerResearchFactor * timerEntertainmentFactor);
    if (!Number.isFinite(start) || !Number.isFinite(original) || !Number.isFinite(candidate) || candidate <= start) throw new Error('invalid_timer_target');
    return { job, value, original, candidate, timerResearchFactor, timerEntertainmentFactor, unchanged: candidate === original };
  });
  const occupied = new Map<number, number>();
  const collides = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return [s-1,s,s+1].some(slot => { const other = occupied.get(slot); return other !== undefined && Math.abs(other - ms) < 1000; });
  };
  const result = new Map<string, TimerValues>();
  // Reserve unchanged timers first: a moved clock must never displace them.
  for (const row of [...candidates.filter(c => c.unchanged), ...candidates.filter(c => !c.unchanged)]) {
    let target = row.candidate;
    if (collides(target)) {
      let found = false;
      for (let distance = 1; distance <= sorted.length + 1 && !found; distance++) {
        for (const sign of [1,-1]) {
          const next = row.candidate + sign * distance * 1000;
          if (next <= Date.parse(row.value.baselineAt) || (row.timerEntertainmentFactor > 1 && next <= row.original) || collides(next)) continue;
          target = next; found = true; break;
        }
      }
      if (!found) throw new Error('timer_collision_resolution_failed');
    }
    if (row.unchanged && target !== row.original) throw new Error('unchanged_timer_collision');
    occupied.set(Math.floor(target / 1000), target);
    result.set(row.job.id, { ...row.value, targetAt: new Date(target).toISOString(), timerModelVersion: config.version, timerResearchFactor: row.timerResearchFactor, timerEntertainmentFactor: row.timerEntertainmentFactor, timerAdjustmentSeconds: (target - row.candidate) / 1000 });
  }
  return result;
}

type TimerCache = { configKey: string; value: Map<string, TimerValues> };
const host = globalThis as typeof globalThis & { scenarioTimerCache?: WeakMap<Map<string, CoverageValues>, TimerCache> };
export function cachedTimers(config: TimerConfig, jobs: CoverageJob[], baseline: Map<string, CoverageValues>, sourceApproved: boolean): Map<string, TimerValues> {
  const cache = host.scenarioTimerCache ??= new WeakMap();
  const configKey = JSON.stringify([config, sourceApproved, [...jobs].sort((a,b) => order(key(a),key(b)) || order(a.id,b.id))]);
  const current = cache.get(baseline);
  if (current?.configKey === configKey) return current.value;
  const value = calculateTimers(config,jobs,baseline,sourceApproved);
  cache.set(baseline,{configKey,value});
  return value;
}

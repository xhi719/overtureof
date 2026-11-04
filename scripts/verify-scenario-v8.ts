import { PrismaClient } from '@prisma/client';
import config from '../data/scenario/model-v8.json';
import previousConfig from '../data/scenario/model-v6.json';
import previousTimer from '../data/scenario/timer-v7.json';
import artifact from '../data/scenario/name-proxy-v1.json';
import { calculateCoverage, type CoverageJob, type ProxyArtifact } from '../lib/scenario-coverage';
import { calculateTimers } from '../lib/scenario-timer';
import { anthropicObservation } from '../lib/anthropic-observations';
import { blsProjection } from '../lib/bls-projections';

async function main() {
  const db = new PrismaClient();
  try {
    const source = await db.researchSource.findUnique({ where: { url: config.sourceUrl } });
    if (source?.status !== 'approved') throw new Error('approved_source_missing');
    const [items, metrics] = await Promise.all([
      db.occupation.findMany({ select: { id: true, code: true, classification: { select: { system: true, version: true } }, translations: { where: { locale: 'ko' }, select: { name: true } } } }),
      db.researchMetric.findMany({ where: { sourceId: source.id, kind: config.sourceMetricKind }, select: { id: true, occupationId: true, value: true }, orderBy: { id: 'asc' } }),
    ]);
    const byId = new Map<string, number | null>();
    for (const metric of metrics) if (!byId.has(metric.occupationId)) byId.set(metric.occupationId, metric.value);
    const jobs: CoverageJob[] = items.map(job => ({ id: job.id, code: job.code, system: job.classification.system, version: job.classification.version, koreanName: job.translations[0]?.name ?? null, observed: byId.get(job.id) ?? null, anthropicObservation: anthropicObservation(job.classification.system, job.classification.version, job.code), blsProjection: blsProjection(job.classification.system, job.classification.version, job.code) }));
    const old = calculateCoverage(previousConfig, jobs, artifact as ProxyArtifact, true);
    const oldTimers = calculateTimers(previousTimer, jobs, old, true);
    const current = calculateCoverage(config, jobs, artifact as ProxyArtifact, true);
    const reversed = calculateCoverage(config, [...jobs].reverse(), artifact as ProxyArtifact, true);
    const revoked = calculateCoverage(config, jobs, artifact as ProxyArtifact, false);
    const times: number[] = [], percentages = new Set<string>();
    let maxCrossingError = 0, actors = 0, changedProbability = 0, earlierTimer = 0, anthropicExact = 0, anthropicGroups = 0, blsMatched = 0, blsZero = 0, blsUnknown = 0;
    const baseline = Date.parse(config.baselineAt), yearMs = config.daysPerYear * 86400000;
    for (const job of jobs) {
      const result = current.get(job.id)!;
      if (!result || result.targetAt !== reversed.get(job.id)?.targetAt || result.probability !== reversed.get(job.id)?.probability) throw new Error('non_deterministic');
      if (!Number.isFinite(result.probability) || result.probability < 0 || result.probability > 1 || result.probabilities.some((p,i,a) => p.probability < 0 || p.probability > 1 || (i > 0 && p.probability < a[i-1].probability))) throw new Error('invalid_probability');
      const elapsed = (Date.parse(result.targetAt) - baseline) / yearMs;
      const hazard = result.hazardMultiplier * (config.annualBaseHazard + config.annualExposureHazard * result.effectiveExposure);
      maxCrossingError = Math.max(maxCrossingError, Math.abs(-Math.expm1(-hazard * elapsed) - config.crossingProbability));
      if (result.probability !== old.get(job.id)!.probability) changedProbability++;
      if (Date.parse(result.targetAt) < Date.parse(oldTimers.get(job.id)!.targetAt)) earlierTimer++;
      if (result.scenarioActorFactor > 1) { actors++; if (Date.parse(result.targetAt) >= Date.parse(oldTimers.get(job.id)!.targetAt)) throw new Error('actor_not_shorter'); }
      if (result.anthropicObservation?.mapping === 'soc_exact') anthropicExact++;
      if (result.anthropicObservation?.mapping === 'soc_group') anthropicGroups++;
      if (result.blsProjection) { blsMatched++; if (result.blsProjection.changePercent === 0) blsZero++; if (result.blsProjection.changePercent === null) blsUnknown++; }
      if (!result.anthropicObservation && result.scenarioAnthropicFactor !== 1) throw new Error('missing_anthropic_was_estimated');
      if (result.blsProjection?.changePercent == null && result.scenarioBlsFactor !== 1) throw new Error('missing_bls_was_estimated');
      if (job.system !== 'O*NET-SOC' && (result.anthropicObservation || result.blsProjection)) throw new Error('incorrect_cross_country_mapping');
      if (revoked.get(job.id)!.researchAccelerationFactor !== 1 || revoked.get(job.id)!.scenarioResearchTimeFactor !== 1) throw new Error('openai_revocation_failed');
      times.push(Date.parse(result.targetAt)); percentages.add((result.probability * 100).toFixed(1));
    }
    times.sort((a,b) => a-b);
    const minGapMs = Math.min(...times.slice(1).map((t,i) => t-times[i]));
    if (minGapMs < 1000 || maxCrossingError > 1e-9 || actors === 0 || earlierTimer !== jobs.length) throw new Error('v8_coverage_failed');
    console.log(JSON.stringify({ occupations: jobs.length, changedProbability, earlierTimer, actors, anthropicExact, anthropicGroups, blsMatched, blsZero, blsUnknown, uniqueSeconds: new Set(times.map(t=>Math.floor(t/1000))).size, minGapMs, uniqueDisplayedPercent: percentages.size, maxCrossingError }));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

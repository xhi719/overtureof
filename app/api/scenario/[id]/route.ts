import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/db';
import config from '@/data/scenario/model-v8.json';
import timerConfig from '@/data/scenario/timer-v9.json';
import probabilityConfig from '@/data/scenario/probability-v10.json';
import proxyData from '@/data/scenario/name-proxy-v1.json';
import { type ProxyArtifact } from '@/lib/scenario-coverage';
import { type ReportTimerJob } from '@/lib/scenario-timer-v9';
import { cachedReportTimers } from '@/lib/scenario-timer-v9-cache';
import { calculateConsistentProbability } from '@/lib/scenario-probability-v10';
import { anthropicRobotObservation } from '@/lib/anthropic-robot-exposure';
import { cachedCoverage } from '@/lib/scenario-cache';
import { anthropicObservation, AnthropicDatasetUnavailableError } from '@/lib/anthropic-observations';
import { blsProjection } from '@/lib/bls-projections';
import { resolveOccupationComponent } from '@/lib/occupation-components';
export const dynamic = 'force-dynamic';
const comparisonConfigId = createHash('sha256').update(JSON.stringify([config,timerConfig,probabilityConfig])).digest('hex');
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || id.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(id)) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  const requested = request.nextUrl.searchParams.get('locale') || 'ko';
  const locale = ['ko', 'en', 'zh-CN', 'zh-TW'].includes(requested) ? requested : 'ko';
  const componentId = request.nextUrl.searchParams.get('label');
  if (componentId !== null && !/^[a-z0-9_]{1,100}$/.test(componentId)) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  try {
    const snapshot = await prisma.$transaction(async tx => {
      const [occupation, jobs, source] = await Promise.all([
        tx.occupation.findUnique({ where: { id }, include: { classification: true, translations: { where: { locale: { in: [locale, 'ko', 'en'] } } }, aliases: { where: { locale: { in: [locale, 'ko'] } }, select: { locale: true, name: true } } } }),
        tx.occupation.findMany({ select: { id: true, code: true, classification: { select: { system: true, version: true } }, translations: { where: { locale: 'ko' }, select: { name: true } } } }),
        tx.researchSource.findUnique({ where: { url: config.sourceUrl }, select: { id: true, title: true, url: true, status: true } })
      ]);
      const metrics = source?.status === 'approved' ? await tx.researchMetric.findMany({ where: { sourceId: source.id, kind: config.sourceMetricKind }, select: { id: true, occupationId: true, value: true }, orderBy: { id: 'asc' } }) : [];
      return { occupation, jobs, source, metrics };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    const { occupation, source } = snapshot;
    if (!occupation) return NextResponse.json({ error: 'occupation_not_found' }, { status: 404 });
    const translated = occupation.translations.find(t => t.locale === locale) ?? occupation.translations.find(t => t.locale === 'ko') ?? occupation.translations.find(t => t.locale === 'en');
    if (!translated) { console.error('missing_occupation_translation', id, locale); return NextResponse.json({ error: 'missing_translation' }, { status: 500 }); }
    const component = componentId ? resolveOccupationComponent(componentId, occupation.classification.system, occupation.classification.version, occupation.code, locale, occupation.aliases) : null;
    if (componentId && !component) return NextResponse.json({ error: 'occupation_not_found' }, { status: 404 });
    const observed = new Map<string, number | null>();
    for (const metric of snapshot.metrics) if (!observed.has(metric.occupationId)) observed.set(metric.occupationId, metric.value);
    const jobs: ReportTimerJob[] = snapshot.jobs.map(job => ({ id: job.id, code: job.code, system: job.classification.system, version: job.classification.version, koreanName: job.translations[0]?.name ?? null, observed: observed.get(job.id) ?? null, anthropicObservation: anthropicObservation(job.classification.system, job.classification.version, job.code), blsProjection: blsProjection(job.classification.system, job.classification.version, job.code), robotObservation: anthropicRobotObservation(job.classification.system, job.classification.version, job.code) }));
    const approved = source?.status === 'approved';
    const baseline = cachedCoverage(config, jobs, proxyData as ProxyArtifact, approved);
    const timerValues = cachedReportTimers(timerConfig, jobs, baseline, proxyData as ProxyArtifact).get(id);
    if (!timerValues) { console.error('missing_scenario_occupation', id); return NextResponse.json({ error: 'operation_failed' }, { status: 500 }); }
    const values = calculateConsistentProbability(probabilityConfig, config, timerValues);
    const sourceVisible = values.researchBased && source?.status === 'approved';
    return NextResponse.json({ occupation: { id: occupation.id, code: occupation.code, name: component?.name ?? translated.name, officialName: translated.name, componentId: component?.id ?? null, classification: occupation.classification.system }, scenario: { ...values, event: 'illustrative_employment_displacement', modelId: probabilityConfig.id, modelVersion: probabilityConfig.version, comparisonConfigId, parameters: { annualBaseHazard: values.adjustedAnnualBaseHazard, annualExposureHazard: values.adjustedAnnualExposureHazard, defaultExposure: config.defaultExposure, daysPerYear: config.daysPerYear, eventEmploymentReduction: config.eventEmploymentReduction, syntheticMaxVariation: config.syntheticMaxVariation, accelerationExposureThreshold: config.accelerationExposureThreshold }, sourceUrl: sourceVisible ? source!.url : null, sourceTitle: sourceVisible ? source!.title : null, sourceStatus: sourceVisible ? source!.status : null } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AnthropicDatasetUnavailableError) {
      console.error('scenario_research_data_unavailable');
      return NextResponse.json({ error: 'scenario_data_unavailable' }, { status: 503 });
    }
    console.error('scenario_query_failed', error);
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 });
  }
}

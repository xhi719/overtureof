import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const requestedLocale = request.nextUrl.searchParams.get('locale') || 'en';
  const locale = ['ko','en','zh-CN','zh-TW'].includes(requestedLocale) ? requestedLocale : 'en';
  try {
    const row = await prisma.occupation.findUnique({ where: { id }, include: {
      classification: true, translations: true, tasks: true,
      metrics: { where: { source: { status: 'approved' } }, include: { source: true } },
      forecasts: { where: { status: 'approved' }, include: { model: true, history: true } }
    } });
    if (!row) return NextResponse.json({ error: 'occupation_not_found' }, { status: 404 });
    const translation = row.translations.find(t => t.locale === locale) ?? row.translations.find(t => t.locale === 'ko') ?? row.translations.find(t => t.locale === 'en');
    if (!translation) { console.error('missing_occupation_translation', id, locale); return NextResponse.json({ error: 'missing_translation' }, { status: 500 }); }
    const sourceIds = row.forecasts.flatMap(f => f.sourceId ? [f.sourceId] : []);
    const sources = await prisma.researchSource.findMany({ where: { id: { in: sourceIds }, status: 'approved' } });
    const candidates = row.forecasts.filter(f => {
      const validProbability = f.probability === null || (Number.isFinite(f.probability) && f.probability >= 0 && f.probability <= 1);
      const validBounds = (f.lowerBound === null || (f.lowerBound >= 0 && f.lowerBound <= 1)) && (f.upperBound === null || (f.upperBound >= 0 && f.upperBound <= 1)) && (f.lowerBound === null || f.upperBound === null || f.lowerBound <= f.upperBound) && (f.probability === null || f.lowerBound === null || f.lowerBound <= f.probability) && (f.probability === null || f.upperBound === null || f.probability <= f.upperBound);
      return validProbability && validBounds && f.horizonYear >= f.baselineYear && ((f.origin === 'model' && f.model?.validated && f.model.event === f.event) || (f.origin === 'research' && sources.some(s => s.id === f.sourceId)));
    });
    const badSeries = new Set<string>();
    const seriesKey = (f: typeof candidates[number]) => JSON.stringify([f.event, f.country, f.baselineYear, f.threshold, f.origin, f.modelId, f.sourceId]);
    const newest = new Map<string, typeof candidates[number]>();
    for (const f of candidates) { const key = JSON.stringify([seriesKey(f), f.horizonYear]); const previous = newest.get(key); if (!previous || (f.publishedAt?.getTime() ?? 0) > (previous.publishedAt?.getTime() ?? 0) || ((f.publishedAt?.getTime() ?? 0) === (previous.publishedAt?.getTime() ?? 0) && f.createdAt > previous.createdAt)) newest.set(key, f); }
    const ordered = [...newest.values()].sort((a,b) => a.horizonYear - b.horizonYear);
    const last = new Map<string, number>();
    for (const f of ordered) { const key = seriesKey(f); if (f.probability !== null) { if (last.has(key) && f.probability < last.get(key)!) badSeries.add(key); last.set(key, f.probability); } }
    const forecasts = ordered.filter(f => !badSeries.has(seriesKey(f))).map(f => ({ id: f.id, event: f.event, country: f.country, baselineYear: f.baselineYear, horizonYear: f.horizonYear, threshold: f.threshold, probability: f.probability, lowerBound: f.lowerBound, upperBound: f.upperBound, expectedAt: f.expectedAt, expectedYear: f.expectedYear, origin: f.origin, publishedAt: f.publishedAt, model: f.model ? { name: f.model.name, version: f.model.version } : null, source: sources.find(s => s.id === f.sourceId) ? { title: sources.find(s => s.id === f.sourceId)!.title, url: sources.find(s => s.id === f.sourceId)!.url } : null, history: f.history }));
    const metrics = row.metrics.map(m => ({ kind: m.kind, value: m.value, unit: m.unit, country: m.country, baselineYear: m.baselineYear, horizonYear: m.horizonYear, limitations: m.limitations, source: { title: m.source.title, url: m.source.url, institution: m.source.institution } }));
    const reportSources = [...row.metrics.map(m => m.source), ...sources.filter(s => forecasts.some(f => f.source?.url === s.url))];
    const reports = [...new Map(reportSources.map(s => [s.id, { title: s.title, url: s.url, institution: s.institution, publishedAt: s.publishedAt, limitations: s.limitations }])).values()];
    const tasks = row.tasks.filter(t => t.locale === locale || (t.locale === 'en' && !row.tasks.some(x => x.locale === locale)));
    return NextResponse.json({ occupation: { id: row.id, code: row.code, name: translation.name, description: translation.description, classification: row.classification.system, classificationVersion: row.classification.version, sourceUrl: row.sourceUrl, updatedAt: row.updatedAt, tasks, metrics, forecasts, reports } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { console.error('occupation_detail_failed', error); return NextResponse.json({ error: 'database_unavailable' }, { status: 503 }); }
}

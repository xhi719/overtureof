import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import ko from '../content/ko.json';
import hiddenSearch from '../data/translation/hidden-search-occupations.json';
import baselineModel from '../data/scenario/model-v8.json';
import timerModel from '../data/scenario/timer-v9.json';
import probabilityModel from '../data/scenario/probability-v10.json';
import proxyData from '../data/scenario/name-proxy-v1.json';
import { hiddenKsco8AncestorCodes, hiddenKsco8SplitParentCodes } from '../lib/occupation-search-visibility';
import { componentsFor, componentAliasName } from '../lib/occupation-components';
import { calculateCoverage, type ProxyArtifact } from '../lib/scenario-coverage';
import { calculateReportTimers, type ReportTimerJob } from '../lib/scenario-timer-v9';
import { calculateConsistentProbability } from '../lib/scenario-probability-v10';
import { anthropicObservation } from '../lib/anthropic-observations';
import { anthropicRobotObservation } from '../lib/anthropic-robot-exposure';
import { blsProjection } from '../lib/bls-projections';

// Only these pre-existing, public-facing strings are selected from the content store.
const contentKeys = [
  'site.name','site.description','nav.home','nav.search','hero.question','hero.searchLabel','hero.placeholder',
  'hero.categoryLabel','hero.allCategories','hero.submit','search.results','search.empty','search.close',
  'search.previous','search.next','search.page','search.onetMachineTranslation','detail.onetAttribution',
  'detail.onetDatabase','detail.onetLicense','classification.ksco','classification.onet','detail.back',
  'detail.years','detail.days','detail.hours','detail.minutes','detail.seconds','detail.notFound','detail.error',
  'detail.sharedClassification','common.unavailable','common.error','scenario.badge','scenario.probability',
  'scenario.modelTime','scenario.method','scenario.source','scenario.elapsed',
] as const;

type Entry = {
  id: string; code: string; name: string; classification: string; aliases: string[];
  componentId?: string; officialName?: string; probability: number; targetAt: string | null;
  horizonYear: number; sourceUrl: string | null;
};
const normalize = (s: string) => s.normalize('NFC').replace(/\s+/gu, '').toLocaleLowerCase();
const order = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const rank = (row: Entry) => (row.componentId ? 2 : 0) + (row.classification === 'KSCO' ? 0 : 1);

async function main() {
  const db = new PrismaClient();
  try {
    // Explicit selections avoid collecting survey sessions, responses, consents, logs or secrets.
    const { rows, metrics, source, localizations } = await db.$transaction(async tx => {
      const [rows, source, localizations] = await Promise.all([
        tx.occupation.findMany({ select: {
          id: true, code: true,
          classification: { select: { system: true, version: true } },
          translations: { where: { locale: { in: ['ko', 'en'] } }, select: { locale: true, name: true } },
          aliases: { where: { locale: { in: ['ko', 'en'] } }, select: { locale: true, name: true } },
        }}),
        tx.researchSource.findUnique({ where: { url: baselineModel.sourceUrl }, select: { id: true, url: true, status: true } }),
        tx.contentLocalization.findMany({ where: { locale: 'ko', contentKey: { key: { in: [...contentKeys] } } }, select: { value: true, contentKey: { select: { key: true } } } }),
      ]);
      const metrics = source?.status === 'approved' ? await tx.researchMetric.findMany({
        where: { sourceId: source.id, kind: baselineModel.sourceMetricKind },
        select: { id: true, occupationId: true, value: true }, orderBy: { id: 'asc' },
      }) : [];
      return { rows, metrics, source, localizations };
    });
    if (!source || source.status !== 'approved' || !rows.length) throw new Error('approved_data_unavailable');
    const observed = new Map<string, number | null>();
    for (const metric of metrics) if (!observed.has(metric.occupationId)) observed.set(metric.occupationId, metric.value);
    const jobs: ReportTimerJob[] = rows.map(row => ({
      id: row.id, code: row.code, system: row.classification.system, version: row.classification.version,
      koreanName: row.translations.find(t => t.locale === 'ko')?.name ?? null,
      observed: observed.get(row.id) ?? null,
      anthropicObservation: anthropicObservation(row.classification.system, row.classification.version, row.code),
      blsProjection: blsProjection(row.classification.system, row.classification.version, row.code),
      robotObservation: anthropicRobotObservation(row.classification.system, row.classification.version, row.code),
    }));
    const baseline = calculateCoverage(baselineModel, jobs, proxyData as ProxyArtifact, true);
    const timers = calculateReportTimers(timerModel, jobs, baseline, proxyData as ProxyArtifact);
    if (timers.size !== rows.length) throw new Error('incomplete_scenario_data');
    const hiddenCodes = new Set([...hiddenKsco8AncestorCodes, ...hiddenKsco8SplitParentCodes]);
    const excluded = new Set(hiddenSearch.items.map(item => JSON.stringify([item.system, item.version, item.code])));
    const entries: Entry[] = [];
    for (const row of rows) {
      const { system, version } = row.classification;
      if ((system === 'KSCO' && version === '8' && hiddenCodes.has(row.code)) || excluded.has(JSON.stringify([system, version, row.code]))) continue;
      const name = row.translations.find(t => t.locale === 'ko')?.name ?? row.translations.find(t => t.locale === 'en')?.name;
      if (!name) throw new Error('missing_occupation_translation');
      const timer = timers.get(row.id);
      if (!timer) throw new Error('missing_timer');
      const value = calculateConsistentProbability(probabilityModel, baselineModel, timer);
      if (!Number.isFinite(value.probability) || value.probability < 0 || value.probability > 1 || !Number.isInteger(value.horizonYear) || (value.targetAt !== null && !Number.isFinite(Date.parse(value.targetAt)))) throw new Error('invalid_scenario');
      const aliases = [...new Set([...row.translations.map(t => t.name), ...row.aliases.map(a => a.name)])].filter(Boolean).sort(order);
      const common = { id: row.id, code: row.code, classification: system, aliases, probability: value.probability,
        targetAt: value.targetAt, horizonYear: value.horizonYear, sourceUrl: value.researchBased ? source.url : null };
      const labels = componentsFor(system, version, row.code).flatMap(component => {
        const label = componentAliasName(component, 'ko', row.aliases);
        return label ? [{ component, label }] : [];
      });
      if (labels.length) for (const { component, label } of labels) entries.push({ ...common, name: label, componentId: component.id, officialName: name });
      else entries.push({ ...common, name });
    }
    entries.sort((a, b) => rank(a) - rank(b) || order(a.code, b.code) || order(a.id, b.id) || order(a.componentId ?? '', b.componentId ?? ''));
    const seen = new Set<string>();
    const unique = entries.filter(item => { const key = normalize(item.name); if (seen.has(key)) return false; seen.add(key); return true; });
    unique.sort((a, b) => order(a.code, b.code) || order(a.id, b.id) || order(a.componentId ?? '', b.componentId ?? ''));
    const content: Record<string, string> = {};
    for (const key of contentKeys) {
      const fallback = (ko as Record<string, string>)[key];
      const override = localizations.find(item => item.contentKey.key === key)?.value;
      const text = override ?? fallback;
      if (typeof text !== 'string' || !text.trim()) throw new Error(`missing_public_content:${key}`);
      content[key] = text;
    }
    const targetDir = resolve('.runtime/pages');
    await mkdir(targetDir, { recursive: true });
    const output = { generatedAt: new Date().toISOString(), content, occupations: unique };
    await writeFile(join(targetDir, 'snapshot.json'), JSON.stringify(output));
    console.log(JSON.stringify({ sourceOccupations: rows.length, publicSearchEntries: unique.length, generatedAt: output.generatedAt, target: '.runtime/pages/snapshot.json' }));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

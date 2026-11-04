import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';

type Exclusion = { code: string; english: string; korean: string; reason: string };
async function main() {
  if (!process.argv.includes('--apply')) throw new Error('Pass --apply after creating a full database backup.');
  const rows = JSON.parse(await readFile('data/translation/onet-31.0-exclusions.json', 'utf8')) as Exclusion[];
  if (!Array.isArray(rows) || rows.length === 0 || new Set(rows.map(r => r.code)).size !== rows.length || rows.some(r => !/^\d{2}-\d{4}\.\d{2}$/.test(r.code) || !r.english?.trim() || !r.korean?.trim() || !r.reason?.trim())) throw new Error('Invalid exclusion manifest');
  const db = new PrismaClient();
  try {
    const summary = await db.$transaction(async tx => {
      const source = await tx.occupationClassification.findUnique({ where: { system_version: { system: 'O*NET-SOC', version: '31.0' } } });
      if (!source) throw new Error('O*NET 31.0 classification not found');
      const jobs = await tx.occupation.findMany({ where: { classificationId: source.id, code: { in: rows.map(r => r.code) } }, include: { translations: true } });
      const byCode = new Map(jobs.map(j => [j.code, j]));
      for (const row of rows) {
        const job = byCode.get(row.code);
        if (!job) continue; // Already removed; the manifest remains the durable exclusion list.
        if (job.translations.find(t => t.locale === 'en')?.name !== row.english || job.translations.find(t => t.locale === 'ko')?.name !== row.korean) throw new Error(`Translation changed since review: ${row.code}`);
      }
      const ids = jobs.map(job => job.id);
      const [sessions, questionnaires, forecasts, crosswalks] = await Promise.all([
        tx.surveySession.count({ where: { occupationId: { in: ids } } }),
        tx.questionnaire.count({ where: { occupationId: { in: ids } } }),
        tx.forecastResult.count({ where: { occupationId: { in: ids } } }),
        tx.occupationCrosswalk.count({ where: { OR: [{ fromOccupationId: { in: ids } }, { toOccupationId: { in: ids } }] } })
      ]);
      if (sessions || questionnaires || forecasts || crosswalks) throw new Error('Protected dependent data exists; no records were deleted');
      const metrics = await tx.researchMetric.deleteMany({ where: { occupationId: { in: ids } } });
      const tasks = await tx.occupationTask.deleteMany({ where: { occupationId: { in: ids } } });
      const aliases = await tx.occupationAlias.deleteMany({ where: { occupationId: { in: ids } } });
      const translations = await tx.occupationTranslation.deleteMany({ where: { occupationId: { in: ids } } });
      const occupations = await tx.occupation.deleteMany({ where: { id: { in: ids }, classificationId: source.id } });
      if (occupations.count !== jobs.length) throw new Error('Unexpected deletion count');
      await tx.adminAuditLog.create({ data: { actor: 'local-edit', action: 'remove-unusable-translations', entity: 'occupations', entityId: source.id, details: { codes: jobs.map(r => r.code), occupations: occupations.count, metrics: metrics.count, tasks: tasks.count, aliases: aliases.count, translations: translations.count, manifest: 'data/translation/onet-31.0-exclusions.json' } } });
      return { occupations: occupations.count, metrics: metrics.count, tasks: tasks.count, aliases: aliases.count, translations: translations.count };
    }, { timeout: 60000 });
    console.log(JSON.stringify(summary));
  } finally { await db.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });

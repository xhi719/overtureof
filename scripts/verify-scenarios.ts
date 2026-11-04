import { PrismaClient } from '@prisma/client';
import config from '../data/scenario/model-v1.json';
import { calculateScenario } from '../lib/scenario';
const db = new PrismaClient();
async function main() {
  const [jobs, metrics] = await Promise.all([
    db.occupation.findMany({ select: { id: true, translations: { where: { locale: { in: ['ko','en'] } }, select: { locale: true } } } }),
    db.researchMetric.findMany({ where: { kind: config.sourceMetricKind, source: { status: 'approved', url: config.sourceUrl } }, select: { occupationId: true, value: true } })
  ]);
  const values = new Map<string, number>();
  for (const metric of metrics) {
    if (values.has(metric.occupationId) || metric.value === null || !Number.isFinite(metric.value) || metric.value < 0 || metric.value > 1) throw new Error('Invalid or duplicated approved research metric');
    values.set(metric.occupationId, metric.value);
  }
  let personal = 0, common = 0;
  for (const job of jobs) {
    if (!job.translations.length) throw new Error(`Occupation lacks fallback translation: ${job.id}`);
    const hasMetric = values.has(job.id); if (hasMetric) personal++; else common++;
    const result = calculateScenario(config, values.get(job.id) ?? config.defaultExposure);
    if (!Number.isFinite(result.probability) || result.probability < 0 || result.probability > 1 || !Number.isFinite(Date.parse(result.targetAt))) throw new Error(`Invalid scenario: ${job.id}`);
  }
  console.log(JSON.stringify({ occupations: jobs.length, occupationResearchInput: personal, commonAssumption: common, valid: true }));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());

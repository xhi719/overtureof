import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Original official O*NET 31.0 records only. No translated text or predictions are generated.
type Job = { onetsoc_code: string; title: string; description: string };
type Alias = { onetsoc_code: string; job_title: string };
type Task = { onetsoc_code: string; task_id: number; task: string };
const expected = {
  'occupation_data.json': '8eec5d2449c0b96a90fca0f67184b3bf76c15b3549c4f145adb48c3ae55f52f8',
  'job_titles.json': '862953f66de9675402a41380242374077af9dc266b1455bee325e953b079bf21',
  'task_statements.json': 'd48d985c2bcf39a8760c9ffac599cd12309d597d564856e4bb3e9759ee948545',
} as const;
async function load<T>(name: keyof typeof expected, table: string, count: number): Promise<T[]> {
  const raw = await readFile(path.join(process.cwd(), 'data', 'onet-31.0', name));
  const hash = createHash('sha256').update(raw).digest('hex');
  if (hash !== expected[name]) throw new Error(`Source hash mismatch: ${name}`);
  const input = JSON.parse(raw.toString('utf8')) as { table_id: string; row: T[] };
  if (input.table_id !== table || !Array.isArray(input.row) || input.row.length !== count) throw new Error(`Source table mismatch: ${name}`);
  return input.row;
}
async function main() {
  const jobs = await load<Job>('occupation_data.json', 'occupation_data', 1016);
  const aliases = await load<Alias>('job_titles.json', 'job_titles', 54269);
  const tasks = await load<Task>('task_statements.json', 'task_statements', 18838);
  const codes = new Set(jobs.map(j => j.onetsoc_code));
  if (codes.size !== jobs.length || jobs.some(j => !/^\d{2}-\d{4}\.\d{2}$/.test(j.onetsoc_code) || !j.title?.trim() || !j.description?.trim())) throw new Error('Invalid or duplicate official occupation records');
  const aliasesSeen = new Set<string>();
  for (const a of aliases) {
    if (!codes.has(a.onetsoc_code) || !a.job_title?.trim()) throw new Error('Invalid official job title record');
    const k = JSON.stringify([a.onetsoc_code, a.job_title]);
    if (aliasesSeen.has(k)) throw new Error('Duplicate official job title');
    aliasesSeen.add(k);
  }
  const taskKeys = new Set<string>();
  for (const task of tasks) {
    const key = JSON.stringify([task.onetsoc_code, task.task_id]);
    if (!codes.has(task.onetsoc_code) || !Number.isInteger(task.task_id) || !task.task?.trim() || taskKeys.has(key)) throw new Error('Invalid or duplicate task');
    taskKeys.add(key);
  }
  if (process.argv.includes('--validate-only')) { console.log(`Validated ${jobs.length} occupations, ${aliases.length} job titles and ${tasks.length} tasks.`); return; }
  const exclusions = JSON.parse(await readFile('data/translation/onet-31.0-exclusions.json', 'utf8')) as { code: string }[];
  const excludedCodes = new Set(exclusions.map(x => x.code));
  if (excludedCodes.size !== exclusions.length || exclusions.some(x => !codes.has(x.code))) throw new Error('Invalid occupation exclusion list');
  const activeJobs = jobs.filter(j => !excludedCodes.has(j.onetsoc_code));
  const activeAliases = aliases.filter(a => !excludedCodes.has(a.onetsoc_code));
  const activeTasks = tasks.filter(t => !excludedCodes.has(t.onetsoc_code));
  const db = new PrismaClient();
  try {
    await db.$transaction(async tx => {
      const classification = await tx.occupationClassification.upsert({
        where: { system_version: { system: 'O*NET-SOC', version: '31.0' } },
        create: { system: 'O*NET-SOC', version: '31.0', sourceUrl: 'https://www.onetcenter.org/database.html', expectedCount: jobs.length }, update: {},
      });
      await tx.occupation.createMany({ data: activeJobs.map(j => ({ classificationId: classification.id, code: j.onetsoc_code, sourceUrl: `https://www.onetonline.org/link/summary/${j.onetsoc_code}` })), skipDuplicates: true });
      const stored = await tx.occupation.findMany({ where: { classificationId: classification.id }, select: { id: true, code: true } });
      const idByCode = new Map(stored.map(j => [j.code, j.id]));
      if (activeJobs.some(j => !idByCode.has(j.onetsoc_code))) throw new Error('Occupation import incomplete');
      await tx.occupationTranslation.createMany({ data: activeJobs.map(j => ({ occupationId: idByCode.get(j.onetsoc_code)!, locale: 'en', name: j.title, description: j.description })), skipDuplicates: true });
      for (let i = 0; i < activeAliases.length; i += 1000) {
        await tx.occupationAlias.createMany({ data: activeAliases.slice(i, i + 1000).map(a => ({ occupationId: idByCode.get(a.onetsoc_code)!, locale: 'en', name: a.job_title })), skipDuplicates: true });
      }
      for (let i = 0; i < activeTasks.length; i += 1000) {
        await tx.occupationTask.createMany({ data: activeTasks.slice(i, i + 1000).map(task => ({ id: `onet31-${createHash('sha256').update(`${task.onetsoc_code}:${task.task_id}`).digest('hex').slice(0, 24)}`, occupationId: idByCode.get(task.onetsoc_code)!, locale: 'en', description: task.task, category: 'general', sourceUrl: `https://www.onetonline.org/link/summary/${task.onetsoc_code}` })), skipDuplicates: true });
      }
      await tx.adminAuditLog.create({ data: { actor: 'local-import', action: 'import', entity: 'occupation_classification', entityId: classification.id, details: { release: '31.0', occupations: activeJobs.length, jobTitles: activeAliases.length, tasks: activeTasks.length, excluded: excludedCodes.size, tasksSha256: expected['task_statements.json'], occupationSha256: expected['occupation_data.json'], jobTitlesSha256: expected['job_titles.json'] } } });
    }, { timeout: 180000, maxWait: 10000 });
    console.log(`Imported ${activeJobs.length} O*NET 31.0 occupations, ${activeAliases.length} job titles and ${activeTasks.length} task statements; excluded ${excludedCodes.size}.`);
  } finally { await db.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });

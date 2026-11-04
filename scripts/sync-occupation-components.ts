import { PrismaClient } from '@prisma/client';
import { occupationComponents } from '../lib/occupation-components';

const db = new PrismaClient();
async function main() {
  await db.$transaction(async tx => {
    const parentKey = (system: string, version: string, code: string) => `${system}|${version}|${code}`;
    const parents = [...new Map(occupationComponents.map(item => [parentKey(item.system, item.version, item.code), item])).values()];
    const jobs = await tx.occupation.findMany({ where: { OR: parents.map(item => ({ classification: { system: item.system, version: item.version }, code: item.code })) }, select: { id: true, code: true, classification: { select: { system: true, version: true } } } });
    const byCode = new Map(jobs.map(job => [parentKey(job.classification.system, job.classification.version, job.code), job.id]));
    if (byCode.size !== parents.length) throw new Error('component_parent_missing');
    const aliases = occupationComponents.flatMap(item => Object.entries(item.names).map(([locale, name]) => ({ occupationId: byCode.get(parentKey(item.system, item.version, item.code))!, locale, name })));
    const inserted = await tx.occupationAlias.createMany({ data: aliases, skipDuplicates: true });
    await tx.adminAuditLog.create({ data: { actor: 'local-edit', action: 'sync-reviewed-components', entity: 'occupation_aliases', details: { manifest: 'data/translation/occupation-components.json', labels: occupationComponents.length, parents: parents.length, inserted: inserted.count } } });
    console.log(JSON.stringify({ labels: occupationComponents.length, parents: parents.length, inserted: inserted.count }));
  });
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());

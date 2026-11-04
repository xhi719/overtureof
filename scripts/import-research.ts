import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

type Source = { title: string; authors: string; institution: string; publishedAt: string; country: string | null; method: string | null; sampleSize: number | null; url: string; license: string | null; limitations: string | null };
async function main() {
  const sources = JSON.parse((await readFile(path.join(process.cwd(), 'data/research/sources.json'), 'utf8')).replace(/^\uFEFF/, '')) as Source[];
  if (!Array.isArray(sources) || sources.length !== 5 || new Set(sources.map(s => s.url)).size !== sources.length) throw new Error('Invalid or duplicated research sources');
  for (const source of sources) {
    const url = new URL(source.url);
    if (url.protocol !== 'https:' || !['www.ilo.org', 'www.oecd.org'].includes(url.hostname) || !source.title?.trim() || !source.authors?.trim() || !source.institution?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(source.publishedAt) || Number.isNaN(Date.parse(source.publishedAt))) throw new Error(`Invalid research source: ${source.url}`);
  }
  if (process.argv.includes('--validate-only')) { console.log(`Validated ${sources.length} source records.`); return; }
  const db = new PrismaClient();
  try {
    let created = 0;
    await db.$transaction(async tx => {
      for (const source of sources) {
        const existing = await tx.researchSource.findUnique({ where: { url: source.url }, select: { id: true } });
        if (existing) continue;
        const record = await tx.researchSource.create({ data: { ...source, publishedAt: new Date(`${source.publishedAt}T00:00:00Z`), status: 'pending' } });
        await tx.adminAuditLog.create({ data: { actor: 'local-import', action: 'import-pending', entity: 'research_source', entityId: record.id, details: { url: source.url } } });
        created++;
      }
    });
    console.log(`Created ${created} pending records; ${sources.length - created} pre-existing records preserved.`);
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

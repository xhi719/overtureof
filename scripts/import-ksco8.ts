import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

type Entry = { code: string; name: string };
type Dataset = { system: string; version: string; sourceUrl: string; sourceSha256: string; items: Entry[] };
const dataSha = '1b9e3b2ee40a1e2ff682e67ec0f376ddc03fd78594fdc8946a5ad88e225cbab0';
const sourceSha = '9d344859fc201e23b2270bb5667fe77636708c08aa5957e800786e03705396a1';
const sourceUrl = 'https://mods.go.kr/board.es?act=view&bid=107&list_no=431582&mid=a10403040000';
async function main() {
  const raw = await readFile(path.join(process.cwd(), 'data/ksco8/classification.json'));
  if (createHash('sha256').update(raw).digest('hex') !== dataSha) throw new Error('KSCO normalized file digest mismatch');
  const dataset = JSON.parse(raw.toString('utf8')) as Dataset;
  if (dataset.system !== 'KSCO' || dataset.version !== '8' || dataset.sourceSha256 !== sourceSha || dataset.sourceUrl !== sourceUrl || !Array.isArray(dataset.items)) throw new Error('Unexpected KSCO source');
  const counts = new Map<number, number>(); const codes = new Set<string>();
  for (const item of dataset.items) {
    if (!/^(?:[1-9]\d*|A\d*)$/.test(item.code) || !item.name?.trim() || codes.has(item.code)) throw new Error('Invalid or duplicate classification code');
    codes.add(item.code); counts.set(item.code.length, (counts.get(item.code.length) || 0) + 1);
  }
  if (dataset.items.length !== 1999 || [10,57,167,495,1270].some((count, i) => counts.get(i + 1) !== count) || dataset.items.some(item => item.code.length > 1 && !codes.has(item.code.slice(0,-1)))) throw new Error('Classification coverage or hierarchy mismatch');
  if (process.argv.includes('--validate-only')) { console.log(`Validated ${dataset.items.length} KSCO-8 official classification entries`); return; }
  const db = new PrismaClient();
  try {
    await db.$transaction(async tx => {
      const classification = await tx.occupationClassification.upsert({ where: { system_version: { system: 'KSCO', version: '8' } }, create: { system:'KSCO', version:'8', sourceUrl, expectedCount: dataset.items.length, publishedAt: new Date('2024-07-01T00:00:00Z') }, update: {} });
      await tx.occupation.createMany({ data: dataset.items.map(item => ({ classificationId: classification.id, code: item.code, sourceUrl })), skipDuplicates: true });
      const stored = await tx.occupation.findMany({ where: { classificationId: classification.id }, select: { id:true, code:true, translations: { where: {locale: 'ko'}, select: {name:true} } } });
      const idByCode = new Map(stored.map(item => [item.code, item]));
      if (stored.length !== dataset.items.length || dataset.items.some(item => !idByCode.has(item.code) || (idByCode.get(item.code)!.translations[0] && idByCode.get(item.code)!.translations[0].name !== item.name))) throw new Error('Existing KSCO records conflict with the official notice; manual review required');
      await tx.occupationTranslation.createMany({ data: dataset.items.map(item => ({ occupationId: idByCode.get(item.code)!.id, locale:'ko', name:item.name })), skipDuplicates: true });
      await tx.adminAuditLog.create({ data: { actor:'local-import', action:'import', entity:'occupation_classification', entityId:classification.id, details: { officialNotice:'2024-328', sourceSha256:sourceSha, normalizedSha256:dataSha, entries:dataset.items.length, locale:'ko' } } });
    }, { timeout:180000, maxWait:10000 });
    console.log(`Imported ${dataset.items.length} official KSCO-8 entries`);
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

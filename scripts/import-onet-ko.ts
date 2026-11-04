import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
type Row = { code: string; english: string; korean: string; manuallyCorrected: boolean };
async function main() {
  const bytes = await readFile('data/translation/onet-31.0-ko.json');
  const rows = JSON.parse(bytes.toString('utf8')) as Row[];
  const original = JSON.parse(await readFile('data/onet-31.0/occupation_data.json', 'utf8')) as { row: { onetsoc_code: string; title: string }[] };
  const originals = new Map(original.row.map(row => [row.onetsoc_code, row.title]));
  if (rows.length !== 1016 || originals.size !== 1016 || new Set(rows.map(r => r.code)).size !== 1016 || rows.some(r => originals.get(r.code) !== r.english || !r.korean.trim() || /[A-Za-z]/.test(r.korean) || !/[가-힣]/.test(r.korean))) throw new Error('Translation integrity validation failed');
  if (process.argv.includes('--validate-only')) { console.log(`Validated ${rows.length} draft Korean titles.`); return; }
  const exclusions = JSON.parse(await readFile('data/translation/onet-31.0-exclusions.json', 'utf8')) as { code: string }[];
  const excludedCodes = new Set(exclusions.map(x => x.code));
  if (excludedCodes.size !== exclusions.length || exclusions.some(x => !originals.has(x.code))) throw new Error('Invalid occupation exclusion list');
  const activeRows = rows.filter(row => !excludedCodes.has(row.code));
  const db = new PrismaClient();
  try {
    const result = await db.$transaction(async tx => {
      const source = await tx.occupationClassification.findUnique({ where: { system_version: { system: 'O*NET-SOC', version: '31.0' } } });
      if (!source) throw new Error('Import O*NET 31.0 first');
      const jobs = await tx.occupation.findMany({ where: { classificationId: source.id }, select: { id: true, code: true } });
      const ids = new Map(jobs.map(j => [j.code, j.id]));
      if (jobs.length !== activeRows.length || activeRows.some(r => !ids.has(r.code))) throw new Error('Database occupations do not match source');
      const inserted = await tx.occupationTranslation.createMany({ data: activeRows.map(r => ({ occupationId: ids.get(r.code)!, locale: 'ko', name: r.korean })), skipDuplicates: true });
      await tx.adminAuditLog.create({ data: { actor: 'local-import', action: 'import', entity: 'occupation_translation', entityId: source.id, details: { language: 'ko', total: activeRows.length, excluded: excludedCodes.size, inserted: inserted.count, nature: 'provisional_machine_translation_with_partial_manual_corrections', original: 'https://www.onetcenter.org/database.html', model: 'Helsinki-NLP OPUS-MT eng-kor transformer-big, converted to CTranslate2', modelLicense: 'CC-BY-4.0', modelSource: 'https://huggingface.co/Unbakedcookie/live-translator-models', sha256: createHash('sha256').update(bytes).digest('hex') } } });
      return inserted.count;
    }, {timeout:60000});
    console.log(`Inserted ${result} of ${activeRows.length} draft Korean translations; excluded ${excludedCodes.size} occupations; existing translations were preserved.`);
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

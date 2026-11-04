import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const csvHash = '40c74f53de40aec91c0017d80690cbba915f83a8bb414bcf2f884692f1749acb';
const jsonHash = '5cda1c5c33f9b5b727ffc59695d7a0b12968dae4b393e5ef441f2ef237b025ae';
const sha = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');
type RecordData = { code: string; title: string; values: Record<string, string> };
async function main() {
  const csv = await readFile('data/openai-gpts-2023/occ_level.csv');
  const raw = await readFile('data/openai-gpts-2023/normalized.json');
  if (sha(csv) !== csvHash || sha(raw) !== jsonHash) throw new Error('Source data checksum mismatch');
  const input = JSON.parse(raw.toString('utf8')) as { sourceSha256: string; records: RecordData[] };
  if (input.sourceSha256 !== csvHash || input.records.length !== 923 || new Set(input.records.map(x => x.code)).size !== 923) throw new Error('Unexpected record count');
  const fields = ['dv_rating_alpha','dv_rating_beta','dv_rating_gamma','human_rating_alpha','human_rating_beta','human_rating_gamma'];
  for (const item of input.records) for (const field of fields) {
    const value = Number(item.values[field]);
    if (!item.values[field] || !Number.isFinite(value) || value < 0 || value > 1) throw new Error('Invalid raw exposure score');
  }
  const exclusions = JSON.parse(await readFile('data/translation/onet-31.0-exclusions.json', 'utf8')) as { code: string }[];
  const excludedCodes = new Set(exclusions.map(x => x.code));
  if (excludedCodes.size !== exclusions.length) throw new Error('Duplicate occupation exclusions');
  const activeRecords = input.records.filter(item => !excludedCodes.has(item.code));
  const db = new PrismaClient();
  try {
    await db.$transaction(async tx => {
      const occupations = await tx.occupation.findMany({ where: { classification: { system: 'O*NET-SOC', version: '31.0' }, code: { in: activeRecords.map(x => x.code) } }, select: { id: true, code: true, translations: { where: { locale: 'en' }, select: { name: true } } } });
      const byCode = new Map(occupations.map(o => [o.code, o]));
      for (const item of activeRecords) {
        const occupation=byCode.get(item.code);
        if (!occupation || occupation.translations[0]?.name.toLowerCase() !== item.title.toLowerCase()) throw new Error(`Occupation mismatch: ${item.code}`);
      }
      const url='https://openai.com/index/gpts-are-gpts/';
      const source=await tx.researchSource.upsert({ where: { url }, create: {
        url, title:'GPTs are GPTs: An early look at the labor market impact potential of large language models',
        institution:'OpenAI, OpenResearch and University of Pennsylvania', authors:'Tyna Eloundou, Sam Manning, Pamela Mishkin, Daniel Rock', publishedAt:new Date('2023-03-17T00:00:00Z'), country:'US',
        method:'Human and GPT-4 ratings of task exposure, aggregated by O*NET occupation; alpha E1, beta E1 + 0.5 E2, gamma E1 + E2.',
        license:'MIT license; source repository https://github.com/openai/GPTs-are-GPTs',
        limitations:'Potential task exposure is not the probability that an occupation will be replaced, nor a forecast of actual adoption or job loss.', status:'pending'
      }, update:{} });
      const rows=activeRecords.flatMap(item => fields.map(field => ({
        id:`openai23-${sha(`${item.code}:${field}`).slice(0,24)}`,
        sourceId:source.id, occupationId:byCode.get(item.code)!.id, kind:`ai_exposure_${field}`, value:Number(item.values[field]), unit:'score_0_1', country:'US',
        originalText:item.values[field], limitations:'Task exposure score, not a displacement probability or an event forecast.'
      })));
      let inserted=0;
      for (let i=0;i<rows.length;i+=1000) inserted+=(await tx.researchMetric.createMany({ data: rows.slice(i,i+1000), skipDuplicates:true })).count;
      if (inserted) await tx.adminAuditLog.create({ data:{ actor:'local-import', action:'import-pending', entity:'research_metrics', entityId:source.id, details:{csvSha256:csvHash, occupations:activeRecords.length, metrics:inserted, classification:'O*NET-SOC 31.0'} } });
      console.log(JSON.stringify({ matchedOccupations:activeRecords.length, excludedOccupations:input.records.length-activeRecords.length, insertedMetrics:inserted, sourceStatus:source.status, forecastsCreated:0 }));
    },{timeout:180000,maxWait:10000});
  } finally { await db.$disconnect(); }
}
main().catch(e=>{console.error(e);process.exitCode=1});

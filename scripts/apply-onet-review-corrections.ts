import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
const db = new PrismaClient();
async function main() {
  const corrections = JSON.parse(await readFile('data/translation/review-corrections-20261031.json','utf8')) as {code:string;old:string;new:string}[];
  await db.$transaction(async tx => {
    const classification = await tx.occupationClassification.findUniqueOrThrow({where:{system_version:{system:'O*NET-SOC',version:'31.0'}}});
    for(const c of corrections) {
      const occupation = await tx.occupation.findUniqueOrThrow({where:{classificationId_code:{classificationId:classification.id,code:c.code}}});
      const result = await tx.occupationTranslation.updateMany({where:{occupationId:occupation.id,locale:'ko',name:c.old},data:{name:c.new}});
      if(result.count !== 1) throw new Error(`Translation changed independently: ${c.code}`);
      await tx.adminAuditLog.create({data:{actor:'local-review',action:'correct',entity:'occupation_translation',entityId:occupation.id,details:{locale:'ko',code:c.code,previous:c.old,corrected:c.new}}});
    }
  });
  const wanted = JSON.parse(await readFile('data/translation/onet-31.0-ko.json','utf8')) as {code:string;korean:string}[];
  const actual = await db.occupation.findMany({where:{classification:{system:'O*NET-SOC',version:'31.0'}},include:{translations:{where:{locale:'ko'}}}});
  const byCode = new Map(actual.map(row => [row.code,row.translations[0]?.name]));
  const mismatch = wanted.filter(row => byCode.get(row.code)!==row.korean);
  if (mismatch.length || byCode.size!==wanted.length) throw new Error(`Verification mismatches: ${mismatch.length}`);
  console.log(`Corrected ${corrections.length}; all ${wanted.length} translations match source file.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>db.$disconnect());

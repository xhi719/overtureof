import { PrismaClient } from '@prisma/client';
async function main() {
const db = new PrismaClient();
try {
 const c = await db.occupationClassification.findUnique({where:{system_version:{system:'KSCO',version:'8'}}});
 if (!c) throw new Error('KSCO missing');
 const entries = await db.occupation.findMany({where:{classificationId:c.id},select:{code:true,translations:{where:{locale:'ko'},select:{name:true}}}});
 const levels = Object.fromEntries([1,2,3,4,5].map(n => [n,entries.filter(x=>x.code.length===n).length]));
 const names = Object.fromEntries(entries.filter(x=>['43199','4321','77190'].includes(x.code)).map(x=>[x.code,x.translations[0]?.name]));
 console.log(JSON.stringify({total:entries.length,levels,ko:entries.filter(e=>e.translations.length).length,names}));
} finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

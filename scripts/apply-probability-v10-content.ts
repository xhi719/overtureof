import { PrismaClient } from '@prisma/client';
import ko from '../content/ko.json';
import en from '../content/en.json';
import zhCN from '../content/zh-CN.json';
import zhTW from '../content/zh-TW.json';

const db=new PrismaClient();
const copy:Record<string,Record<string,string>>={ko,en,'zh-CN':zhCN,'zh-TW':zhTW};
const names=['method.timerV10','method.timerV10Assumptions','method.timerV10Collision'];
async function main(){
 await db.$transaction(async tx=>{
  for(const name of names){
   const key=await tx.contentKey.upsert({where:{key:name},create:{key:name},update:{}});
   for(const [locale,content] of Object.entries(copy)){
    if(!content[name])throw new Error('missing_probability_translation');
    const existing=await tx.contentLocalization.findUnique({where:{contentKeyId_locale:{contentKeyId:key.id,locale}}});
    if(existing)continue;
    const row=await tx.contentLocalization.create({data:{contentKeyId:key.id,locale,value:content[name]}});
    await tx.adminAuditLog.create({data:{actor:'local-edit',action:'create',entity:'content_localization',entityId:row.id,details:{key:name,locale}}});
   }
  }
 });
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>db.$disconnect());

import { PrismaClient } from '@prisma/client';
import model from '../data/scenario/model-v8.json';
import timer from '../data/scenario/timer-v9.json';
import artifact from '../data/scenario/name-proxy-v1.json';
import { calculateCoverage, type ProxyArtifact } from '../lib/scenario-coverage';
import { calculateReportTimers, type ReportTimerJob } from '../lib/scenario-timer-v9';
import { anthropicObservation } from '../lib/anthropic-observations';
import { anthropicRobotObservation } from '../lib/anthropic-robot-exposure';
import { blsProjection } from '../lib/bls-projections';

async function main() {
 const db=new PrismaClient();
 try {
  const source=await db.researchSource.findUnique({where:{url:model.sourceUrl}});
  if(source?.status!=='approved')throw new Error('approved_source_missing');
  const [rows,metrics]=await Promise.all([
   db.occupation.findMany({select:{id:true,code:true,classification:{select:{system:true,version:true}},translations:{where:{locale:'ko'},select:{name:true}}}}),
   db.researchMetric.findMany({where:{sourceId:source.id,kind:model.sourceMetricKind},select:{id:true,occupationId:true,value:true},orderBy:{id:'asc'}})
  ]);
  const observed=new Map<string,number|null>();for(const row of metrics)if(!observed.has(row.occupationId))observed.set(row.occupationId,row.value);
  const jobs:ReportTimerJob[]=rows.map(row=>({id:row.id,code:row.code,system:row.classification.system,version:row.classification.version,koreanName:row.translations[0]?.name??null,observed:observed.get(row.id)??null,anthropicObservation:anthropicObservation(row.classification.system,row.classification.version,row.code),blsProjection:blsProjection(row.classification.system,row.classification.version,row.code),robotObservation:anthropicRobotObservation(row.classification.system,row.classification.version,row.code)}));
  const original=calculateCoverage(model,jobs,artifact as ProxyArtifact,true);
  const revised=calculateReportTimers(timer,jobs,original,artifact as ProxyArtifact);
  const reversed=calculateReportTimers(timer,[...jobs].reverse(),original,artifact as ProxyArtifact);
  if(revised.size!==jobs.length)throw new Error('missing_timer');
  let earlier=0,later=0,unchanged=0,robot=0,noEvidence=0;const times:number[]=[];
  for(const job of jobs){
   const before=original.get(job.id)!,after=revised.get(job.id)!;
   if(!after||after.targetAt!==reversed.get(job.id)?.targetAt)throw new Error('non_deterministic');
   if(after.probability!==before.probability||JSON.stringify(after.probabilities)!==JSON.stringify(before.probabilities))throw new Error('probability_changed');
   if(after.originalTargetAt!==before.targetAt||after.timerProbabilityAligned!==false)throw new Error('invalid_timer_provenance');
   if(after.timerEvidence.robotics){robot++;if(job.system!=='O*NET-SOC'||after.timerEvidence.robotics.value!==job.robotObservation?.value)throw new Error('invalid_robot_mapping');}
   if(Object.values(after.timerEvidence).every(v=>v===null)){noEvidence++;if(after.targetAt!==before.targetAt)throw new Error('unsupported_timer_changed');}
   const delta=Date.parse(after.targetAt)-Date.parse(before.targetAt);
   if(!Number.isFinite(delta))throw new Error('invalid_timer');
   if(delta<0)earlier++;else if(delta>0)later++;else unchanged++;
   times.push(Date.parse(after.targetAt));
  }
  times.sort((a,b)=>a-b);const minimumGapMs=Math.min(...times.slice(1).map((value,i)=>value-times[i]));
  if(minimumGapMs<1000||earlier===0||later===0)throw new Error('invalid_distribution');
  console.log(JSON.stringify({occupations:jobs.length,earlier,later,unchanged,noEvidence,robot,minimumGapMs,probabilitiesUnchanged:true,deterministic:true}));
 } finally {await db.$disconnect();}
}
main().catch(error=>{console.error(error);process.exitCode=1});

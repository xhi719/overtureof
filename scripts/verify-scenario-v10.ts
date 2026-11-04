import {PrismaClient} from '@prisma/client';
import baselineModel from '../data/scenario/model-v8.json';
import timerModel from '../data/scenario/timer-v9.json';
import probabilityModel from '../data/scenario/probability-v10.json';
import artifact from '../data/scenario/name-proxy-v1.json';
import {calculateCoverage,type ProxyArtifact} from '../lib/scenario-coverage';
import {calculateReportTimers,type ReportTimerJob} from '../lib/scenario-timer-v9';
import {calculateConsistentProbability} from '../lib/scenario-probability-v10';
import {anthropicObservation} from '../lib/anthropic-observations';
import {anthropicRobotObservation} from '../lib/anthropic-robot-exposure';
import {blsProjection} from '../lib/bls-projections';

async function main(){
 const db=new PrismaClient();
 try{
  const source=await db.researchSource.findUnique({where:{url:baselineModel.sourceUrl}});
  if(source?.status!=='approved')throw new Error('approved_source_missing');
  const [rows,metrics]=await Promise.all([
   db.occupation.findMany({select:{id:true,code:true,classification:{select:{system:true,version:true}},translations:{where:{locale:'ko'},select:{name:true}}}}),
   db.researchMetric.findMany({where:{sourceId:source.id,kind:baselineModel.sourceMetricKind},select:{id:true,occupationId:true,value:true},orderBy:{id:'asc'}})
  ]);
  const observed=new Map<string,number|null>();for(const row of metrics)if(!observed.has(row.occupationId))observed.set(row.occupationId,row.value);
  const jobs:ReportTimerJob[]=rows.map(row=>({id:row.id,code:row.code,system:row.classification.system,version:row.classification.version,koreanName:row.translations[0]?.name??null,observed:observed.get(row.id)??null,anthropicObservation:anthropicObservation(row.classification.system,row.classification.version,row.code),blsProjection:blsProjection(row.classification.system,row.classification.version,row.code),robotObservation:anthropicRobotObservation(row.classification.system,row.classification.version,row.code)}));
  const baseline=calculateCoverage(baselineModel,jobs,artifact as ProxyArtifact,true);
  const oldTimers=calculateReportTimers(timerModel,jobs,baseline,artifact as ProxyArtifact);
  const reverse=calculateReportTimers(timerModel,[...jobs].reverse(),baseline,artifact as ProxyArtifact);
  if(jobs.length!==oldTimers.size)throw new Error('missing_job');
  let increased=0,decreased=0,unchanged=0,withoutEvidence=0,maxCrossingError=0,maxUnknownChange=0;
  const yearMs=baselineModel.daysPerYear*86_400_000;
  for(const job of jobs){
   const v9=oldTimers.get(job.id)!;
   if(!v9||v9.targetAt!==reverse.get(job.id)?.targetAt)throw new Error('nondeterministic_timer');
   const v10=calculateConsistentProbability(probabilityModel,baselineModel,v9);
   if(v10.targetAt!==v9.targetAt||v10.timerProbabilityAligned!==true||v10.originalProbability!==v9.probability)throw new Error('inconsistent_output');
   if(!Number.isFinite(v10.probability)||v10.probability<0||v10.probability>1||v10.probabilities.some((point,index,all)=>point.probability<0||point.probability>1||(index>0&&point.probability<all[index-1].probability)))throw new Error('invalid_probability');
   const start=Date.parse(v10.baselineAt),target=Date.parse(v10.targetAt);
   const hazard=v10.adjustedAnnualBaseHazard+v10.adjustedAnnualExposureHazard*v10.effectiveExposure;
   maxCrossingError=Math.max(maxCrossingError,Math.abs(-Math.expm1(-hazard*(target-start)/yearMs)-v10.threshold));
   for(const point of v10.probabilities){const expected=-Math.expm1(-hazard*Math.max(0,(Date.UTC(point.year+1,0,1)-start)/yearMs));if(Math.abs(point.probability-expected)>1e-12)throw new Error('horizon_inconsistent');}
   const delta=v10.probability-v9.probability;
   if(delta>1e-10)increased++;else if(delta< -1e-10)decreased++;else unchanged++;
   if(Object.values(v9.timerEvidence).every(value=>value===null)){withoutEvidence++;maxUnknownChange=Math.max(maxUnknownChange,Math.abs(delta));if(Math.abs(delta)>1e-10||v9.targetAt!==v9.originalTargetAt)throw new Error('unsupported_change');}
  }
  if(maxCrossingError>1e-12||increased===0||decreased===0)throw new Error('consistency_failed');
  console.log(JSON.stringify({occupations:jobs.length,increased,decreased,unchanged,withoutEvidence,maxUnknownChange,maxCrossingError,timersPreserved:true,horizonsMonotone:true}));
 }finally{await db.$disconnect();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});

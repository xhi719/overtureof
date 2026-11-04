import { PrismaClient } from '@prisma/client';
import config from '../data/scenario/model-v6.json';
import previousConfig from '../data/scenario/model-v5.json';
import timerConfig from '../data/scenario/timer-v7.json';
import artifact from '../data/scenario/name-proxy-v1.json';
import { calculateCoverage, type CoverageJob, type ProxyArtifact } from '../lib/scenario-coverage';
import { cachedCoverage } from '../lib/scenario-cache';
import { calculateTimers, cachedTimers } from '../lib/scenario-timer';
async function main() {
 const db=new PrismaClient();
 try {
  const source=await db.researchSource.findUnique({where:{url:config.sourceUrl}});
  if(source?.status!=='approved') throw new Error('approved_source_missing');
  const [items,metrics]=await Promise.all([
   db.occupation.findMany({select:{id:true,code:true,classification:{select:{system:true,version:true}},translations:{where:{locale:'ko'},select:{name:true}}}}),
   db.researchMetric.findMany({where:{sourceId:source.id,kind:config.sourceMetricKind},select:{id:true,occupationId:true,value:true},orderBy:{id:'asc'}})
  ]);
  const byId=new Map<string,number|null>();for(const m of metrics) if(!byId.has(m.occupationId)) byId.set(m.occupationId,m.value);
  const jobs:CoverageJob[]=items.map(j=>({id:j.id,code:j.code,system:j.classification.system,version:j.classification.version,koreanName:j.translations[0]?.name ?? null,observed:byId.get(j.id)??null}));
  const a=calculateCoverage(config,jobs,artifact as ProxyArtifact,true), b=calculateCoverage(config,[...jobs].reverse(),artifact as ProxyArtifact,true), previous=calculateCoverage(previousConfig,jobs,artifact as ProxyArtifact,true);
  const timers=calculateTimers(timerConfig,jobs,a,true), timersReverse=calculateTimers(timerConfig,[...jobs].reverse(),a,true);
  if(a.size!==jobs.length) throw new Error('missing_job');
  const seconds=new Set<number>();const basis:Record<string,number>={}; let maxDelta=0,maxShift=0,maxError=0,accelerated=0,medical=0,government=0,otherChanged=0;
  const roundedProbabilities=new Set<string>(); const timerTimes: number[]=[]; let entertainment=0, researchTimers=0, timerUnchanged=0;
  for(const job of jobs){const v=a.get(job.id)!; const reverse=b.get(job.id)!; const second=Math.floor(Date.parse(v.targetAt)/1000);
   if(seconds.has(second))throw new Error(`duplicate_second:${job.id}`);seconds.add(second);
   if(v.targetAt!==reverse.targetAt||v.probability!==reverse.probability)throw new Error('unstable_schedule');
   if(!Number.isFinite(v.probability)||v.probability<0||v.probability>1||v.effectiveExposure<0||v.effectiveExposure>1)throw new Error('out_of_range');
   if(v.basis==='occupation'&&(v.exposure!==job.observed||v.syntheticDelta!==0))throw new Error('direct_input_modified');
   const elapsed=(Date.parse(v.targetAt)-Date.parse(config.baselineAt))/(config.daysPerYear*86400000);
   const researchFactor=job.system==='O*NET-SOC'&&job.version==='31.0'&&job.observed!==null&&job.observed>config.accelerationExposureThreshold?config.accelerationFactor:1;
   const medicalFactor=config.medicalClassifications.some(group=>group.system===job.system&&group.version===job.version&&group.codes.includes(job.code))?config.medicalAccelerationFactor:1;
   const governmentFactor=config.governmentClassifications.some(group=>group.system===job.system&&group.version===job.version&&group.codes.includes(job.code))?config.governmentAdjustmentFactor:1;
   const expectedMultiplier=researchFactor*medicalFactor*governmentFactor;
   if(v.hazardMultiplier!==expectedMultiplier)throw new Error('incorrect_selective_acceleration');
   if(v.researchAccelerationFactor!==researchFactor||v.medicalAccelerationFactor!==medicalFactor||v.governmentAdjustmentFactor!==governmentFactor)throw new Error('incorrect_acceleration_factors');
   if(governmentFactor<1){government++;if(Date.parse(v.targetAt)<=Date.parse(previous.get(job.id)!.targetAt))throw new Error('government_clock_not_delayed');}
   if(governmentFactor===1&&v.targetAt!==previous.get(job.id)!.targetAt)otherChanged++;
   if(medicalFactor>1)medical++;
   if(v.hazardMultiplier>1)accelerated++;
   const p=1-Math.exp(-v.hazardMultiplier*(config.annualBaseHazard+config.annualExposureHazard*v.effectiveExposure)*elapsed);
   maxError=Math.max(maxError,Math.abs(p-config.crossingProbability));maxDelta=Math.max(maxDelta,Math.abs(v.syntheticDelta));maxShift=Math.max(maxShift,Math.abs(v.adjustmentSeconds));
   roundedProbabilities.add((v.probability*100).toFixed(1));basis[v.basis]=(basis[v.basis]??0)+1;
   const timer=timers.get(job.id)!;
   const {targetAt,timerModelVersion,timerResearchFactor,timerEntertainmentFactor,timerAdjustmentSeconds,...rest}=timer;
   const {targetAt: original,...originalRest}=v;
   if(JSON.stringify(rest)!==JSON.stringify(originalRest))throw new Error('non_timer_values_changed');
   if(targetAt!==timersReverse.get(job.id)!.targetAt)throw new Error('unstable_timer');
   if(timerResearchFactor!==1)researchTimers++;
   if(timerEntertainmentFactor>1){entertainment++;if(Date.parse(targetAt)<=Date.parse(original))throw new Error('entertainment_timer_not_delayed');}
   if(timerResearchFactor===1&&timerEntertainmentFactor===1){timerUnchanged++;if(targetAt!==original)throw new Error('unaffected_timer_changed');}
   timerTimes.push(Date.parse(targetAt));
  }
  const times=[...a.values()].map(v=>Date.parse(v.targetAt)).sort((x,y)=>x-y);
  const minGapMs=Math.min(...times.slice(1).map((time,i)=>time-times[i]));
  if(minGapMs<1000) throw new Error('duplicate_display_countdown');
  timerTimes.sort((x,y)=>x-y); const minTimerGapMs=Math.min(...timerTimes.slice(1).map((time,i)=>time-timerTimes[i]));
  if(minTimerGapMs<1000)throw new Error('duplicate_adjusted_countdown');
  if(maxError>1e-9||maxDelta>config.syntheticMaxVariation+1e-12)throw new Error('math_validation_failed');
  const revoked=calculateCoverage(config,jobs,artifact as ProxyArtifact,false);
  if([...revoked.values()].some(v=>v.basis!=='default'||v.researchBased||v.researchAccelerationFactor!==1))throw new Error('revocation_failed');
  const revokedTimers=calculateTimers(timerConfig,jobs,revoked,false);
  if([...revokedTimers.values()].some(v=>v.timerResearchFactor!==1))throw new Error('timer_revocation_failed');
  const first=jobs.find(j=>j.observed!==null)!;const changed=jobs.map(j=>j.id===first.id?{...j,koreanName:`${j.koreanName} 변경`}:j);
  const stale=calculateCoverage(config,changed,artifact as ProxyArtifact,true);
  if([...stale.values()].some(v=>v.basis==='name_proxy'))throw new Error('training_stale_failed');
  const cache1=cachedCoverage(config,jobs,artifact as ProxyArtifact,true),cache2=cachedCoverage(config,jobs,artifact as ProxyArtifact,true);
  if(cache1!==cache2||cachedCoverage(config,changed,artifact as ProxyArtifact,true)===cache1)throw new Error('cache_invalidation_failed');
  const timerCache1=cachedTimers(timerConfig,jobs,cache1,true), timerCache2=cachedTimers(timerConfig,[...jobs].reverse(),cache1,true);
  if(timerCache1!==timerCache2||cachedTimers(timerConfig,changed,cache1,true)===timerCache1)throw new Error('timer_cache_invalidation_failed');
  console.log(JSON.stringify({occupations:jobs.length,basis,accelerated,medical,government,otherChanged,entertainment,researchTimers,timerUnchanged,uniqueSeconds:seconds.size,minGapMs,minTimerGapMs,uniqueDisplayedOneDecimalPercent:roundedProbabilities.size,maxAbsoluteSyntheticDelta:maxDelta,maxAbsoluteClockShiftSeconds:maxShift,maxCrossingError:maxError,deterministic:true,revocationTest:true,staleTrainingTest:true,cacheInvalidationTest:true}));
 }finally{await db.$disconnect()}
}
main().catch(e=>{console.error(e);process.exitCode=1});

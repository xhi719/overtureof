import test from 'node:test';
import assert from 'node:assert/strict';
import probabilityModel from '../data/scenario/probability-v10.json';
import baselineModel from '../data/scenario/model-v8.json';
import timerModel from '../data/scenario/timer-v9.json';
import {calculateCoverage,type ProxyArtifact} from '../lib/scenario-coverage';
import {calculateReportTimers,type ReportTimerJob} from '../lib/scenario-timer-v9';
import {cachedReportTimers} from '../lib/scenario-timer-v9-cache';
import {calculateConsistentProbability} from '../lib/scenario-probability-v10';

const artifact:ProxyArtifact={metadata:{sourceTrainingSignature:'',trainingCount:0,prior:.5,maxSyntheticVariation:.03},occupations:{}};
const job=(id:string,code:string,observed:number|null):ReportTimerJob=>({id,system:'O*NET-SOC',version:'31.0',code,koreanName:id,observed});
const yearMs=baselineModel.daysPerYear*86_400_000;
function make(j:ReportTimerJob){
 const coverage=calculateCoverage(baselineModel,[j],artifact,true);
 return calculateReportTimers(timerModel,[j],coverage,artifact).get(j.id)!;
}
function probabilityAt(hazard:number,start:number,end:number){return -Math.expm1(-hazard*Math.max(0,(end-start)/yearMs));}

test('reweighted probability and returned hazard match the timer and every year-end',()=>{
 const high=make(job('high','15-1252.00',.8));
 const low=make(job('low','15-1253.00',.2));
 const before=structuredClone(high);
 for(const value of [high,low]){
  const result=calculateConsistentProbability(probabilityModel,baselineModel,value);
  const start=Date.parse(result.baselineAt),target=Date.parse(result.targetAt);
  const hazard=result.adjustedAnnualBaseHazard+result.adjustedAnnualExposureHazard*result.effectiveExposure;
  assert.ok(Math.abs(probabilityAt(hazard,start,target)-baselineModel.crossingProbability)<1e-12);
  for(const point of result.probabilities)assert.ok(Math.abs(point.probability-probabilityAt(hazard,start,Date.UTC(point.year+1,0,1)))<1e-12);
  assert.equal(result.probability,result.probabilities.at(-1)!.probability);
  assert.ok(result.probabilities.every((point,index,rows)=>point.probability>=0&&point.probability<=1&&(index===0||point.probability>=rows[index-1].probability)));
  assert.equal(result.originalProbability,value.probability);
  assert.deepEqual(result.originalProbabilities,value.probabilities);
  assert.notEqual(result.originalProbabilities,value.probabilities);
  assert.equal(result.timerProbabilityAligned,true);
  assert.equal(result.probabilityModelVersion,'10.0.0');
 }
 assert.deepEqual(high,before);
 assert.ok(calculateConsistentProbability(probabilityModel,baselineModel,high).probability>high.probability);
 assert.ok(calculateConsistentProbability(probabilityModel,baselineModel,low).probability<low.probability);
});

test('unadjusted timer preserves original probability within millisecond timestamp precision',()=>{
 const j:ReportTimerJob={id:'unknown',system:'KSCO',version:'8',code:'99999',koreanName:'unknown',observed:null};
 const value=make(j),result=calculateConsistentProbability(probabilityModel,baselineModel,value);
 assert.equal(value.timerTimeFactor,1);
 assert.equal(result.targetAt,value.originalTargetAt);
 assert.ok(Math.abs(result.probability-value.probability)<1e-9);
 assert.ok(Object.values(result.timerEvidence).every(item=>item===null));
});

test('display collision seconds are accounted for mathematically and remain distinct from evidence',()=>{
 const value=make(job('high','15-1252.00',.8));
 const moved={...value,targetAt:new Date(Date.parse(value.targetAt)+1000).toISOString(),timerAdjustmentSeconds:1};
 const result=calculateConsistentProbability(probabilityModel,baselineModel,moved);
 const hazard=result.adjustedAnnualBaseHazard+result.adjustedAnnualExposureHazard*result.effectiveExposure;
 assert.ok(Math.abs(probabilityAt(hazard,Date.parse(result.baselineAt),Date.parse(result.targetAt))-result.threshold)<1e-12);
 assert.equal(result.timerAdjustmentSeconds,1);
 assert.deepEqual(result.timerEvidence,value.timerEvidence);
 assert.ok(result.probability<calculateConsistentProbability(probabilityModel,baselineModel,value).probability);
});

test('invalid baselines, horizons and numerical inputs fail closed',()=>{
 const value=make(job('high','15-1252.00',.8));
 assert.throws(()=>calculateConsistentProbability(probabilityModel,baselineModel,{...value,targetAt:value.baselineAt}),/invalid_probability_v10_time/);
 assert.throws(()=>calculateConsistentProbability(probabilityModel,{...baselineModel,horizons:[2040,2035]},value),/invalid_probability_v10_horizons/);
 assert.throws(()=>calculateConsistentProbability(probabilityModel,baselineModel,{...value,effectiveExposure:NaN}),/invalid_probability_v10_hazard/);
 assert.throws(()=>calculateConsistentProbability(probabilityModel,baselineModel,{...value,threshold:.7}),/invalid_probability_v10_threshold/);
});

test('v9 cache remains valid and recalculating does not mutate cached entries',()=>{
 const j=job('high','15-1252.00',.8),coverage=calculateCoverage(baselineModel,[j],artifact,true);
 const cached=cachedReportTimers(timerModel,[j],coverage,artifact),original=structuredClone(cached.get(j.id)!);
 const result=calculateConsistentProbability(probabilityModel,baselineModel,cached.get(j.id)!);
 assert.equal(cachedReportTimers(timerModel,[j],coverage,artifact),cached);
 assert.deepEqual(cached.get(j.id),original);
 assert.notEqual(result.probabilities,cached.get(j.id)!.probabilities);
});

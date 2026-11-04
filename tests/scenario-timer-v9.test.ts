import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../data/scenario/timer-v9.json';
import {calculateReportTimers, type ReportTimerJob, type RobotObservation} from '../lib/scenario-timer-v9';
import {cachedReportTimers} from '../lib/scenario-timer-v9-cache';
import type {CoverageValues, ProxyArtifact} from '../lib/scenario-coverage';

const emptyArtifact:ProxyArtifact={metadata:{sourceTrainingSignature:'',trainingCount:0,prior:.5,maxSyntheticVariation:.03},occupations:{}};
const job=(id:string,system='KSCO',code='11111'):ReportTimerJob=>({id,system,version:system==='KSCO'?'8':'31.0',code,koreanName:'직업',observed:null});
const base=(extra:Partial<CoverageValues>={}):CoverageValues=>({baselineAt:'2026-10-31T10:09:49.000Z',targetAt:'2040-10-31T10:09:49.000Z',probability:.45,probabilities:[{year:2040,probability:.45}],basis:'default',exposure:.5,anthropicObservation:null,blsProjection:null,...extra} as CoverageValues);
const calculate=(j:ReportTimerJob,b:CoverageValues=base(),a=emptyArtifact)=>calculateReportTimers(config,[j],new Map([[j.id,b]]),a).get(j.id)!;

test('missing evidence leaves the timer and every probability unchanged',()=>{
 const j=job('a'),original=base(),result=calculate(j,original);
 assert.equal(result.targetAt,original.targetAt);assert.equal(result.timerTimeFactor,1);
 assert.equal(result.probability,original.probability);assert.deepEqual(result.probabilities,original.probabilities);
 assert.equal(result.timerProbabilityAligned,false);assert.deepEqual(result.timerEvidence,{openai:null,anthropic:null,bls:null,robotics:null});
});
test('direct research score adjusts in both directions without mutating baseline',()=>{
 const high=job('h','O*NET-SOC','15-1252.00');high.observed=.8;
 const low=job('l','O*NET-SOC','15-1253.00');low.observed=.2;
 const highBase=base({basis:'occupation',exposure:.8}),lowBase=base({basis:'occupation',exposure:.2});
 const earlier=calculate(high,highBase),later=calculate(low,lowBase);
 assert.ok(earlier.timerTimeFactor<1);assert.ok(later.timerTimeFactor>1);
 assert.equal(earlier.originalTargetAt,highBase.targetAt);assert.equal(earlier.probability,highBase.probability);
 assert.equal(highBase.targetAt,'2040-10-31T10:09:49.000Z');
});
test('name proxy is explicitly weak, includes strength, and cannot masquerade as direct evidence',()=>{
 const j=job('p'),p={name:'직업',score:.8,similarity:.8,strength:.4,basis:'name_proxy' as const};
 const artifact={...emptyArtifact,occupations:{'KSCO|8|11111':p}};
 const result=calculate(j,base({basis:'name_proxy',exposure:.8}),artifact);
 assert.equal(result.timerEvidence.openai?.kind,'name_proxy');assert.equal(result.timerEvidence.openai?.proxyStrength,.4);
 assert.ok(result.timerTimeFactor<1 && result.timerTimeFactor>Math.exp(-config.directExposureWeight*.3));
 assert.throws(()=>calculate(j,base({basis:'name_proxy',exposure:.8})),/invalid_proxy_timer_evidence/);
});
test('US employment change is contextual only, distinct from an AI-caused outcome',()=>{
 const j=job('b','O*NET-SOC','15-1252.00');
 const evidence={onetCode:j.code,socCode:'15-1252',socTitle:'',changePercent:10,changePercentRaw:'10',baselineYear:2025,horizonYear:2035,sourceUrl:'https://www.bls.gov/',crosswalkUrl:'https://example.com/',sourceSha256:'',crosswalkSha256:'',retrievedDate:'',relation:'official_crosswalk_soc_parent' as const};
 const up=calculate(j,base({blsProjection:evidence}));
 const down=calculate(j,base({blsProjection:{...evidence,changePercent:-10}}));
 const noNumber=calculate(j,base({blsProjection:{...evidence,changePercent:null}}));
 assert.ok(up.timerTimeFactor>1);assert.ok(down.timerTimeFactor<1);assert.equal(noNumber.timerTimeFactor,1);
 assert.equal(up.timerEvidence.bls?.relation,'official_crosswalk_soc_parent');assert.equal(up.probability,.45);
});
test('zero observed Claude exposure is not used as evidence of absence',()=>{
 const j=job('a','O*NET-SOC','15-1252.00');
 const observation={socCode:'15-1252',socTitle:'',value:0,originalValue:'0',mapping:'soc_exact' as const,sourceUrl:'https://www.anthropic.com/research/labor-market-impacts',sourceDate:'',datasetUrl:'',sourceSha256:'',retrievedDate:''};
 const result=calculate(j,base({anthropicObservation:observation}));
 assert.equal(result.timerTimeFactor,1);
 assert.equal(result.timerEvidence.anthropic?.value,0);
 assert.equal(result.timerEvidence.anthropic?.logTimeContribution,0);
});
test('robot exposure is bounded, version-labelled and never mapped to KSCO',()=>{
 const j=job('r','O*NET-SOC','15-1252.00');
 const observation:RobotObservation={onetCode:j.code,sourceVersion:'29.3',value:3,sourceUrl:'https://www.anthropic.com/research/',mapping:'same_code_cross_version'};
 const exposed=calculate({...j,robotObservation:observation});
 const less=calculate({...j,robotObservation:{...observation,value:.5}});
 const zero=calculate({...j,robotObservation:{...observation,value:0}});
 assert.ok(exposed.timerTimeFactor<1);assert.ok(less.timerTimeFactor>1);
 assert.equal(exposed.timerEvidence.robotics?.mapping,'same_code_cross_version');assert.equal(exposed.timerEvidence.robotics?.value,3);
 assert.equal(zero.timerTimeFactor,1);assert.equal(zero.timerEvidence.robotics?.value,0);assert.equal(zero.timerEvidence.robotics?.logTimeContribution,0);
 assert.throws(()=>calculate({...job('k'),robotObservation:{...observation,onetCode:'11111'}}),/invalid_robot_timer_evidence/);
 assert.throws(()=>calculate({...j,robotObservation:{...observation,value:3.1}}),/invalid_robot_timer_evidence/);
});
test('collisions preserve unadjusted time and resolve adjusted seconds deterministically',()=>{
 const a=job('a','O*NET-SOC','15-1252.00');a.observed=.8;
 const aBase=base({basis:'occupation',exposure:.8});
 const desired=calculate(a,aBase).targetAt;
 const b=job('b');const bBase=base({targetAt:desired});
 const baseline=new Map([[a.id,aBase],[b.id,bBase]]);
 const forward=calculateReportTimers(config,[a,b],baseline,emptyArtifact);
 const backward=calculateReportTimers(config,[b,a],baseline,emptyArtifact);
 assert.equal(forward.get(b.id)?.targetAt,desired);
 assert.equal(forward.get(b.id)?.timerAdjustmentSeconds,0);
 assert.equal(forward.get(a.id)?.timerAdjustmentSeconds,1);
 assert.equal(forward.get(a.id)?.targetAt,backward.get(a.id)?.targetAt);
 assert.equal(forward.get(a.id)?.originalTargetAt,aBase.targetAt);
 assert.equal(forward.get(a.id)?.probability,aBase.probability);
 assert.ok(Math.abs(Date.parse(forward.get(a.id)!.targetAt)-Date.parse(desired))>=1000);
});
test('cache reuses only identical inputs and invalidates for robot, configuration, baseline and proxy changes',()=>{
 const j=job('a'),baseline=new Map([[j.id,base()]]),a={...emptyArtifact,occupations:{}};
 const first=cachedReportTimers(config,[j],baseline,a);
 assert.equal(cachedReportTimers({...config},[{...j}],baseline,a),first);
 assert.notEqual(cachedReportTimers({...config,directExposureWeight:.7},[j],baseline,a),first);
 assert.notEqual(cachedReportTimers(config,[j],new Map(baseline),a),first);
 const robotJob=job('robot','O*NET-SOC','15-1252.00');
 const robot:RobotObservation={onetCode:robotJob.code,sourceVersion:'29.3',value:2,sourceUrl:'https://www.anthropic.com/',mapping:'same_code_cross_version'};
 const robotBase=new Map([[robotJob.id,base()]]);
 const robotFirst=cachedReportTimers(config,[{...robotJob,robotObservation:robot}],robotBase,a);
 assert.notEqual(cachedReportTimers(config,[{...robotJob,robotObservation:{...robot,value:3}}],robotBase,a),robotFirst);
 const changedArtifact={...a,metadata:{...a.metadata,prior:.4}};
 assert.notEqual(cachedReportTimers(config,[{...robotJob,robotObservation:robot}],robotBase,changedArtifact),robotFirst);
 const prior=cachedReportTimers(config,[j],baseline,a);
 baseline.set(j.id,base({targetAt:'2041-10-31T10:09:49.000Z'}));
 assert.notEqual(cachedReportTimers(config,[j],baseline,a),prior);
});

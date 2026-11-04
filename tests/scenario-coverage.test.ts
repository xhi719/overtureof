import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import config from '../data/scenario/model-v4.json';
import medicalConfig from '../data/scenario/model-v5.json';
import governmentConfig from '../data/scenario/model-v6.json';
import { calculateCoverage, type CoverageJob, type ProxyArtifact } from '../lib/scenario-coverage';
import { calculateScenario } from '../lib/scenario';
import { cachedCoverage } from '../lib/scenario-cache';
const jobs: CoverageJob[] = [
  {id:'1',code:'01',system:'O*NET-SOC',version:'31.0',koreanName:'연구원',observed:0.35},
  {id:'2',code:'02',system:'O*NET-SOC',version:'31.0',koreanName:'교사',observed:0.35},
  {id:'3',code:'123',system:'KSCO',version:'8',koreanName:'연구자',observed:null},
  {id:'4',code:'456',system:'KSCO',version:'8',koreanName:'미확인',observed:null},
];
const signature = createHash('sha256').update('01\t연구원\t0.3500000000\n02\t교사\t0.3500000000').digest('hex');
const artifact: ProxyArtifact = { metadata: { sourceTrainingSignature: signature, trainingCount: 2, prior: .35, maxSyntheticVariation: .03 }, occupations: { 'KSCO|8|123': { name:'연구자', score:.36, similarity:.6, strength:.3, basis:'name_proxy' }, 'KSCO|8|456': { name:'미확인',score:.35,similarity:.05,strength:0,basis:'default' } } };
test('direct observations are preserved while seconds are unique and deterministic', () => {
  const a = calculateCoverage(config, jobs, artifact, true), b = calculateCoverage(config, jobs, artifact, true);
  assert.equal(a.size, jobs.length);
  assert.deepEqual([...a], [...b]);
  assert.equal(new Set([...a.values()].map(x => Math.floor(Date.parse(x.targetAt) / 1000))).size, jobs.length);
  assert.equal(a.get('1')!.exposure, .35); assert.equal(a.get('2')!.exposure, .35);
  assert.equal(a.get('1')!.syntheticDelta, 0); assert.equal(a.get('2')!.syntheticDelta, 0);
  assert.ok(a.get('1')!.adjustmentSeconds !== 0 || a.get('2')!.adjustmentSeconds !== 0);
  assert.equal(a.get('3')!.basis, 'name_proxy'); assert.equal(a.get('4')!.basis, 'default');
  for (const v of a.values()) assert.ok(Math.abs(v.syntheticDelta) <= .030000000001);
});
test('stale inputs and source approval immediately disable name proxies', () => {
  const changed = jobs.map(j => j.id === '1' ? {...j,koreanName:'변경된 이름'} : j);
  assert.equal(calculateCoverage(config, changed, artifact, true).get('3')!.basis, 'default');
  assert.equal(calculateCoverage(config, jobs, artifact, false).get('1')!.basis, 'default');
  const wronglyLinked = jobs.map(j => j.id === '3' ? {...j,observed:.8} : j);
  assert.notEqual(calculateCoverage(config, wronglyLinked, artifact, true).get('3')!.basis, 'occupation');
  const changedCandidate = jobs.map(j => j.id === '3' ? {...j,koreanName:'변경된 대상'} : j);
  assert.equal(calculateCoverage(config, changedCandidate, artifact, true).get('3')!.basis, 'default');
});
test('cache reuses identical data and invalidates on approval, name, score, insertion and deletion', () => {
  const a = cachedCoverage(config,jobs,artifact,true);
  assert.equal(cachedCoverage(config,[...jobs].reverse(),artifact,true),a);
  assert.notEqual(cachedCoverage(config,jobs,artifact,false),a);
  assert.notEqual(cachedCoverage(config,jobs.map(j => j.id === '1' ? {...j,koreanName:'다름'} : j),artifact,true),a);
  assert.notEqual(cachedCoverage(config,jobs.map(j => j.id === '1' ? {...j,observed:.4} : j),artifact,true),a);
  assert.notEqual(cachedCoverage(config,jobs.slice(1),artifact,true),a);
  assert.notEqual(cachedCoverage(config,[...jobs,{id:'5',code:'789',system:'KSCO',version:'8',koreanName:'신규',observed:null}],artifact,true),a);
  assert.notEqual(cachedCoverage({...config,annualBaseHazard:.02},jobs,artifact,true),a);
  const modifiedArtifact = {...artifact, occupations:{...artifact.occupations,'KSCO|8|123':{...artifact.occupations['KSCO|8|123'],score:.4}}};
  assert.notEqual(cachedCoverage(config,jobs,modifiedArtifact,true),a);
});

test('timestamps less than a second apart are separated even across second boundaries', () => {
  const start=Date.parse(config.baselineAt), yearMs=config.daysPerYear*86400000;
  const base=Date.parse(calculateScenario(config,.35).targetAt);
  const secondExposure=((-Math.log1p(-config.crossingProbability))*yearMs/(base+500-start)-config.annualBaseHazard)/config.annualExposureHazard;
  const nearby:CoverageJob[]=[jobs[0],{...jobs[1],observed:secondExposure}];
  const result=calculateCoverage(config,nearby,artifact,true);
  assert.ok(Math.abs(Date.parse(result.get('1')!.targetAt)-Date.parse(result.get('2')!.targetAt))>=1000);
});

test('accelerates only directly linked research above the strict exposure threshold', () => {
  const inputs: CoverageJob[] = [
    {...jobs[0],id:'below',code:'11',observed:.49},
    {...jobs[0],id:'equal',code:'12',observed:.5},
    {...jobs[0],id:'above',code:'13',observed:.7},
    {...jobs[2],id:'ksco',code:'123',observed:.9},
    {...jobs[3],id:'default',code:'456',observed:null},
  ];
  const values=calculateCoverage(config,inputs,artifact,true);
  assert.equal(values.get('below')!.hazardMultiplier,1);
  assert.equal(values.get('equal')!.hazardMultiplier,1);
  assert.equal(values.get('above')!.hazardMultiplier,3);
  assert.equal(values.get('ksco')!.hazardMultiplier,1);
  assert.equal(values.get('default')!.hazardMultiplier,1);
  assert.equal(calculateCoverage(config,inputs,artifact,false).get('above')!.hazardMultiplier,1);
  const highProxy = { ...artifact, occupations: { ...artifact.occupations, 'KSCO|8|123': { ...artifact.occupations['KSCO|8|123'], score: .9 } } };
  const proxyResult = calculateCoverage(config,jobs,highProxy,true).get('3')!;
  assert.equal(proxyResult.basis,'name_proxy');
  assert.equal(proxyResult.hazardMultiplier,1);
  const above=values.get('above')!;
  const baseline=Date.parse(config.baselineAt);
  const regular=calculateScenario(config,above.effectiveExposure);
  assert.ok(Math.abs((Date.parse(above.targetAt)-baseline)*3-(Date.parse(regular.targetAt)-baseline))<=3);
});

test('rejects invalid selective acceleration parameters', () => {
  assert.throws(() => calculateCoverage({...config,accelerationFactor:.9},jobs,artifact,true));
  assert.throws(() => calculateCoverage({...config,accelerationExposureThreshold:1.1},jobs,artifact,true));
  assert.throws(() => calculateCoverage({...config,accelerationFactor:undefined},jobs,artifact,true));
});

test('doctor scenario halves time using classification codes and compounds existing research acceleration', () => {
  const examples: CoverageJob[] = [
    {...jobs[2], id:'doctor',code:'24111',koreanName:'내과 전문 의사'},
    {...jobs[2], id:'dentist',code:'24142',koreanName:'일반 치과의사'},
    {...jobs[2], id:'nurse',code:'24402',koreanName:'일반 간호사'},
    {...jobs[0], id:'specialist',code:'29-1216.00',observed:.8},
    {...jobs[0], id:'assistant',code:'29-1071.00',observed:.8},
  ];
  const v4=calculateCoverage(config,examples,artifact,true),v5=calculateCoverage(medicalConfig,examples,artifact,true);
  const origin=Date.parse(config.baselineAt);
  for(const id of ['doctor','dentist','specialist']){
    const current=v5.get(id)!,prior=v4.get(id)!;
    assert.equal(current.medicalAccelerationFactor,2);
    assert.ok(Math.abs(2*(Date.parse(current.targetAt)-origin-current.adjustmentSeconds*1000)-(Date.parse(prior.targetAt)-origin-prior.adjustmentSeconds*1000))<5);
  }
  assert.equal(v5.get('specialist')!.researchAccelerationFactor,3);
  assert.equal(v5.get('specialist')!.hazardMultiplier,6);
  assert.equal(v5.get('nurse')!.medicalAccelerationFactor,1);
  assert.equal(v5.get('assistant')!.medicalAccelerationFactor,1);
  assert.equal(calculateCoverage(medicalConfig,examples,artifact,false).get('specialist')!.hazardMultiplier,2);
});

test('rejects invalid doctor scenario configuration', () => {
  assert.throws(() => calculateCoverage({...medicalConfig,medicalAccelerationFactor:.9},jobs,artifact,true));
  assert.throws(() => calculateCoverage({...medicalConfig,medicalClassifications:undefined},jobs,artifact,true));
});

test('government adjustment delays only identified senior government occupations', () => {
  const examples: CoverageJob[] = [
    {...jobs[2],id:'central',code:'11121'},
    {...jobs[2],id:'local',code:'11122'},
    {...jobs[2],id:'mixed',code:'1112'},
    {...jobs[2],id:'legislator',code:'11111'},
    {...jobs[0],id:'executive',code:'11-1011.00',observed:.8},
    {...jobs[2],id:'doctor',code:'24111'},
  ];
  const before=calculateCoverage(medicalConfig,examples,artifact,true), after=calculateCoverage(governmentConfig,examples,artifact,true);
  const origin=Date.parse(governmentConfig.baselineAt);
  for (const id of ['central','local']) {
    const previous=before.get(id)!, current=after.get(id)!;
    assert.equal(current.governmentAdjustmentFactor,.75);
    assert.ok(Date.parse(current.targetAt)>Date.parse(previous.targetAt));
    assert.ok(Math.abs(.75*(Date.parse(current.targetAt)-origin-current.adjustmentSeconds*1000)-(Date.parse(previous.targetAt)-origin-previous.adjustmentSeconds*1000))<5);
  }
  for (const id of ['mixed','legislator','executive','doctor']) {
    assert.equal(after.get(id)!.governmentAdjustmentFactor,1);
    assert.equal(after.get(id)!.hazardMultiplier,before.get(id)!.hazardMultiplier);
  }
  assert.equal(after.get('executive')!.researchAccelerationFactor,3);
  assert.equal(after.get('doctor')!.medicalAccelerationFactor,2);
});

test('rejects invalid government adjustment configuration', () => {
  assert.throws(() => calculateCoverage({...governmentConfig,governmentAdjustmentFactor:0},jobs,artifact,true));
  assert.throws(() => calculateCoverage({...governmentConfig,governmentAdjustmentFactor:1.1},jobs,artifact,true));
  assert.throws(() => calculateCoverage({...governmentConfig,governmentClassifications:undefined},jobs,artifact,true));
});

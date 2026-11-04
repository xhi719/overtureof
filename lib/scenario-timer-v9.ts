import type { CoverageJob, CoverageValues, ProxyArtifact } from '@/lib/scenario-coverage';

export type ReportTimerConfig = {
  id: string; version: string; openaiSourceUrl: string;
  directExposureCenter: number; directExposureWeight: number; proxyExposureWeight: number;
  anthropicExposureCenter: number; anthropicExposureWeight: number;
  blsChangeClampPercent: number; blsChangeWeight: number;
  robotExposureCenter: number; robotExposureWeight: number;
  minimumTimeFactor: number; maximumTimeFactor: number;
};
export type TimerEvidence = {
  openai: null | { kind: 'direct' | 'name_proxy'; value: number; proxyStrength: number | null; sourceUrl: string; logTimeContribution: number };
  anthropic: null | { socCode: string; mapping: 'soc_exact' | 'soc_group'; value: number; sourceUrl: string; logTimeContribution: number };
  bls: null | { socCode: string; relation: 'official_crosswalk_soc_parent'; changePercent: number; baselineYear: number; horizonYear: number; sourceUrl: string; logTimeContribution: number };
  robotics: null | { onetCode: string; sourceVersion: string; value: number; sourceUrl: string; mapping: 'same_code_cross_version'; logTimeContribution: number };
};
export type RobotObservation = { onetCode: string; sourceVersion: string; value: number; sourceUrl: string; mapping: 'same_code_cross_version' };
export type ReportTimerJob = CoverageJob & {robotObservation?: RobotObservation | null};
export type ReportTimerValues = CoverageValues & {
  originalTargetAt: string; timerModelId: string; timerModelVersion: string;
  timerTimeFactor: number; timerAdjustmentSeconds: number; timerProbabilityAligned: false; timerEvidence: TimerEvidence;
};

/**
 * A scenario-only reweighting of indicators already used in v8, with an
 * additional robotics exposure indicator. It is not an independent study,
 * a calibration, or an AI-attributed BLS measure.
 * The original model probability and source observations are never changed.
 */
export function calculateReportTimers(config: ReportTimerConfig, jobs: ReportTimerJob[], baseline: Map<string, CoverageValues>, artifact: ProxyArtifact): Map<string, ReportTimerValues> {
  const validUnit = (v:number) => Number.isFinite(v) && v >= 0 && v <= 1;
  const weights = [config.directExposureWeight, config.proxyExposureWeight, config.anthropicExposureWeight, config.blsChangeWeight, config.robotExposureWeight];
  if (!config.id || !config.version || !/^https:\/\//.test(config.openaiSourceUrl) || !validUnit(config.directExposureCenter) || !validUnit(config.anthropicExposureCenter) || !Number.isFinite(config.robotExposureCenter) || config.robotExposureCenter < 0 || config.robotExposureCenter > 3 || weights.some(v => !Number.isFinite(v) || v < 0 || v > 1) || config.proxyExposureWeight > config.directExposureWeight || !Number.isFinite(config.blsChangeClampPercent) || config.blsChangeClampPercent <= 0 || !Number.isFinite(config.minimumTimeFactor) || config.minimumTimeFactor <= 0 || config.minimumTimeFactor > 1 || !Number.isFinite(config.maximumTimeFactor) || config.maximumTimeFactor < 1) throw new Error('invalid_report_timer_config');
  if (new Set(jobs.map(job => job.id)).size !== jobs.length) throw new Error('duplicate_report_timer_job');
  const results = new Map<string, ReportTimerValues>();
  for (const job of jobs) {
    const original = baseline.get(job.id);
    if (!original || !validUnit(original.exposure) || !Number.isFinite(Date.parse(original.baselineAt)) || !Number.isFinite(Date.parse(original.targetAt))) throw new Error('invalid_report_timer_baseline');
    const start = Date.parse(original.baselineAt), end = Date.parse(original.targetAt);
    if (end <= start) throw new Error('invalid_report_timer_interval');
    const evidence:TimerEvidence = {openai:null,anthropic:null,bls:null,robotics:null};
    let logFactor = 0;
    if (original.basis === 'occupation') {
      if (job.system !== 'O*NET-SOC' || job.version !== '31.0' || job.observed === null || !validUnit(job.observed) || original.exposure !== job.observed) throw new Error('invalid_direct_timer_evidence');
      const contribution = -config.directExposureWeight * (original.exposure - config.directExposureCenter);
      evidence.openai = {kind:'direct',value:original.exposure,proxyStrength:null,sourceUrl:config.openaiSourceUrl,logTimeContribution:contribution};
      logFactor += contribution;
    } else if (original.basis === 'name_proxy') {
      const key = `${job.system}|${job.version}|${job.code}`;
      const proxy = artifact.occupations[key];
      if (!proxy || proxy.basis !== 'name_proxy' || proxy.name !== job.koreanName || !validUnit(proxy.score) || !validUnit(proxy.strength) || proxy.score !== original.exposure) throw new Error('invalid_proxy_timer_evidence');
      const contribution = -config.proxyExposureWeight * proxy.strength * (proxy.score - config.directExposureCenter);
      evidence.openai = {kind:'name_proxy',value:proxy.score,proxyStrength:proxy.strength,sourceUrl:config.openaiSourceUrl,logTimeContribution:contribution};
      logFactor += contribution;
    }
    const anthropic = original.anthropicObservation;
    if (anthropic) {
      if (!validUnit(anthropic.value)) throw new Error('invalid_anthropic_timer_evidence');
      // Zero can mean below the source's observation threshold; it does not
      // establish absence of AI use, so it does not shift the timer.
      const contribution = anthropic.value === 0 ? 0 : -config.anthropicExposureWeight * (anthropic.value - config.anthropicExposureCenter);
      evidence.anthropic = {socCode:anthropic.socCode,mapping:anthropic.mapping,value:anthropic.value,sourceUrl:anthropic.sourceUrl,logTimeContribution:contribution};
      logFactor += contribution;
    }
    const bls = original.blsProjection;
    if (bls && bls.changePercent !== null) {
      if (!Number.isFinite(bls.changePercent)) throw new Error('invalid_bls_timer_evidence');
      const scaled = Math.max(-1,Math.min(1,bls.changePercent / config.blsChangeClampPercent));
      const contribution = config.blsChangeWeight * scaled;
      evidence.bls = {socCode:bls.socCode,relation:bls.relation,changePercent:bls.changePercent,baselineYear:bls.baselineYear,horizonYear:bls.horizonYear,sourceUrl:bls.sourceUrl,logTimeContribution:contribution};
      logFactor += contribution;
    }
    const robotics = job.robotObservation;
    if (robotics) {
      if (job.system !== 'O*NET-SOC' || job.version !== '31.0' || robotics.onetCode !== job.code || robotics.sourceVersion !== '29.3' || robotics.mapping !== 'same_code_cross_version' || !Number.isFinite(robotics.value) || robotics.value < 0 || robotics.value > 3 || !/^https:\/\//.test(robotics.sourceUrl)) throw new Error('invalid_robot_timer_evidence');
      // The index measures task exposure on a 0–3 scale, not robot adoption,
      // a probability, or evidence that the technology is economically viable.
      // Zero does not distinguish nonphysical work from physical tasks with
      // no measured robot exposure, and so is not treated as a delay signal.
      const contribution = robotics.value === 0 ? 0 : -config.robotExposureWeight * (robotics.value - config.robotExposureCenter) / 3;
      evidence.robotics = {...robotics,logTimeContribution:contribution};
      logFactor += contribution;
    }
    // Missing evidence must not introduce a synthetic/default adjustment.
    const factor = Math.max(config.minimumTimeFactor,Math.min(config.maximumTimeFactor,Math.exp(logFactor)));
    const time = start + (end - start) * factor;
    if (!Number.isFinite(time) || !Number.isFinite(new Date(time).getTime())) throw new Error('invalid_report_timer_target');
    results.set(job.id,{...original,originalTargetAt:original.targetAt,targetAt:factor === 1 ? original.targetAt : new Date(time).toISOString(),timerModelId:config.id,timerModelVersion:config.version,timerTimeFactor:factor,timerAdjustmentSeconds:0,timerProbabilityAligned:false,timerEvidence:evidence});
  }
  // Preserve every unadjusted timestamp exactly, then make adjusted display
  // seconds unique in deterministic classification/code order. This is only a
  // display collision correction, not a report-derived signal.
  const occupied = new Map<number,number[]>();
  const reserve=(time:number)=>{const second=Math.floor(time/1000);occupied.set(second,[...(occupied.get(second)||[]),time]);};
  const collides=(time:number)=>{const second=Math.floor(time/1000);return [second-1,second,second+1].some(slot=>(occupied.get(slot)||[]).some(other=>Math.abs(other-time)<1000));};
  for (const result of results.values()) if (result.timerTimeFactor === 1) reserve(Date.parse(result.targetAt));
  const order=(a:ReportTimerJob,b:ReportTimerJob)=>{
    const ak=`${a.system}|${a.version}|${a.code}|${a.id}`,bk=`${b.system}|${b.version}|${b.code}|${b.id}`;
    return ak<bk?-1:ak>bk?1:0;
  };
  for (const job of [...jobs].sort(order)) {
    const result=results.get(job.id)!;
    if (result.timerTimeFactor === 1) continue;
    const desired=Date.parse(result.targetAt),start=Date.parse(result.baselineAt);
    let delta=0, candidate=desired;
    if (collides(candidate)) {
      let found=false;
      for (let distance=1;distance<=jobs.length+1 && !found;distance++) {
        for (const signed of [distance,-distance]) {
          const next=desired+signed*1000;
          if (next<=start || !Number.isFinite(new Date(next).getTime()) || collides(next)) continue;
          delta=signed;candidate=next;found=true;break;
        }
      }
      if (!found) throw new Error('report_timer_collision_resolution_failed');
    }
    reserve(candidate);
    if (delta) results.set(job.id,{...result,targetAt:new Date(candidate).toISOString(),timerAdjustmentSeconds:delta});
  }
  return results;
}

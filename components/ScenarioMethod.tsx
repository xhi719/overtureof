'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type Copy = Record<string, string>;
type Scenario = { probability: number; modelVersion: string; baselineAt: string; threshold: number; basis: 'occupation'|'name_proxy'|'default'; exposure: number; syntheticDelta?: number; effectiveExposure?: number; adjustmentSeconds?: number; clockAdjustment?: string; researchAccelerationFactor?: number; medicalAccelerationFactor?: number; governmentAdjustmentFactor?: number; anthropicObservation?: { socCode: string; value: number; mapping: 'soc_exact'|'soc_group'; sourceUrl: string }; blsProjection?: { socCode: string; changePercent: number|null; baselineYear: number; horizonYear: number; sourceUrl: string }; sourceUrl: string|null; timerModelVersion?: string; timerProbabilityAligned?: boolean; timerTimeFactor?: number; timerAdjustmentSeconds?: number; timerEvidence?: {openai?:{value:number;sourceUrl?:string;logTimeContribution?:number}|null;anthropic?:{value:number;sourceUrl?:string;logTimeContribution?:number}|null;bls?:{value:number;sourceUrl?:string;logTimeContribution?:number}|null;robotics?:{onetCode:string;sourceVersion:string;value:number;sourceUrl:string;mapping:'same_code_cross_version';logTimeContribution?:number}|null}; parameters: { annualBaseHazard: number; annualExposureHazard: number; defaultExposure: number; daysPerYear: number; eventEmploymentReduction: number; accelerationExposureThreshold?: number } };
type Payload = { scenario: Scenario };
function render(template: string, values: Record<string, string>) { return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match); }
export default function ScenarioMethod({ locale, id, c }: { locale: string; id: string; c: Copy }) {
  const [data, setData] = useState<Scenario | null>(null); const [state, setState] = useState<'loading'|'ready'|'missing'|'error'>('loading');
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/scenario/${encodeURIComponent(id)}?locale=${encodeURIComponent(locale)}`, { signal: controller.signal }).then(async r => { if (r.status === 404) { setState('missing'); return; } if (!r.ok) throw new Error('request_failed'); const result = await r.json() as Payload; if (!result.scenario?.parameters || !Number.isFinite(result.scenario.exposure) || !([result.scenario.syntheticDelta, result.scenario.effectiveExposure, result.scenario.adjustmentSeconds].every(v => v == null) || [result.scenario.syntheticDelta, result.scenario.effectiveExposure, result.scenario.adjustmentSeconds].every(v => typeof v === 'number' && Number.isFinite(v))) || !['occupation','name_proxy','default'].includes(result.scenario.basis)) throw new Error('invalid_scenario'); setData(result.scenario); setState('ready'); }).catch(() => { if (!controller.signal.aborted) setState('error'); });
    return () => controller.abort();
  }, [id, locale]);
  const num = (v: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(v);
  const precise = (v: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 12 }).format(v);
  const signed = (v: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 12, signDisplay: 'exceptZero' }).format(v);
  const pct = (v: number) => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(v);
  const hasSeparateTimer = Boolean(data?.timerModelVersion && data.timerProbabilityAligned === false);
  const hasAlignedTimer = Boolean(data?.timerModelVersion && data.timerProbabilityAligned === true);
  return <main className="inner-page"><div className="container">
    <Link className="text-link" href={`/${locale}/occupations/${encodeURIComponent(id)}`}>← {c['common.back']}</Link>
    <div className="page-intro"><h1>{c['method.title']}</h1></div>
    {state !== 'ready' || !data ? <p role={state === 'error' ? 'alert' : 'status'}>{c[state === 'loading' ? 'common.loading' : state === 'missing' ? 'detail.notFound' : 'detail.error']}</p> : <section className="panel" style={{ maxWidth: 860 }}>
      <p>{c['method.intro']}</p><p>{render(c['method.event'], { reduction: pct(data.parameters.eventEmploymentReduction) })}</p>
      <p>{c['method.research']}</p><p>{render(c[data.basis === 'occupation' ? 'method.basisOccupation' : data.basis === 'name_proxy' ? 'method.basisNameProxy' : 'method.basisDefault'], { score: precise(data.exposure) })}</p>{data.clockAdjustment === 'collision-resolution' && typeof data.syntheticDelta === 'number' && typeof data.adjustmentSeconds === 'number' && typeof data.effectiveExposure === 'number' && <><p>{render(c['method.syntheticDelta'], { delta: signed(data.syntheticDelta) })}</p><p>{render(c['method.tieAdjustment'], { seconds: signed(data.adjustmentSeconds) })}</p><p>{render(c['method.effectiveScore'], { score: precise(data.effectiveExposure) })}</p></>}
      {typeof data.researchAccelerationFactor === 'number' && data.researchAccelerationFactor > 1 && typeof data.parameters.accelerationExposureThreshold === 'number' && <p>{render(c['method.accelerated'], { threshold: pct(data.parameters.accelerationExposureThreshold), factor: num(data.researchAccelerationFactor) })}</p>}
      {typeof data.medicalAccelerationFactor === 'number' && data.medicalAccelerationFactor > 1 && <p>{render(c['method.medicalAcceleration'], { factor: num(data.medicalAccelerationFactor) })}</p>}
      {typeof data.governmentAdjustmentFactor === 'number' && data.governmentAdjustmentFactor < 1 && <p>{render(c['method.governmentAdjustment'], { factor: num(data.governmentAdjustmentFactor) })}</p>}
      {data.anthropicObservation && <p>{render(c[data.anthropicObservation.mapping === 'soc_exact' ? 'method.anthropicExact' : 'method.anthropicGroup'], { code: data.anthropicObservation.socCode, score: precise(data.anthropicObservation.value) })} <a className="text-link" href={data.anthropicObservation.sourceUrl} target="_blank" rel="noreferrer">{c['method.source']}</a></p>}
      {data.blsProjection && typeof data.blsProjection.changePercent === 'number' && <p>{render(c['method.blsContext'], { code: data.blsProjection.socCode, change: num(data.blsProjection.changePercent), baseline: String(data.blsProjection.baselineYear), horizon: String(data.blsProjection.horizonYear) })} <a className="text-link" href={data.blsProjection.sourceUrl} target="_blank" rel="noreferrer">{c['method.source']}</a></p>}
      <p>{render(c['method.formula'], { base: num(data.parameters.annualBaseHazard), slope: num(data.parameters.annualExposureHazard) })}</p><p>{c['method.probability']}</p>
      {hasSeparateTimer || hasAlignedTimer ? <>
        <p>{render(c[hasAlignedTimer ? 'method.timerV10' : 'method.timerV9'], { days: num(data.parameters.daysPerYear), baseline: data.baselineAt })}</p>
        <p>{c[hasAlignedTimer ? 'method.timerV10Assumptions' : 'method.timerV9Assumptions']}</p>
        {typeof data.timerTimeFactor === 'number' && Number.isFinite(data.timerTimeFactor) && <p>{render(c['method.timerV9Factor'], { factor: num(data.timerTimeFactor) })}</p>}
        {hasAlignedTimer && typeof data.timerAdjustmentSeconds === 'number' && Number.isFinite(data.timerAdjustmentSeconds) && <p>{render(c['method.timerV10Collision'], { seconds: signed(data.timerAdjustmentSeconds) })}</p>}
        {data.timerEvidence?.robotics && Number.isFinite(data.timerEvidence.robotics.value) && <p>{render(c['method.timerV9Robot'], { code: data.timerEvidence.robotics.onetCode, version: data.timerEvidence.robotics.sourceVersion, score: num(data.timerEvidence.robotics.value) })} <a className="text-link" href={data.timerEvidence.robotics.sourceUrl} target="_blank" rel="noreferrer">{c['method.source']}</a></p>}
        <p>{c['method.timerV9Version']}: {data.timerModelVersion}</p>
      </> : <p>{render(c['method.time'], { days: num(data.parameters.daysPerYear), baseline: data.baselineAt, threshold: pct(data.threshold) })}</p>}<p>{c['method.limit']}</p>
      <p>{c['method.version']}: {data.modelVersion}</p>{data.sourceUrl && <a className="text-link" href={data.sourceUrl} target="_blank" rel="noreferrer">{c['method.source']}</a>}
    </section>}
  </div></main>;
}

'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { calculateCountdown } from '@/lib/countdown';
import { DigitalNumber } from '@/components/DigitalNumber';
import { AnimatedProbability } from '@/components/AnimatedProbability';
import worldMap from '@/data/visual/world-map-110m.json';
import styles from './OccupationDetail.module.css';

type Copy = Record<string, string>;
type Occupation = { id: string; code: string; name: string; classification: string; officialName?: string; componentId?: string | null };
type Parameters = { annualBaseHazard: number; annualExposureHazard: number; defaultExposure: number; daysPerYear: number; eventEmploymentReduction: number; accelerationExposureThreshold?: number };
type Scenario = { probability: number; targetAt: string | null; horizonYear: number; basis: 'occupation' | 'name_proxy' | 'default'; exposure: number; syntheticDelta?: number; effectiveExposure?: number; adjustmentSeconds?: number; clockAdjustment?: string; hazardMultiplier?: number; modelVersion: string; sourceUrl: string | null; sourceTitle: string | null; threshold: number; baselineAt: string; parameters: Parameters };
type Payload = { occupation: Occupation; scenario: Scenario };

function percent(value: number, locale: string) { return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value); }
function Countdown({ target, c }: { target: string; c: Copy }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [target]);
  if (now === null) return null;
  const result = calculateCountdown(target, now);
  if (result.kind === 'invalid') return <p className={styles.empty}>{c['common.unavailable']}</p>;
  if (result.kind === 'elapsed') return <p className={styles.empty}>{c['scenario.elapsed']}</p>;
  const { years, days, hours, minutes, seconds } = result.value;
  const parts: [number, string, number][] = [[years, 'detail.years', 2], [days, 'detail.days', 3], [hours, 'detail.hours', 2], [minutes, 'detail.minutes', 2], [seconds, 'detail.seconds', 2]];
  return <div className={styles.clock} role="timer" aria-live="off">{parts.map(([value, key, width]) => {
    const display = String(value).padStart(width, '0');
    return <div className={styles.clockUnit} key={key}><span className={styles.srOnly}>{display} {c[key]}</span><DigitalNumber value={display} /><span className={styles.unitLabel} aria-hidden="true">{c[key]}</span></div>;
  })}</div>;
}
function Atmosphere() {
  return <div className={styles.atmosphere} aria-hidden="true">
    <svg viewBox={worldMap.viewBox} preserveAspectRatio="xMidYMid slice" className={styles.terrain} focusable="false">
      <path className={styles.landmass} d={worldMap.land} />
      <path className={styles.borders} d={worldMap.borders} />
    </svg>
    <div className={styles.vignette}/>
  </div>;
}
export function OccupationDetail({ locale, id, labelId, c }: { locale: string; id: string; labelId?: string; c: Copy }) {
  const [data, setData] = useState<Payload | null>(null);
  const [state, setState] = useState<'loading'|'ready'|'missing'|'error'>('loading');
  useEffect(() => {
    const controller = new AbortController();
    setState('loading'); setData(null);
    const params = new URLSearchParams({ locale });
    if (labelId) params.set('label', labelId);
    fetch(`/api/scenario/${encodeURIComponent(id)}?${params}`, { signal: controller.signal }).then(async response => {
      if (response.status === 404) { setState('missing'); return; }
      if (!response.ok) throw new Error('request_failed');
      const payload = await response.json() as Payload;
      if (!payload.occupation || !payload.scenario || !Number.isFinite(payload.scenario.probability) || payload.scenario.probability < 0 || payload.scenario.probability > 1 || !Number.isInteger(payload.scenario.horizonYear) || !['occupation','name_proxy','default'].includes(payload.scenario.basis) || !Number.isFinite(payload.scenario.threshold) || payload.scenario.threshold < 0 || payload.scenario.threshold > 1 || !payload.scenario.parameters || !Number.isFinite(payload.scenario.parameters.eventEmploymentReduction) || payload.scenario.parameters.eventEmploymentReduction < 0 || payload.scenario.parameters.eventEmploymentReduction > 1 || !Number.isFinite(payload.scenario.parameters.defaultExposure) || !Number.isFinite(payload.scenario.exposure) || !([payload.scenario.syntheticDelta, payload.scenario.effectiveExposure, payload.scenario.adjustmentSeconds].every(v => v == null) || [payload.scenario.syntheticDelta, payload.scenario.effectiveExposure, payload.scenario.adjustmentSeconds].every(v => typeof v === 'number' && Number.isFinite(v)))) throw new Error('invalid_scenario');
      setData(payload); setState('ready');
    }).catch(() => { if (!controller.signal.aborted) setState('error'); });
    return () => controller.abort();
  }, [id, locale, labelId]);
  const scenario = data?.scenario;
  return <main className={styles.resultPage}><Atmosphere/><div className={styles.content}>
    <Link href={`/${locale}`} className={styles.backLink}>← {c['detail.back']}</Link>
    {state !== 'ready' || !data || !scenario ? <p className={styles.status} role={state === 'error' ? 'alert' : 'status'}>{c[state === 'loading' ? 'common.loading' : state === 'missing' ? 'detail.notFound' : 'detail.error']}</p> : <>
      <section className={styles.resultPanel}>
        <p className={styles.classification}>{data.occupation.classification === 'O*NET-SOC' ? <Link href={`/${locale}/credits/onet`}>{data.occupation.classification}</Link> : data.occupation.classification} / {data.occupation.code}</p>
        <h1 className={styles.occupationName}>{data.occupation.name}</h1>
        <div className={styles.probability}><span>{c['scenario.probability'].replace('{year}', String(scenario.horizonYear))}</span><AnimatedProbability key={data.occupation.id} value={scenario.probability} locale={locale} /></div>
        <div className={styles.timerSection}>{scenario.targetAt ? <Countdown target={scenario.targetAt} c={c} /> : <p className={styles.empty}>{c['common.unavailable']}</p>}</div>
      </section>
      <div className={styles.notes}>
        <p className={styles.badge}>{c['scenario.badge']} · {c['scenario.modelTime']}</p>
        <div className={styles.links}><Link href={`/${locale}/methodology/${encodeURIComponent(id)}`}>{c['scenario.method']}</Link>{scenario.sourceUrl && <a href={scenario.sourceUrl} target="_blank" rel="noreferrer">{c['scenario.source']}</a>}</div>
      </div>
      {data.occupation.componentId && data.occupation.officialName && <p className={styles.badge}>{c['detail.sharedClassification'].replace('{name}', data.occupation.officialName)}</p>}
    </>}
  </div></main>;
}

'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { calculateCountdown } from '@/lib/countdown';
import { hasScenarioAdjustment } from '@/lib/scenario-display';
import { DigitalNumber } from '@/components/DigitalNumber';
import clockStyles from './CompareCountdown.module.css';
import { scenarioComparisonKey, type ScenarioComparable } from '@/lib/scenario-compare';

type Copy = Record<string, string>;
type Item = { id: string; code: string; name: string; classification: string; labelId?: string; componentId?: string | null; officialName?: string };
type Scenario = ScenarioComparable & { probability: number; targetAt: string | null; basis: 'occupation'|'name_proxy'|'default'; exposure: number; syntheticDelta?: number; effectiveExposure?: number; adjustmentSeconds?: number; clockAdjustment?: string; sourceUrl: string|null };
type Detail = { occupation: Item; scenario: Scenario };
function formatPercent(n: number, locale: string) { return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(n); }
function Countdown({ target, copy }: { target: string | null; copy: Copy }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { if (!target) return; setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [target]);
  if (!target) return <span>{copy['common.unavailable']}</span>;
  if (now === null) return <span>{copy['common.loading']}</span>;
  const result = calculateCountdown(target, now);
  if (result.kind === 'invalid') return <span>{copy['common.unavailable']}</span>;
  if (result.kind === 'elapsed') return <span>{copy['scenario.elapsed']}</span>;
  const { years, days, hours, minutes, seconds } = result.value;
  const parts: [number, string, number][] = [[years, 'detail.years', 2], [days, 'detail.days', 3], [hours, 'detail.hours', 2], [minutes, 'detail.minutes', 2], [seconds, 'detail.seconds', 2]];
  return <div className={clockStyles.clock} role="timer" aria-live="off">{parts.map(([value, key, width]) => {
    const display = String(value).padStart(width, '0');
    return <div key={key} className={clockStyles.unit}><span className={clockStyles.srOnly}>{display} {copy[key]}</span><DigitalNumber value={display}/><span className={clockStyles.label} aria-hidden="true">{copy[key]}</span></div>;
  })}</div>;
}
async function loadScenario(id: string, locale: string, signal?: AbortSignal, labelId?: string): Promise<Detail> {
  const params = new URLSearchParams({ locale });
  if (labelId) params.set('label', labelId);
  const response = await fetch(`/api/scenario/${encodeURIComponent(id)}?${params}`, { signal });
  if (!response.ok) throw new Error('request_failed');
  const detail = await response.json() as Detail;
  const s = detail?.scenario;
  if (!detail?.occupation?.id || !s || !Number.isFinite(s.probability) || s.probability < 0 || s.probability > 1 || !Number.isInteger(s.horizonYear) || !Number.isFinite(s.threshold) || s.threshold < 0 || s.threshold > 1 || !s.parameters || ![s.parameters.eventEmploymentReduction, s.parameters.annualBaseHazard, s.parameters.annualExposureHazard, s.parameters.daysPerYear, s.parameters.defaultExposure].every(Number.isFinite) || !s.event || !s.modelId || !s.modelVersion || !s.baselineAt || !['occupation','name_proxy','default'].includes(s.basis) || !Number.isFinite(s.exposure) || !([s.syntheticDelta, s.effectiveExposure, s.adjustmentSeconds].every(v => v == null) || [s.syntheticDelta, s.effectiveExposure, s.adjustmentSeconds].every(v => typeof v === 'number' && Number.isFinite(v)))) throw new Error('invalid_scenario');
  return detail;
}
export default function Compare({ locale, copy }: { locale: string; copy: Copy }) {
  const [query, setQuery] = useState(''); const [results, setResults] = useState<Item[]>([]); const [selected, setSelected] = useState<Detail[]>([]); const [error, setError] = useState(false);
  useEffect(() => {
    const ids = [...new Set((new URLSearchParams(window.location.search).get('ids') || '').split(',').filter(Boolean))].slice(0, 5);
    if (!ids.length) return;
    const controller = new AbortController();
    Promise.allSettled(ids.map(id => loadScenario(id, locale, controller.signal))).then(results => { if (controller.signal.aborted) return; const data = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []); setSelected(current => [...current, ...data.filter(item => !current.some(s => s.occupation.id === item.occupation.id))].slice(0, 5)); if (results.some(result => result.status === 'rejected')) setError(true); });
    return () => controller.abort();
  }, [locale]);
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => { fetch(`/api/occupations?search=${encodeURIComponent(query)}&locale=${encodeURIComponent(locale)}`, { signal: controller.signal }).then(r => { if (!r.ok) throw new Error('request_failed'); return r.json(); }).then(data => { setResults(data.items); setError(false); }).catch(e => { if (e.name !== 'AbortError') setError(true); }); }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, locale]);
  async function add(item: Item) {
    const id = item.id;
    if (selected.length >= 5 || selected.some(s => s.occupation.id === id)) return;
    try { const data = await loadScenario(id, locale, undefined, item.labelId); setSelected(current => current.some(s => s.occupation.id === id) || current.length >= 5 ? current : [...current, data]); setQuery(''); setResults([]); setError(false); } catch { setError(true); }
  }
  const groups = useMemo(() => {
    const result = new Map<string, Detail[]>();
    for (const item of selected) { const key = scenarioComparisonKey(item.scenario); result.set(key, [...(result.get(key) || []), item]); }
    return [...result.entries()];
  }, [selected]);
  return <div className="container compare-shell"><h1>{copy['compare.title']}</h1><p className="scenario-badge">{copy['scenario.badge']}</p>
    <div><label htmlFor="compare-search">{copy['compare.search']}</label> <input id="compare-search" className="field" value={query} onChange={e => setQuery(e.target.value)} /></div>
    <ul>{results.map(item => <li key={`${item.id}:${item.labelId ?? ''}`}><button className="button-secondary" type="button" disabled={selected.length >= 5 || selected.some(s => s.occupation.id === item.id)} onClick={() => add(item)}>{item.name} · {item.code}</button></li>)}</ul>
    {results.some(item => item.classification === 'O*NET-SOC') && <div className="search-attribution"><p>{copy['search.onetMachineTranslation']}</p><p>{copy['detail.onetAttribution']}</p><a href="https://www.onetcenter.org/database.html" target="_blank" rel="noreferrer">{copy['detail.onetDatabase']}</a>{' · '}<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">{copy['detail.onetLicense']}</a></div>}
    {error && <p role="alert">{copy['common.error']}</p>}
    {!selected.length ? <p>{copy['compare.empty']}</p> : <>{groups.length > 1 && <p role="status">{copy['compare.incompatible']}</p>}{groups.map(([key, items]) => {
      const first = items[0].scenario;
      const event = copy['scenario.event'].replace('{reduction}', formatPercent(first.parameters.eventEmploymentReduction, locale));
      const probabilityLabel = copy['scenario.probability'].replace('{year}', String(first.horizonYear));
      const countdownLabel = copy['scenario.countdown'].replace('{threshold}', formatPercent(first.threshold, locale));
      return <section key={key}><p>{event}</p><div className="compare-table-wrap"><table><thead><tr><th scope="col">{copy['compare.title']}</th>{items.map(({ occupation }) => <th scope="col" key={occupation.id}><Link href={`/${locale}/occupations/${encodeURIComponent(occupation.id)}${occupation.componentId ? `?label=${encodeURIComponent(occupation.componentId)}` : ''}`}>{occupation.name}</Link><br /><small>{occupation.classification === 'O*NET-SOC' ? <Link href={`/${locale}/credits/onet`}>{occupation.classification}</Link> : occupation.classification} · {occupation.code}</small>{occupation.componentId && occupation.officialName && <><br /><small>{copy['detail.sharedClassification'].replace('{name}', occupation.officialName)}</small></>}<br /><button type="button" className="button-secondary" onClick={() => setSelected(current => current.filter(s => s.occupation.id !== occupation.id))}>{copy['compare.remove']}</button></th>)}</tr></thead><tbody>
        <tr><th scope="row">{probabilityLabel}</th>{items.map(({ occupation, scenario }) => <td key={occupation.id}><strong>{formatPercent(scenario.probability, locale)}</strong><div className="compare-bar" aria-hidden="true"><span style={{ width: `${scenario.probability * 100}%` }} /></div></td>)}</tr>
        <tr><th scope="row">{countdownLabel}</th>{items.map(({ occupation, scenario }) => <td key={occupation.id} className={clockStyles.timerCell}><Countdown target={scenario.targetAt} copy={copy} /></td>)}</tr>
        <tr><th scope="row">{copy['compare.scenarioBasis']}</th>{items.map(({ occupation, scenario }) => <td key={occupation.id}>{scenario.basis === 'occupation' ? copy['scenario.basisOccupation'] : scenario.basis === 'name_proxy' ? copy['scenario.basisNameProxy'] : copy['scenario.basisDefault'].replace('{score}', new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(scenario.exposure))}<br /><Link className="text-link" href={`/${locale}/methodology/${encodeURIComponent(occupation.id)}`}>{copy['scenario.method']}</Link></td>)}</tr>
      </tbody></table></div>{items.some(({scenario}) => hasScenarioAdjustment(scenario)) && <p className="muted">{copy['scenario.tieAdjustment']}</p>}<p className="muted">{copy['scenario.modelTime']}</p></section>;
    })}</>}
  </div>;
}

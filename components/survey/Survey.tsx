"use client";

import { useEffect, useMemo, useState } from "react";
import { questionIsVisible } from "@/lib/survey-conditions";

type Copy = Record<string, string>;
type Option = { id: string; value: string; text: string };
type Question = { id: string; key: string; type: string; required: boolean; text: string; options: Option[]; condition: unknown };
type Payload = { id: string; policy: { version: string; locale: string; content: string } | null; questions: Question[] };
type Answer = string | string[] | number;
type OccupationSummary = { metrics: { kind: string; value: number | null; unit: string | null; source: { title: string; url: string } }[]; forecasts: { id: string; event: string; country: string; baselineYear: number; horizonYear: number; probability: number | null }[]; reports: { title: string; url: string }[] };

export default function Survey({ occupationId, locale, copy }: { occupationId: string; locale: string; copy: Copy }) {
  const [data, setData] = useState<Payload | null>(null);
  const [occupation, setOccupation] = useState<OccupationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState(false);
  const [token, setToken] = useState("");
  const [deleteToken, setDeleteToken] = useState("");
  const [deleted, setDeleted] = useState(false);
  const [busy, setBusy] = useState(false);
  const byKey = useMemo(() => Object.fromEntries((data?.questions || []).map(q => [q.key, q.id])), [data]);
  const questions = useMemo(() => (data?.questions || []).filter(q => questionIsVisible(q.condition, answers, byKey)), [data, answers, byKey]);
  const answered = questions.filter(q => answers[q.id] !== undefined && (!Array.isArray(answers[q.id]) || (answers[q.id] as string[]).length > 0)).length;
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/questionnaires/${encodeURIComponent(occupationId)}?locale=${encodeURIComponent(locale)}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(setData)
      .catch(e => { if (e.name !== "AbortError") setError(true); }).finally(() => setLoading(false));
    fetch(`/api/occupations/${encodeURIComponent(occupationId)}?locale=${encodeURIComponent(locale)}`, { signal: controller.signal }).then(r => r.ok ? r.json() : null).then(result => { if (result) setOccupation(result.occupation); }).catch(() => {});
    return () => controller.abort();
  }, [occupationId, locale]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || questions.some(q => q.required && (answers[q.id] === undefined || (Array.isArray(answers[q.id]) && !(answers[q.id] as string[]).length)))) { setError(true); return; }
    setError(false);
    if (consent) {
      setBusy(true);
      try {
        const activeAnswers = Object.fromEntries(questions.filter(q => answers[q.id] !== undefined).map(q => [q.id, answers[q.id]]));
        const response = await fetch("/api/survey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ occupationId, questionnaireId: data.id, answers: activeAnswers, consent: true, policyVersion: data.policy?.version, policyLocale: data.policy?.locale }) });
        if (!response.ok) throw new Error();
        const result = await response.json();
        setToken(result.deletionToken);
      } catch { setError(true); setBusy(false); return; }
      setBusy(false);
    }
    setDone(true);
  }
  async function remove() {
    setBusy(true); setError(false);
    try {
      const response = await fetch("/api/survey/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: deleteToken || token }) });
      if (!response.ok) throw new Error();
      setDeleted(true); setToken(""); setDeleteToken("");
    } catch { setError(true); }
    setBusy(false);
  }
  return <div className="container survey-shell">
    <h1>{copy["survey.title"]}</h1>
    {loading ? <p>{copy["common.loading"]}</p> : error && !data ? <p role="alert">{copy["survey.error"]}</p> : !data || !data.questions.length ? <p>{copy["survey.noQuestions"]}</p> : done ? <section className="panel survey-result">
      <h2>{copy["survey.results"]}</h2>
      <h3>{copy["survey.occupationStatistics"]}</h3>{occupation && (occupation.metrics.length || occupation.forecasts.length) ? <><ul>{occupation.metrics.filter(m => m.kind === "ai_exposure").map((m, i) => <li key={i}>{copy["compare.exposure"]}: {m.value == null ? copy["common.unavailable"] : `${m.value} ${m.unit || ""}`} · <a href={m.source.url}>{m.source.title}</a></li>)}{occupation.forecasts.map(f => <li key={f.id}>{copy[`compare.event.${f.event}`] || copy["common.unavailable"]} · {f.country} · {f.baselineYear}–{f.horizonYear}: {f.probability == null ? copy["common.unavailable"] : `${(f.probability * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}%`}</li>)}</ul></> : <p>{copy["common.unavailable"]}</p>}{occupation?.reports.length ? <ul>{occupation.reports.map(r => <li key={r.url}><a href={r.url}>{r.title}</a></li>)}</ul> : null}
      <h3>{copy["survey.personalQualitative"]}</h3><p>{copy["survey.personalUnavailable"]}</p>
      <dl>{questions.filter(q => answers[q.id] !== undefined).map(q => <div key={q.id}><dt>{q.text}</dt><dd>{Array.isArray(answers[q.id]) ? (answers[q.id] as string[]).map(v => q.options.find(o => o.value === v)?.text || v).join(", ") : q.options.find(o => o.value === answers[q.id])?.text || String(answers[q.id])}</dd></div>)}</dl>
      {token && <p><strong>{copy["survey.deleteToken"]}</strong> <code>{token}</code></p>}
    </section> : <form onSubmit={submit} className="survey-form">
      <p>{copy["survey.progress"]} {answered}/{questions.length}</p><progress value={answered} max={questions.length || 1} aria-label={copy["survey.progress"]} />
      {questions.map(q => <fieldset className="panel survey-question" key={q.id}><legend>{q.text}</legend>
        {q.type.toLowerCase() === "range" ? <div><p className="muted">{copy["survey.rangeUnanswered"]}</p><input className="field" type="range" min="0" max="100" value={typeof answers[q.id] === "number" ? answers[q.id] as number : 0} onChange={e => setAnswers({ ...answers, [q.id]: Number(e.target.value) })} aria-label={q.text} /><input className="field" type="number" min="0" max="100" value={typeof answers[q.id] === "number" ? answers[q.id] as number : ""} onChange={e => { const value = e.target.value; if (value === "") { const next = { ...answers }; delete next[q.id]; setAnswers(next); } else { const n = Number(value); if (Number.isInteger(n) && n >= 0 && n <= 100) setAnswers({ ...answers, [q.id]: n }); } }} aria-label={q.text} /></div> : q.options.map(o => <label key={o.id} className="survey-option"><input type={q.type.toLowerCase() === "multiple" ? "checkbox" : "radio"} name={q.id} checked={Array.isArray(answers[q.id]) ? (answers[q.id] as string[]).includes(o.value) : answers[q.id] === o.value} onChange={e => { if (q.type.toLowerCase() === "multiple") { const previous = Array.isArray(answers[q.id]) ? answers[q.id] as string[] : []; setAnswers({ ...answers, [q.id]: e.target.checked ? [...previous, o.value] : previous.filter(v => v !== o.value) }); } else setAnswers({ ...answers, [q.id]: o.value }); }} /> <span>{o.text}</span></label>)}
        {q.type.toLowerCase() === "range" && answers[q.id] !== undefined && <output>{String(answers[q.id])}%</output>}
      </fieldset>)}
      <div className="panel">{data.policy ? <><p>{data.policy.content}</p><label className="survey-option"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> <span>{copy["survey.researchConsent"]}</span></label><p className="muted">{copy["survey.retention"]}</p></> : <p>{copy["survey.consentUnavailable"]}</p>}</div>
      {error && <p role="alert">{copy["survey.required"]}</p>}
      <button className="button" disabled={busy} type="submit">{copy["survey.submit"]}</button>
    </form>}
    <section className="panel survey-delete"><h2>{copy["survey.deleteAction"]}</h2><p>{copy["survey.deletePrompt"]}</p><label><span className="sr-only">{copy["survey.deleteToken"]}</span><input className="field" value={deleteToken} onChange={e => setDeleteToken(e.target.value)} /></label><button className="button-secondary" type="button" disabled={busy || (!deleteToken && !token)} onClick={remove}>{copy["survey.deleteAction"]}</button>{deleted && <p role="status">{copy["survey.deleted"]}</p>}{error && done && <p role="alert">{copy["survey.error"]}</p>}</section>
  </div>;
}






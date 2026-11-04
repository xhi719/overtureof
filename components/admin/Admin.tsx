'use client';
import { useState } from 'react';
type Copy = Record<string, string>;
type Entry = { id: string; key: string; localizations: { locale: string; value: string }[] };
type Report = { id: string; title: string; institution: string; url: string; status: string };
export default function Admin({ copy: c }: { copy: Copy }) {
  const [token, setToken] = useState(''); const [entries, setEntries] = useState<Entry[]>([]); const [reports, setReports] = useState<Report[]>([]);
  const [key, setKey] = useState(''); const [locale, setLocale] = useState('ko'); const [value, setValue] = useState(''); const [message, setMessage] = useState('');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  async function load() {
    try { const [a,b] = await Promise.all([fetch('/api/admin/content', { headers }),fetch('/api/admin/research', { headers })]); if (!a.ok || !b.ok) throw new Error(); setEntries(await a.json()); setReports(await b.json()); setMessage(''); } catch { setMessage(c['admin.error']); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); try { const r = await fetch('/api/admin/content', { method:'PUT', headers, body:JSON.stringify({key,locale,value}) }); if (!r.ok) throw new Error(); await load(); setMessage(c['admin.success']); } catch { setMessage(c['admin.error']); }
  }
  async function review(id: string, status: string) {
    try { const r = await fetch('/api/admin/research', { method:'PATCH',headers,body:JSON.stringify({id,status}) }); if (!r.ok) throw new Error(); await load(); setMessage(c['admin.success']); } catch { setMessage(c['admin.error']); }
  }
  return <div className="container"><h1>{c['admin.title']}</h1><label>{c['admin.token']} <input className="field" type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} /></label> <button type="button" className="button-secondary" onClick={load}>{c['admin.load']}</button>{message && <p role="status">{message}</p>}
    <section className="panel"><h2>{c['admin.content']}</h2><form onSubmit={save}><label>{c['admin.key']} <input className="field" required value={key} onChange={e => setKey(e.target.value)} /></label> <label>{c['admin.locale']} <select className="field" value={locale} onChange={e => setLocale(e.target.value)}>{['ko','en','zh-CN','zh-TW'].map(l => <option key={l} value={l}>{l}</option>)}</select></label><label>{c['admin.value']} <textarea className="field" required value={value} onChange={e => setValue(e.target.value)} /></label> <button className="button" type="submit">{c['admin.save']}</button></form><ul>{entries.map(entry => <li key={entry.id}><button type="button" className="button-secondary" onClick={() => { setKey(entry.key); setValue(entry.localizations.find(l => l.locale === locale)?.value || ''); }}>{entry.key}</button></li>)}</ul></section>
    <section className="panel"><h2>{c['admin.research']}</h2><ul>{reports.map(report => <li key={report.id}><a href={report.url}>{report.title}</a> · {report.institution} · {c[`admin.status.${report.status}`] || c['admin.error']} <button className="button-secondary" type="button" onClick={() => review(report.id, 'approved')}>{c['admin.approve']}</button> <button className="button-secondary" type="button" onClick={() => review(report.id, 'rejected')}>{c['admin.reject']}</button></li>)}</ul></section>
  </div>;
}

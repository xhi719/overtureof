'use client';
import { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';

type Occupation = { id: string; code: string; name: string; classification: string; labelId?: string };
type Result = { items: Occupation[]; total: number; page: number; pageSize: number };
export function OccupationSearch({ locale, c }: { locale: string; c: Record<string, string> }) {
  const [query, setQuery] = useState('');
  const [classification, setClassification] = useState('');
  const [selected, setSelected] = useState<Occupation | null>(null);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [page, setPage] = useState(1);
  const router = useRouter();
  const listId = useId();
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus('loading');
      try {
        const params = new URLSearchParams({ search: query, classification, locale, page: String(page) });
        const response = await fetch(`/api/occupations?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error('request failed');
        setResult(await response.json());
        setStatus('ready');
      } catch (error) { if (!controller.signal.aborted) setStatus('error'); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, classification, locale, page, open]);
  function select(item: Occupation) { setSelected(item); setQuery(item.name); setOpen(false); }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (selected) router.push(`/${locale}/occupations/${encodeURIComponent(selected.id)}${selected.labelId ? `?label=${encodeURIComponent(selected.labelId)}` : ''}`);
    else setOpen(true);
  }
  return <form className="search-panel" id="occupation-search" onSubmit={submit}>
    <div className="search-field"><label htmlFor="occupation-query">{c['hero.searchLabel']}</label><div className="input-wrap"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg><input id="occupation-query" value={query} placeholder={c['hero.placeholder']} autoComplete="off" onFocus={() => setOpen(true)} onChange={e => { setQuery(e.target.value); setSelected(null); setPage(1); setOpen(true); }} onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }} aria-expanded={open} aria-controls={listId} /></div>
      {open && <div className="search-results" id={listId}>
        <div className="results-top"><span>{c['search.results']}</span><button type="button" onClick={() => setOpen(false)} aria-label={c['search.close']}>×</button></div>
        {status === 'loading' && <p className="result-message" role="status">{c['search.loading']}</p>}
        {status === 'error' && <p className="result-message" role="alert">{c['search.databaseError']}</p>}
        {status === 'ready' && result?.items.length === 0 && <p className="result-message">{c['search.empty']}</p>}
        {status === 'ready' && result?.items.map(item => <button className="result-row" type="button" key={`${item.id}:${item.labelId ?? ''}`} onClick={() => select(item)}><span>{item.name}</span><small>{item.classification} · {item.code}</small></button>)}
        {status === 'ready' && result && result.total > result.pageSize && <div className="pagination"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>{c['search.previous']}</button><span>{c['search.page']} {page}</span><button type="button" disabled={page * result.pageSize >= result.total} onClick={() => setPage(page + 1)}>{c['search.next']}</button></div>}
        {status === 'ready' && result?.items.some(item => item.classification === 'O*NET-SOC') && <div className="search-attribution"><p>{c['search.onetMachineTranslation']}</p><p>{c['detail.onetAttribution']}</p><a href="https://www.onetcenter.org/database.html" target="_blank" rel="noreferrer">{c['detail.onetDatabase']}</a>{' · '}<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">{c['detail.onetLicense']}</a></div>}
      </div>}
    </div>
    <div className="category-field"><label htmlFor="classification">{c['hero.categoryLabel']}</label><select id="classification" value={classification} onChange={e => { setClassification(e.target.value); setSelected(null); setPage(1); setOpen(true); }}><option value="">{c['hero.allCategories']}</option><option value="KSCO">{c['classification.ksco']}</option><option value="ISCO">{c['classification.isco']}</option><option value="O*NET-SOC">{c['classification.onet']}</option></select></div>
    <button className="search-submit" type="submit"><span>{c['hero.submit']}</span><span aria-hidden="true">↗</span></button>
  </form>;
}


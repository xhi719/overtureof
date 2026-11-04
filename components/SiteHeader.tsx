'use client';
import Link from 'next/link';
import { useEffect } from 'react';

type Props = { locale: string; c: Record<string, string> };
export function SiteHeader({ locale, c }: Props) {
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return <header className="site-header"><div className="header-inner container">
    <Link className="brand" href={`/${locale}`} aria-label={c['nav.home']}><svg className="brand-symbol" viewBox="0 0 28 28" fill="none" aria-hidden="true" focusable="false"><circle cx="14" cy="14" r="10.5"/><path d="M3.5 17h21M14 6.5v7l4 2"/><circle cx="14" cy="13.5" r="1" fill="currentColor" stroke="none"/></svg><span>{c['site.name']}</span></Link>
    <div className="header-title" aria-hidden="true">{c['hero.question']}</div>
    <nav className="navigation" aria-label={c['nav.search']}><Link href={`/${locale}#occupation-search`}>{c['nav.search']}</Link></nav>
  </div></header>;
}


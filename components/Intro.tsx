import { OccupationSearch } from '@/components/OccupationSearch';
import worldMap from '@/data/visual/world-map-110m.json';

type Props = { locale: string; c: Record<string, string> };

function MapDefinitions() {
  return <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
    <defs><path id="landing-world-land" d={worldMap.land} /><path id="landing-world-borders" d={worldMap.borders} /></defs>
  </svg>;
}

function AbstractMap({ variant }: { variant: 0 | 1 }) {
  const lightId = `landing-map-light-${variant}`;
  const gridId = `landing-map-grid-${variant}`;
  return <svg className="landing-map" viewBox={worldMap.viewBox} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={lightId}><stop offset="0" stopColor="#9b3238" stopOpacity=".44"/><stop offset="1" stopColor="#33090c" stopOpacity="0"/></radialGradient>
      <pattern id={gridId} width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#bb5960" strokeOpacity=".13" strokeWidth=".7" /></pattern>
    </defs>
    <rect width="1440" height="720" fill={`url(#${lightId})`} />
    <use href="#landing-world-land" fill="#711820" stroke="#a83e44" strokeWidth=".7" strokeOpacity=".5" />
    <use href="#landing-world-borders" fill="none" stroke="#d88386" strokeWidth=".8" strokeOpacity=".5" />
    <rect width="1440" height="720" fill={`url(#${gridId})`} />
  </svg>;
}

export function Intro({ locale, c }: Props) {
  return <main className="landing-experience">
    <MapDefinitions />
    <section className="landing-intro">
      <div className="landing-art" aria-hidden="true"><AbstractMap variant={0} /><div className="landing-vignette" /></div>
      <div className="landing-intro-content"><h1>{c['hero.question']}</h1></div>
      <a className="landing-scroll" href="#occupation-search-section" aria-label={c['nav.search']}>
        <svg viewBox="0 0 36 36" aria-hidden="true" focusable="false"><path d="M18 5v22m-8-8 8 8 8-8" /></svg>
      </a>
    </section>
    <section className="landing-search" id="occupation-search-section">
      <div className="landing-search-art" aria-hidden="true"><AbstractMap variant={1} /><div className="landing-vignette" /></div>
      <div className="landing-search-content container">
        <h2>{c['hero.question']}</h2>
        <OccupationSearch locale={locale} c={c} />
      </div>
    </section>
  </main>;
}

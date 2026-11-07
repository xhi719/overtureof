/* Static presentation of an explicitly exported, public-safe snapshot. */
(() => {
  'use strict';
  const app = document.getElementById('app');
  let snapshot, c, extra, map;
  let selected = null, page = 1, searchTimer, clockTimer, revealTimer, revealFinish;
  const pageSize = 20;
  const methodUrl = 'https://github.com/xhi719/overtureof/blob/main/docs/scenario-probability-v10.md';
  const onetUrl = 'https://www.onetcenter.org/database.html';
  const onetLicense = 'https://creativecommons.org/licenses/by/4.0/';
  const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; };
  const txt = key => c[key];
  function requireContent(keys) {
    if (keys.some(key => typeof c[key] !== 'string' || !c[key])) throw new Error('missing_content');
  }
  function mapSvg() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', map.viewBox); svg.setAttribute('preserveAspectRatio', 'xMidYMid slice'); svg.setAttribute('aria-hidden', 'true');
    const land = document.createElementNS(ns, 'path'); land.setAttribute('d', map.land); land.setAttribute('class', 'landmass');
    const borders = document.createElementNS(ns, 'path'); borders.setAttribute('d', map.borders); borders.setAttribute('class', 'borders');
    svg.append(land, borders); return svg;
  }
  function mapLayer(className) {
    const art = el('div', className); art.setAttribute('aria-hidden', 'true');
    const svg = mapSvg(); svg.setAttribute('class', className === 'atmosphere' ? 'terrain' : 'landing-map');
    art.append(svg, el('div', className === 'atmosphere' ? 'vignette' : 'landing-vignette')); return art;
  }
  function link(text, url, className) { const a = el('a', className, text); a.href = url; return a; }
  function external(text, url) { const a = link(text, url); a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }
  function header() {
    const root = el('header', 'site-header'); const inner = el('div', 'header-inner container');
    const brand = link('', './', 'brand'); brand.setAttribute('aria-label', txt('nav.home'));
    brand.innerHTML = '<svg class="brand-symbol" viewBox="0 0 28 28" fill="none" aria-hidden="true" focusable="false"><circle cx="14" cy="14" r="10.5"/><path d="M3.5 17h21M14 6.5v7l4 2"/><circle cx="14" cy="13.5" r="1" fill="currentColor" stroke="none"/></svg>';
    brand.append(el('span', '', txt('site.name'))); inner.append(brand, el('div', 'header-title', txt('hero.question')));
    const nav = el('nav', 'navigation'); nav.setAttribute('aria-label', txt('nav.search')); nav.append(link(txt('nav.search'), './#occupation-search-section')); inner.append(nav); root.append(inner); return root;
  }
  function attribution() {
    const section = el('div', 'search-attribution'); section.append(el('p', '', txt('search.onetMachineTranslation')), el('p', '', txt('detail.onetAttribution')));
    section.append(external(txt('detail.onetDatabase'), onetUrl), document.createTextNode(' · '), external(txt('detail.onetLicense'), onetLicense)); return section;
  }
  function clearTimers() { clearInterval(clockTimer); clearInterval(revealTimer); clearTimeout(revealFinish); }
  function home() {
    clearTimers(); selected = null; page = 1; app.replaceChildren(header());
    const main = el('main', 'landing-experience'); const intro = el('section', 'landing-intro');
    intro.append(mapLayer('landing-art')); const heading = el('div', 'landing-intro-content'); heading.append(el('h1', '', txt('hero.question'))); intro.append(heading);
    const down = link('', '#occupation-search-section', 'landing-scroll'); down.setAttribute('aria-label', txt('nav.search')); down.innerHTML = '<svg viewBox="0 0 36 36" aria-hidden="true" focusable="false"><path d="M18 5v22m-8-8 8 8 8-8"/></svg>'; intro.append(down);
    const section = el('section', 'landing-search'); section.id = 'occupation-search-section'; section.append(mapLayer('landing-search-art'));
    const body = el('div', 'landing-search-content container'); body.append(el('h2', '', txt('hero.question')));
    const form = el('form', 'search-panel'); form.id = 'occupation-search';
    const field = el('div', 'search-field'); const label = el('label', '', txt('hero.searchLabel')); label.htmlFor = 'occupation-query';
    const wrap = el('div', 'input-wrap'); wrap.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>';
    const input = el('input'); input.id = 'occupation-query'; input.placeholder = txt('hero.placeholder'); input.autocomplete = 'off'; input.setAttribute('aria-controls', 'search-results'); input.setAttribute('aria-expanded', 'false'); wrap.append(input);
    const results = el('div', 'search-results hidden'); results.id = 'search-results'; field.append(label, wrap, results);
    const category = el('div', 'category-field'); const categoryLabel = el('label', '', txt('hero.categoryLabel')); categoryLabel.htmlFor = 'classification';
    const select = el('select'); select.id = 'classification'; [['', 'hero.allCategories'], ['KSCO', 'classification.ksco'], ['O*NET-SOC', 'classification.onet']].forEach(([value, key]) => { const option = el('option', '', txt(key)); option.value = value; select.append(option); }); category.append(categoryLabel, select);
    const submit = el('button', 'search-submit'); submit.type = 'submit'; submit.append(el('span', '', txt('hero.submit'))); const arrow = el('span', '', '↗'); arrow.setAttribute('aria-hidden', 'true'); submit.append(arrow);
    form.append(field, category, submit); body.append(form); section.append(body); main.append(intro, section); app.append(main);
    function renderSearch() {
      const term = input.value.trim().toLocaleLowerCase('ko');
      const list = snapshot.occupations.filter(item => (!select.value || item.classification === select.value) && (!term || [item.name, item.code, ...item.aliases].some(v => v.toLocaleLowerCase('ko').includes(term))));
      const pages = Math.max(1, Math.ceil(list.length / pageSize)); page = Math.min(page, pages);
      results.replaceChildren(); const top = el('div', 'results-top'); top.append(el('span', '', txt('search.results')));
      const close = el('button', '', '×'); close.type = 'button'; close.setAttribute('aria-label', txt('search.close')); close.addEventListener('click', closeResults); top.append(close); results.append(top);
      if (!list.length) results.append(el('p', 'result-message', txt('search.empty')));
      const current = list.slice((page - 1) * pageSize, page * pageSize);
      current.forEach(item => { const button = el('button', 'result-row'); button.type = 'button'; button.append(el('span', '', item.name), el('small', '', `${item.classification} · ${item.code}`)); button.addEventListener('click', () => { clearTimeout(searchTimer); selected = item; input.value = item.name; input.focus(); closeResults(); }); results.append(button); });
      if (pages > 1) { const pager = el('div', 'pagination'); const prev = el('button', '', txt('search.previous')); prev.type = 'button'; prev.disabled = page === 1; prev.addEventListener('click', () => { page--; renderSearch(); }); const next = el('button', '', txt('search.next')); next.type = 'button'; next.disabled = page === pages; next.addEventListener('click', () => { page++; renderSearch(); }); pager.append(prev, el('span', '', `${txt('search.page')} ${page}`), next); results.append(pager); }
      if (current.some(item => item.classification === 'O*NET-SOC')) results.append(attribution());
      results.classList.remove('hidden'); input.setAttribute('aria-expanded', 'true');
    }
    function closeResults() { results.classList.add('hidden'); input.setAttribute('aria-expanded', 'false'); }
    input.addEventListener('focus', renderSearch); input.addEventListener('input', () => { selected = null; page = 1; clearTimeout(searchTimer); searchTimer = setTimeout(renderSearch, 250); });
    input.addEventListener('keydown', e => { if (e.key === 'Escape') closeResults(); });
    select.addEventListener('change', () => { selected = null; page = 1; renderSearch(); });
    form.addEventListener('submit', e => { e.preventDefault(); if (!selected) { renderSearch(); return; } const params = new URLSearchParams({ occupation: selected.id }); if (selected.componentId) params.set('label', selected.componentId); history.pushState(null, '', `?${params}`); render(); window.scrollTo(0, 0); });
  }
  function remaining(target, now) {
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/i.test(target)) return null;
    const end = Date.parse(target); if (!Number.isFinite(end)) return null; if (end <= now) return 'elapsed';
    const start = new Date(now); let years = new Date(end).getUTCFullYear() - start.getUTCFullYear();
    const anniversary = n => { const date = new Date(start), month = date.getUTCMonth(), day = date.getUTCDate(), year = date.getUTCFullYear() + n; date.setUTCDate(1); date.setUTCFullYear(year); date.setUTCMonth(month); date.setUTCDate(Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate())); return date.getTime(); };
    if (anniversary(years) > end) years--; let rest = end - anniversary(years); const days = Math.floor(rest / 86400000); rest %= 86400000; const hours = Math.floor(rest / 3600000); rest %= 3600000; return [years, days, hours, Math.floor(rest / 60000), Math.floor((rest % 60000) / 1000)];
  }
  function probability(target, value) {
    const formatter = new Intl.NumberFormat('ko', { style: 'percent', maximumFractionDigits: 1 }); const sr = el('span', 'srOnly', formatter.format(value)), visible = el('span', '', formatter.format(value)); visible.setAttribute('aria-hidden', 'true'); target.append(sr, visible);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) { revealTimer = setInterval(() => { visible.textContent = formatter.format(Math.floor(Math.random() * 1001) / 1000); }, 75); revealFinish = setTimeout(() => { clearInterval(revealTimer); visible.textContent = formatter.format(value); }, 1650); }
  }
  const digitSegments = { '0':'abcdef', '1':'bc', '2':'abged', '3':'abgcd', '4':'fgbc', '5':'afgcd', '6':'afgecd', '7':'abc', '8':'abcdefg', '9':'abfgcd' };
  const segmentPoints = { a:'9,4 46,4 40,10 15,10', b:'48,6 48,44 43,49 40,44 40,13', c:'48,53 48,91 44,95 40,88 40,56 43,51', d:'9,96 46,96 40,90 15,90', e:'7,53 12,51 15,56 15,88 10,94 7,91', f:'7,9 11,5 15,13 15,44 12,49 7,44', g:'10,50 15,46 40,46 45,50 40,54 15,54' };
  function drawTimerDigits(target, value) {
    if (target.dataset.value === value) return;
    const ns = 'http://www.w3.org/2000/svg';
    const digits = [...value].map(digit => {
      const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 55 100'); svg.setAttribute('class', 'timer-digit'); svg.setAttribute('focusable', 'false');
      for (const [segment, points] of Object.entries(segmentPoints)) { const polygon = document.createElementNS(ns, 'polygon'); polygon.setAttribute('points', points); polygon.setAttribute('class', digitSegments[digit]?.includes(segment) ? 'segment-on' : 'segment-off'); svg.append(polygon); }
      return svg;
    });
    target.replaceChildren(...digits); target.dataset.value = value;
  }
  function result(item) {
    clearTimers(); app.replaceChildren(header()); const main = el('main', 'resultPage'); main.append(mapLayer('atmosphere')); const content = el('div', 'content');
    const back = link(`← ${txt('detail.back')}`, './', 'backLink'); content.append(back); const panel = el('section', 'resultPanel');
    panel.append(el('p', 'classification', `${item.classification} / ${item.code}`)); const name = el('h1', 'occupationName', item.name); name.tabIndex = -1; panel.append(name);
    const prob = el('div', 'probability'); prob.append(el('span', '', txt('scenario.probability').replace('{year}', String(item.horizonYear)))); const number = el('strong', 'probabilityValue'); probability(number, item.probability); prob.append(number); panel.append(prob);
    const timer = el('div', 'timerSection'); panel.append(timer); content.append(panel);
    function updateClock() {
      const value = item.targetAt ? remaining(item.targetAt, Date.now()) : null;
      if (!Array.isArray(value)) { timer.replaceChildren(el('p', 'empty', value === 'elapsed' ? txt('scenario.elapsed') : txt('common.unavailable'))); return; }
      let clock = timer.firstElementChild; if (!clock || !clock.classList.contains('clock')) { clock = el('div', 'clock'); clock.setAttribute('role', 'timer'); clock.setAttribute('aria-live', 'off'); timer.replaceChildren(clock); }
      const labels = ['detail.years', 'detail.days', 'detail.hours', 'detail.minutes', 'detail.seconds'];
      value.forEach((part, i) => { let unit = clock.children[i]; if (!unit) { unit = el('div', 'clockUnit'); const accessible = el('span', 'srOnly'); const visible = el('span', 'number'); visible.setAttribute('aria-hidden', 'true'); const label = el('span', 'unitLabel', txt(labels[i])); label.setAttribute('aria-hidden', 'true'); unit.append(accessible, visible, label); clock.append(unit); } const display = String(part).padStart(i === 1 ? 3 : 2, '0'); unit.children[0].textContent = `${display} ${txt(labels[i])}`; drawTimerDigits(unit.children[1], display); });
    }
    updateClock(); if (item.targetAt) clockTimer = setInterval(updateClock, 1000);
    const notes = el('div', 'notes'); notes.append(el('p', 'badge', `${txt('scenario.badge')} · ${txt('scenario.modelTime')}`));
    const links = el('div', 'links'); links.append(external(txt('scenario.method'), methodUrl)); if (item.sourceUrl && /^https:\/\//i.test(item.sourceUrl)) links.append(external(txt('scenario.source'), item.sourceUrl)); notes.append(links);
    if (item.componentId && item.officialName) notes.append(el('p', 'badge', txt('detail.sharedClassification').replace('{name}', item.officialName)));
    notes.append(el('p', 'static-note', extra['static.notice'].replace('{date}', new Date(snapshot.generatedAt).toLocaleDateString('ko-KR'))));
    if (item.classification === 'O*NET-SOC') notes.append(attribution()); content.append(notes); main.append(content); app.append(main); name.focus({ preventScroll: true });
  }
  function render() {
    const params = new URLSearchParams(location.search), id = params.get('occupation'), componentId = params.get('label');
    if (!id) { home(); return; }
    const item = snapshot.occupations.find(row => row.id === id && (row.componentId || null) === componentId);
    if (item) { result(item); return; }
    clearTimers(); app.replaceChildren(header()); const main = el('main', 'inner-page container'); main.append(el('p', '', txt('detail.notFound')), link(txt('detail.back'), './')); app.append(main);
  }
  window.addEventListener('popstate', render);
  Promise.all([fetch('./snapshot.json').then(r => { if (!r.ok) throw new Error('snapshot_unavailable'); return r.json(); }), fetch('./strings.ko.json').then(r => { if (!r.ok) throw new Error('strings_unavailable'); return r.json(); }), fetch('./world-map-110m.json').then(r => { if (!r.ok) throw new Error('map_unavailable'); return r.json(); })]).then(([data, strings, world]) => {
    snapshot = data; c = data.content; extra = strings; map = world;
    requireContent(['site.name', 'site.description', 'nav.home', 'nav.search', 'hero.question', 'hero.searchLabel', 'hero.placeholder', 'hero.categoryLabel', 'hero.allCategories', 'hero.submit', 'search.results', 'search.empty', 'search.close', 'search.previous', 'search.next', 'search.page', 'search.onetMachineTranslation', 'detail.onetAttribution', 'detail.onetDatabase', 'detail.onetLicense', 'classification.ksco', 'classification.onet', 'detail.back', 'detail.years', 'detail.days', 'detail.hours', 'detail.minutes', 'detail.seconds', 'detail.notFound', 'detail.sharedClassification', 'common.unavailable', 'scenario.badge', 'scenario.probability', 'scenario.modelTime', 'scenario.method', 'scenario.source', 'scenario.elapsed']);
    if (!Array.isArray(snapshot.occupations) || !map.viewBox || !map.land || !map.borders || !extra['static.notice'] || !extra['seo.title'] || !extra['seo.description']) throw new Error('invalid_snapshot');
    document.title = extra['seo.title']; document.querySelector('meta[name="description"]').content = extra['seo.description']; render();
  }).catch(() => { fetch('./strings.ko.json').then(r => r.json()).then(strings => { app.replaceChildren(el('p', 'loading-state', strings['static.error'])); }).catch(() => {}); });
})();

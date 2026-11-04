import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import ksco8 from '@/data/ksco8/classification.json';
import hiddenSearch from '@/data/translation/hidden-search-occupations.json';
import { descendantCodes, hiddenKsco8AncestorCodes, hiddenKsco8SplitParentCodes } from '@/lib/occupation-search-visibility';
import { componentAliasName, componentsFor, occupationComponents } from '@/lib/occupation-components';

export const dynamic = 'force-dynamic';
const normalize = (value: string) => value.normalize('NFC').replace(/\s+/gu, '').toLocaleLowerCase();
const order = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
type Result = { id: string; labelId?: string; code: string; name: string; classification: string };

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const search = (params.get('search') || '').trim().slice(0, 100);
  const classification = (params.get('classification') || '').slice(0, 30);
  const locale = ['ko','en','zh-CN','zh-TW'].includes(params.get('locale') || '') ? params.get('locale')! : 'en';
  const page = Math.max(1, Math.min(100000, Number.parseInt(params.get('page') || '1', 10) || 1));
  const pageSize = 20;
  const hiddenCodes = [...new Set([...hiddenKsco8AncestorCodes, ...hiddenKsco8SplitParentCodes])];
  const parentMatches = search ? ksco8.items.filter(item => hiddenCodes.includes(item.code) && (item.code === search || (hiddenKsco8SplitParentCodes.includes(item.code) && normalize(item.name) === normalize(search)))) : [];
  const descendants = parentMatches.flatMap(parent => descendantCodes(ksco8.items, parent.code));
  const where: Prisma.OccupationWhereInput = {
    ...(classification ? { classification: { system: classification } } : {}),
    NOT: [
      { classification: { system: 'KSCO', version: '8' }, code: { in: hiddenCodes } },
      ...hiddenSearch.items.map(item => ({ classification: { system: item.system, version: item.version }, code: item.code }))
    ],
    ...(search ? { OR: [
      { code: { contains: search, mode: 'insensitive' } },
      { translations: { some: { name: { contains: search, mode: 'insensitive' } } } },
      { aliases: { some: { name: { contains: search, mode: 'insensitive' } } } },
      ...(descendants.length ? [{ classification: { system: 'KSCO', version: '8' }, code: { in: descendants } }] : [])
    ] } : {})
  };
  const approvedNames = [...new Set(occupationComponents.flatMap(item => Object.values(item.names)))];
  try {
    const rows = await prisma.occupation.findMany({
      where,
      include: { classification: true, translations: { where: { locale: { in: [locale, 'ko', 'en'] } } }, aliases: { where: { name: { in: approvedNames } }, select: { locale: true, name: true } } },
      orderBy: [{ code: 'asc' }, { id: 'asc' }]
    });
    const results: Result[] = [];
    for (const row of rows) {
      const translated = row.translations.find(t => t.locale === locale) ?? row.translations.find(t => t.locale === 'ko') ?? row.translations.find(t => t.locale === 'en');
      if (!translated) { console.error('missing_occupation_translation', row.id, locale); continue; }
      const labels = componentsFor(row.classification.system, row.classification.version, row.code).flatMap(item => {
        const name = componentAliasName(item, locale, row.aliases);
        return name === null ? [] : [{ item, name }];
      });
      if (labels.length) {
        const q = normalize(search);
        const matched = q ? labels.filter(label => normalize(label.name).includes(q) || normalize(row.code).includes(q) || Object.values(label.item.names).some(name => normalize(name).includes(q) && row.aliases.some(alias => alias.name === name))) : labels;
        for (const label of matched.length ? matched : labels) results.push({ id: row.id, labelId: label.item.id, code: row.code, name: label.name, classification: row.classification.system });
      } else {
        results.push({ id: row.id, code: row.code, name: translated.name, classification: row.classification.system });
      }
    }
    // Prefer an independently classified official name over a shared group label.
    const rank = (item: Result) => (item.labelId ? 2 : 0) + (item.classification === 'KSCO' ? 0 : 1);
    results.sort((a, b) => rank(a) - rank(b) || order(a.code, b.code) || order(a.id, b.id) || order(a.labelId ?? '', b.labelId ?? ''));
    const seen = new Set<string>();
    const unique = results.filter(item => { const key = normalize(item.name); if (seen.has(key)) return false; seen.add(key); return true; });
    unique.sort((a, b) => order(a.code, b.code) || order(a.id, b.id) || order(a.labelId ?? '', b.labelId ?? ''));
    return NextResponse.json({ items: unique.slice((page - 1) * pageSize, page * pageSize), total: unique.length, page, pageSize }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { console.error('occupation_query_failed', error); return NextResponse.json({ error: 'database_unavailable' }, { status: 503 }); }
}

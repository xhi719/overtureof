import source from '@/data/translation/occupation-components.json';

type Names = Record<string, string>;
export type OccupationComponent = { id: string; system: string; version: string; code: string; names: Names };
const items = source.items as OccupationComponent[];
const byId = new Map<string, OccupationComponent>();
for (const item of items) {
  if (!/^[a-z0-9_]+$/.test(item.id) || byId.has(item.id) || !item.names.ko?.trim()) throw new Error('invalid_occupation_component');
  byId.set(item.id, item);
}
export function componentDisplayName(item: OccupationComponent, locale: string): string {
  return item.names[locale] ?? item.names.ko;
}
type Alias = { locale: string; name: string };
/** The manifest approves identity and spelling; the displayed name comes from the DB alias. */
export function componentAliasName(item: OccupationComponent, locale: string, aliases: readonly Alias[]): string | null {
  const sourceLocale = item.names[locale] ? locale : 'ko';
  const approvedName = componentDisplayName(item, locale);
  return aliases.find(alias => alias.locale === sourceLocale && alias.name === approvedName)?.name ?? null;
}
export function componentsFor(system: string, version: string, code: string): OccupationComponent[] {
  return items.filter(item => item.system === system && item.version === version && item.code === code);
}
/** Resolve only approved IDs attached to the requested official occupation. */
export function resolveOccupationComponent(id: string, system: string, version: string, code: string, locale: string, aliases: readonly Alias[]): { id: string; name: string } | null {
  const item = byId.get(id);
  if (!item || item.system !== system || item.version !== version || item.code !== code) return null;
  const name = componentAliasName(item, locale, aliases);
  return name === null ? null : { id: item.id, name };
}
export const occupationComponents = items;

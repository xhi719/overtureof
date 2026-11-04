import ksco8 from '@/data/ksco8/classification.json';

type ClassificationEntry = { code: string; name: string };

/** Hide an ancestor only when an identically named, more specific entry exists.
 * This affects the search index, not the source classification or its records. */
export function redundantAncestorCodes(entries: readonly ClassificationEntry[]): string[] {
  const byName = new Map<string, ClassificationEntry[]>();
  for (const entry of entries) {
    const key = entry.name.normalize('NFC').replace(/\s+/g, '');
    const peers = byName.get(key) ?? [];
    peers.push(entry);
    byName.set(key, peers);
  }
  return [...byName.values()].flatMap(peers => peers
    .filter(entry => peers.some(other => other.code !== entry.code && other.code.startsWith(entry.code)))
    .map(entry => entry.code)).sort();
}

export const hiddenKsco8AncestorCodes = redundantAncestorCodes(ksco8.items);

/**
 * A combined parent is safely replaceable in search only when every named
 * component has an exclusive, non-catch-all immediate official child. A child
 * still containing every component is not evidence of an actual split.
 * Records and their existing direct links are not modified.
 */
export function splitCoveredParentCodes(entries: readonly ClassificationEntry[]): string[] {
  const children = new Map<string, ClassificationEntry[]>();
  for (const entry of entries) {
    const parent = entry.code.slice(0, -1);
    const group = children.get(parent) ?? [];
    group.push(entry);
    children.set(parent, group);
  }
  const normalize = (text: string) => text.normalize('NFC').replace(/\s+/gu, '');
  return entries.filter(entry => {
    const parts = entry.name.split(/\s+및\s+|\s+또는\s+|[·‧/]/u).map(normalize).filter(Boolean);
    if (parts.length < 2 || new Set(parts).size !== parts.length) return false;
    const candidates = (children.get(entry.code) ?? []).filter(child => !/^(그 외|기타)/u.test(child.name));
    if (candidates.length < parts.length) return false;
    return parts.every(part => candidates.some(child => {
      const name = normalize(child.name);
      return name.includes(part) && parts.every(other => other === part || !name.includes(other));
    }));
  }).map(entry => entry.code).sort();
}

/** All official descendants, including intermediate groups, for exact parent-name searches. */
export function descendantCodes(entries: readonly ClassificationEntry[], parentCode: string): string[] {
  return entries.filter(entry => entry.code.length > parentCode.length && entry.code.startsWith(parentCode)).map(entry => entry.code).sort();
}

export const hiddenKsco8SplitParentCodes = splitCoveredParentCodes(ksco8.items);

type NamedRow = { id: string; translations: { name: string }[] };

/** Suppress repeated Korean display labels only; this does not establish a crosswalk. */
export function duplicateKoreanDisplayIds(ksco: NamedRow[], onet: NamedRow[]): string[] {
  const normalize = (value: string) => value.normalize('NFC').replace(/\s+/g, '');
  const labels = new Set(ksco.flatMap(row => row.translations.map(t => normalize(t.name))));
  return onet.filter(row => row.translations.some(t => labels.has(normalize(t.name)))).map(row => row.id);
}

import data from '@/data/bls-2025-2035/normalized.json';

export type BlsProjection = { onetCode: string; socCode: string; socTitle: string; changePercent: number | null; changePercentRaw: string | null; baselineYear: number; horizonYear: number; sourceUrl: string; crosswalkUrl: string; sourceSha256: string; crosswalkSha256: string; retrievedDate: string; relation: 'official_crosswalk_soc_parent' };
type Row = { socCode: string; socTitle: string; changePercent: number | null; changePercentRaw?: string | null; relation: string };
const rows: Record<string, Row> = data.occupations;

/** US SOC employment change, never an AI-attributed displacement measurement. */
export function blsProjection(system: string, version: string, code: string): BlsProjection | null {
  if (system !== 'O*NET-SOC' || version !== '31.0' || !/^\d{2}-\d{4}\.\d{2}$/.test(code)) return null;
  const row = rows[code];
  if (!row) return null;
  if (!/^\d{2}-\d{4}$/.test(row.socCode) || row.relation !== 'official_crosswalk_soc_parent' || (row.changePercent !== null && !Number.isFinite(row.changePercent))) throw new Error('invalid_bls_projection');
  return { onetCode: code, socCode: row.socCode, socTitle: row.socTitle, changePercent: row.changePercent, changePercentRaw: row.changePercentRaw ?? null, baselineYear: data.metadata.baselineYear, horizonYear: data.metadata.horizonYear, sourceUrl: data.metadata.sourceUrl, crosswalkUrl: data.metadata.crosswalkUrl, sourceSha256: data.metadata.projectionsSha256, crosswalkSha256: data.metadata.crosswalkSha256, retrievedDate: data.metadata.accessed, relation: 'official_crosswalk_soc_parent' };
}

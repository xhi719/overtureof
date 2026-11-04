import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type AnthropicObservation = { socCode: string; socTitle: string; value: number; originalValue: string; mapping: 'soc_exact' | 'soc_group'; sourceUrl: string; sourceDate: string; datasetUrl: string; sourceSha256: string; retrievedDate: string };
type Dataset = {
  metadata: { source_url: string; source_date: string; dataset_url: string; source_sha256: string; retrieved_date: string; count: number };
  records: { soc_code: string; title: string; observed_exposure: string }[];
};

/** Missing or unreadable inputs must not silently change a published scenario. */
export class AnthropicDatasetUnavailableError extends Error {
  constructor() { super('anthropic_dataset_unavailable'); this.name = 'AnthropicDatasetUnavailableError'; }
}

export function createAnthropicObservationLookup(data: Dataset) {
  if (!data || !data.metadata || !Array.isArray(data.records)) throw new Error('invalid_anthropic_dataset');
  const metadata = data.metadata;
  if (!Number.isInteger(metadata.count) || ![metadata.source_url, metadata.source_date, metadata.dataset_url, metadata.source_sha256, metadata.retrieved_date].every(value => typeof value === 'string' && value.length > 0)) throw new Error('invalid_anthropic_dataset');
  const records = new Map<string, { title: string; value: number; originalValue: string }>();
  for (const row of data.records) {
    if (!row || typeof row.soc_code !== 'string' || typeof row.title !== 'string' || typeof row.observed_exposure !== 'string' || !/^\d{2}-\d{4}$/.test(row.soc_code) || !/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(row.observed_exposure) || records.has(row.soc_code)) throw new Error('invalid_anthropic_dataset');
    const value = Number(row.observed_exposure);
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('invalid_anthropic_score');
    records.set(row.soc_code, { title: row.title, value, originalValue: row.observed_exposure });
  }
  if (records.size !== metadata.count) throw new Error('invalid_anthropic_count');
  return (system: string, version: string, code: string): AnthropicObservation | null => {
    if (system !== 'O*NET-SOC' || version !== '31.0' || !/^\d{2}-\d{4}\.\d{2}$/.test(code)) return null;
    const socCode = code.slice(0, 7);
    const match = records.get(socCode);
    if (!match) return null;
    return { socCode, socTitle: match.title, value: match.value, originalValue: match.originalValue, mapping: code.endsWith('.00') ? 'soc_exact' : 'soc_group', sourceUrl: metadata.source_url, sourceDate: metadata.source_date, datasetUrl: metadata.dataset_url, sourceSha256: metadata.source_sha256, retrievedDate: metadata.retrieved_date };
  };
}

let lookup: ReturnType<typeof createAnthropicObservationLookup> | undefined;
export function loadAnthropicObservationLookup(root = process.cwd()): ReturnType<typeof createAnthropicObservationLookup> {
  try {
    const file = join(root, 'data', 'anthropic-labor-2026', 'normalized.json');
    const data = JSON.parse(readFileSync(file, 'utf8')) as Dataset;
    if (data.metadata?.source_sha256 !== '4f0a3adf5feeb2ec5f5d02ab18cc5e851a2a4b8470bde84c0c9335017be12d68' || data.metadata.count !== 756) throw new Error('unexpected_anthropic_dataset');
    return createAnthropicObservationLookup(data);
  } catch {
    throw new AnthropicDatasetUnavailableError();
  }
}
/** US SOC-level observed Claude task exposure; .xx specialties share their parent SOC value. */
export function anthropicObservation(system: string, version: string, code: string): AnthropicObservation | null {
  if (!lookup) lookup = loadAnthropicObservationLookup();
  return lookup(system, version, code);
}

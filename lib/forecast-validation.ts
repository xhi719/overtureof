/** Guardrails for publishing a comparable series; exposure scores are not inputs. */
export type ForecastCandidate = {
  occupationId: string;
  event: string;
  country: string;
  baselineYear: number;
  horizonYear: number;
  threshold: number | null;
  probability: number | null;
  lowerBound: number | null;
  upperBound: number | null;
  status: string;
  origin: string;
  modelId: string | null;
  sourceId: string | null;
};

/** Returns machine-readable error codes, never synthetic estimates. */
export function validateForecastSeries(rows: ForecastCandidate[]): string[] {
  const errors: string[] = [];
  const groups = new Map<string, ForecastCandidate[]>();
  for (const row of rows) {
    if (!row.occupationId || !row.country || !row.event || !Number.isInteger(row.baselineYear) ||
        !Number.isInteger(row.horizonYear) || row.horizonYear < row.baselineYear) errors.push('invalid_dimensions');
    if (row.status !== 'available' || row.probability === null || !Number.isFinite(row.probability) ||
        row.probability < 0 || row.probability > 1) errors.push('invalid_probability');
    if (!row.sourceId && !row.modelId) errors.push('missing_provenance');
    if (row.origin === 'model' && !row.modelId) errors.push('missing_model');
    if (row.origin === 'research' && !row.sourceId) errors.push('missing_source');
    if (!['model', 'research'].includes(row.origin)) errors.push('invalid_origin');
    for (const bound of [row.lowerBound, row.upperBound]) {
      if (bound !== null && (!Number.isFinite(bound) || bound < 0 || bound > 1)) errors.push('invalid_interval');
    }
    if ((row.lowerBound === null) !== (row.upperBound === null) ||
        (row.lowerBound !== null && row.upperBound !== null && row.probability !== null &&
         (row.lowerBound > row.probability || row.upperBound < row.probability))) errors.push('invalid_interval');
    const key = JSON.stringify([row.occupationId, row.event, row.country, row.baselineYear, row.threshold, row.origin, row.modelId, row.sourceId]);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.horizonYear - b.horizonYear);
    for (let i = 1; i < group.length; i++) {
      if (group[i].horizonYear === group[i - 1].horizonYear) errors.push('duplicate_horizon');
      if (group[i].probability !== null && group[i - 1].probability !== null &&
          group[i].probability! < group[i - 1].probability!) errors.push('decreasing_cumulative_probability');
    }
  }
  return [...new Set(errors)];
}

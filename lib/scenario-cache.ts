import { createHash } from 'node:crypto';
import { calculateCoverage, type CoverageConfig, type CoverageJob, type CoverageValues, type ProxyArtifact } from '@/lib/scenario-coverage';
type CoverageCache = { fingerprint: string; value: Map<string, CoverageValues> };
const cacheHost = globalThis as typeof globalThis & { scenarioCoverageCache?: CoverageCache };
/** A cache hit requires an identical DB snapshot and byte-identical model and proxy artifact. */
export function cachedCoverage(config: CoverageConfig, jobs: CoverageJob[], artifact: ProxyArtifact, sourceApproved: boolean): Map<string, CoverageValues> {
  const sorted = [...jobs].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const fingerprint = createHash('sha256').update(JSON.stringify([config, artifact, sourceApproved, sorted]), 'utf8').digest('hex');
  if (cacheHost.scenarioCoverageCache?.fingerprint === fingerprint) return cacheHost.scenarioCoverageCache.value;
  const value = calculateCoverage(config, jobs, artifact, sourceApproved);
  cacheHost.scenarioCoverageCache = { fingerprint, value };
  return value;
}

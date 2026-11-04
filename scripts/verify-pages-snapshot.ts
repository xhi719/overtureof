import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

type Entry = { id: string; code: string; name: string; classification: string; aliases: string[]; componentId?: string; officialName?: string; probability: number; targetAt: string | null; horizonYear: number; sourceUrl: string | null };
type Snapshot = { generatedAt: string; content: Record<string, string>; occupations: Entry[] };

async function main() {
  const data = JSON.parse(await readFile('.runtime/pages/snapshot.json', 'utf8')) as Snapshot;
  assert.deepEqual(Object.keys(data).sort(), ['content','generatedAt','occupations']);
  assert.ok(Number.isFinite(Date.parse(data.generatedAt)) && data.occupations.length > 0);
  const permitted = new Set(['id','code','name','classification','aliases','componentId','officialName','probability','targetAt','horizonYear','sourceUrl']);
  const names = new Set<string>();
  for (const row of data.occupations) {
    assert.ok(Object.keys(row).every(key => permitted.has(key)));
    assert.ok(row.id && row.code && row.name && Array.isArray(row.aliases));
    assert.ok(Number.isFinite(row.probability) && row.probability >= 0 && row.probability <= 1);
    const name = row.name.normalize('NFC').replace(/\s+/gu, '').toLocaleLowerCase();
    assert.ok(!names.has(name)); names.add(name);
  }
  const groups = [
    data.occupations.filter(row => row.classification === 'KSCO' && !row.componentId),
    data.occupations.filter(row => row.classification === 'O*NET-SOC' && !row.componentId),
    data.occupations.filter(row => Boolean(row.componentId)),
  ];
  const examples = groups.flatMap(group => Array.from({ length: Math.min(6, group.length) }, (_, i) => group[Math.floor(i * (group.length - 1) / Math.max(1, Math.min(6, group.length) - 1))]));
  const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3012';
  for (const item of examples) {
    const params = new URLSearchParams({ locale: 'ko' });
    if (item.componentId) params.set('label', item.componentId);
    const response = await fetch(`${base}/api/scenario/${encodeURIComponent(item.id)}?${params}`);
    assert.equal(response.status, 200);
    const api = await response.json() as { occupation: { name: string }; scenario: { probability: number; targetAt: string | null; horizonYear: number; sourceUrl: string | null } };
    assert.equal(item.name, api.occupation.name);
    assert.equal(item.probability, api.scenario.probability);
    assert.equal(item.targetAt, api.scenario.targetAt);
    assert.equal(item.horizonYear, api.scenario.horizonYear);
    assert.equal(item.sourceUrl, api.scenario.sourceUrl);
  }
  console.log(JSON.stringify({ entries: data.occupations.length, checkedApiSamples: examples.length, whitelist: true, uniqueNames: true }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });

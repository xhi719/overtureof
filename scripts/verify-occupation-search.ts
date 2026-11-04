import assert from 'node:assert/strict';

const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3001';
type Item = { id: string; labelId?: string; name: string; code: string; classification: string };
type List = { items: Item[]; total: number; page: number; pageSize: number };
async function list(search: string, page = 1, classification = ''): Promise<List> {
  const params = new URLSearchParams({ locale: 'ko', search, page: String(page), classification });
  const response = await fetch(`${base}/api/occupations?${params}`);
  assert.equal(response.status, 200);
  return response.json() as Promise<List>;
}
async function scenario(item: Item) {
  const params = new URLSearchParams({ locale: 'ko' });
  if (item.labelId) params.set('label', item.labelId);
  const response = await fetch(`${base}/api/scenario/${encodeURIComponent(item.id)}?${params}`);
  assert.equal(response.status, 200);
  return response.json() as Promise<{ occupation: { name: string; officialName: string; componentId: string }; scenario: { probability: number; targetAt: string } }>;
}
async function main() {
  const first = await list('', 1); const second = await list('', 2);
  assert.equal(first.total, second.total);
  assert.equal(first.items.length, first.pageSize); assert.equal(second.items.length, second.pageSize);
  const names = [...first.items, ...second.items].map(item => item.name.normalize('NFC').replace(/\s+/gu, ''));
  assert.equal(new Set(names).size, names.length);
  const doctors = await list('정신건강의학과 및 신경과 전문 의사');
  assert.deepEqual(doctors.items.map(item => item.name), ['정신건강의학과 전문의', '신경과 전문의']);
  assert.equal(doctors.items[0].id, doctors.items[1].id);
  const [a,b] = await Promise.all(doctors.items.map(scenario));
  assert.equal(a.occupation.officialName, '정신건강의학과 및 신경과 전문 의사');
  assert.equal(a.scenario.probability, b.scenario.probability); assert.equal(a.scenario.targetAt, b.scenario.targetAt);
  const invalid = await fetch(`${base}/api/scenario/${doctors.items[0].id}?locale=ko&label=onet_interpreter`);
  assert.equal(invalid.status, 404);
  const actors = await list('배우 및 모델');
  assert.ok(actors.items.some(item => item.name === '배우'));
  assert.ok(actors.items.some(item => item.name === '모델'));
  assert.ok(!actors.items.some(item => item.code === '29329'));
  assert.ok(actors.items.some(item => item.name === '코미디언'));
  const actorCode = await list('2932');
  assert.ok(actorCode.items.some(item => item.name === '배우'));
  assert.ok(actorCode.items.some(item => item.name === '모델'));
  assert.ok(!actorCode.items.some(item => item.code === '2932' || item.code === '29329'));
  const onet = await list('통역사 및 번역가', 1, 'O*NET-SOC');
  assert.deepEqual(onet.items.map(item => item.name), ['통역사', '번역가']);
  console.log(JSON.stringify({ total: first.total, pageSize: first.pageSize, sharedGroup: true, invalidLabelRejected: true, duplicateNames: 0, compositeSearch: true }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });

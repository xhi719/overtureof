import { test } from 'node:test';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { duplicateKoreanDisplayIds, redundantAncestorCodes, hiddenKsco8AncestorCodes } from '../lib/occupation-search-visibility';

test('hide only matching-named ancestors, keeping deepest and unrelated codes', () => {
  const items = [
    { code: '12', name: '가 나' }, { code: '123', name: '가나' },
    { code: '1234', name: '가나' }, { code: '99', name: '가나' },
    { code: '12345', name: '다른 이름' }
  ];
  deepStrictEqual(redundantAncestorCodes(items), ['12', '123']);
  deepStrictEqual(redundantAncestorCodes([...items].reverse()), ['12', '123']);
});

test('hide duplicate Korean display labels only when a KSCO result exists', () => {
  const onet = [{ id: 'a', translations: [{ name: '가 나' }] }, { id: 'b', translations: [{ name: '다' }] }];
  deepStrictEqual(duplicateKoreanDisplayIds([{ id: 'k', translations: [{ name: '가나' }] }], onet), ['a']);
  deepStrictEqual(duplicateKoreanDisplayIds([], onet), []);
});

test('official KSCO8 hierarchy produces stable duplicate exclusions', () => {
  strictEqual(hiddenKsco8AncestorCodes.length, 210);
  strictEqual(hiddenKsco8AncestorCodes.includes('2712'), true);
  strictEqual(hiddenKsco8AncestorCodes.includes('27120'), false);
});

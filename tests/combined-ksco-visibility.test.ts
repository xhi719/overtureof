import test from 'node:test';
import assert from 'node:assert/strict';
import { descendantCodes, hiddenKsco8SplitParentCodes, splitCoveredParentCodes } from '../lib/occupation-search-visibility';

test('hide a combined parent only when separate official children cover all components', () => {
  const rows = [
    { code: '10', name: '배우 및 모델' },
    { code: '101', name: '배우' },
    { code: '102', name: '모델' },
    { code: '103', name: '그 외 배우 및 모델' },
    { code: '20', name: '기계 기술자 및 연구원' },
    { code: '201', name: '공장 기계 기술자 및 연구원' },
    { code: '202', name: '산업 기계 기술자 및 연구원' },
    { code: '30', name: '사진가 및 방송인' },
    { code: '301', name: '사진가' },
    { code: '302', name: '기타 방송인' },
    { code: '40', name: '수학 및 통계 연구원' },
  ];
  assert.deepEqual(splitCoveredParentCodes(rows), ['10']);
  assert.deepEqual(descendantCodes(rows, '10'), ['101', '102', '103']);
});

test('actual KSCO includes actors and models but not unsplit scientific and medical leaf codes', () => {
  assert.equal(hiddenKsco8SplitParentCodes.length, 105);
  for (const code of ['2932', '2914', '2711', '2946']) assert.ok(hiddenKsco8SplitParentCodes.includes(code));
  for (const code of ['29321', '29324', '21123', '24115']) assert.ok(!hiddenKsco8SplitParentCodes.includes(code));
});

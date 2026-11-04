import assert from 'node:assert/strict';
import test from 'node:test';
import { componentAliasName, componentsFor, occupationComponents, resolveOccupationComponent } from '../lib/occupation-components';

test('reviewed component labels are unique and attached to an official parent', () => {
  assert.equal(new Set(occupationComponents.map(item => item.id)).size, occupationComponents.length);
  const items = componentsFor('KSCO', '8', '24115');
  assert.deepEqual(items.map(item => item.names.ko), ['정신건강의학과 전문의', '신경과 전문의']);
  assert.equal(componentsFor('KSCO', '7', '24115').length, 0);
});
test('only an approved alias from the correct official parent and locale can be displayed', () => {
  const aliases = [{ locale: 'ko', name: '정신건강의학과 전문의' }];
  assert.deepEqual(resolveOccupationComponent('ksco_24115_1', 'KSCO', '8', '24115', 'ko', aliases), { id: 'ksco_24115_1', name: '정신건강의학과 전문의' });
  assert.equal(resolveOccupationComponent('ksco_24115_1', 'KSCO', '8', '24116', 'ko', aliases), null);
  assert.equal(resolveOccupationComponent('ksco_24115_1', 'KSCO', '8', '24115', 'ko', [{ locale: 'en', name: aliases[0].name }]), null);
  assert.equal(resolveOccupationComponent('ksco_24115_1', 'KSCO', '8', '24115', 'ko', [{ locale: 'ko', name: '<script>' }]), null);
  assert.equal(resolveOccupationComponent('unknown', 'KSCO', '8', '24115', 'ko', aliases), null);
  assert.equal(componentAliasName(componentsFor('KSCO','8','24115')[0], 'zh-CN', aliases), aliases[0].name);
});

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { calculateCountdown } from '../lib/countdown';
test('counts complete years and remaining days in UTC', () => {
  assert.deepEqual(calculateCountdown('2027-03-04T05:06:07Z', Date.parse('2025-03-01T02:01:02Z')), { kind: 'remaining', value: { years: 2, days: 3, hours: 3, minutes: 5, seconds: 5 } });
});
test('clamps a leap-day anniversary to February 28', () => {
  assert.deepEqual(calculateCountdown('2025-02-28T12:00:00Z', Date.parse('2024-02-29T12:00:00Z')), { kind: 'remaining', value: { years: 1, days: 0, hours: 0, minutes: 0, seconds: 0 } });
});
test('honors timezone offsets and handles elapsed dates', () => {
  assert.deepEqual(calculateCountdown('2026-11-01T09:00:01+09:00', Date.parse('2026-11-01T00:00:00Z')), { kind: 'remaining', value: { years: 0, days: 0, hours: 0, minutes: 0, seconds: 1 } });
  assert.deepEqual(calculateCountdown('2026-11-01T09:00:00+09:00', Date.parse('2026-11-01T00:00:00Z')), { kind: 'elapsed' });
});
test('rejects timestamps without an explicit timezone or without full precision', () => {
  for (const date of ['2030', '2030-01-01', '2030-01-01T12:00:00', 'nonsense']) assert.deepEqual(calculateCountdown(date, Date.now()), { kind: 'invalid' });
});

test('rejects invalid calendar dates rather than normalizing them', () => {
  for (const date of ['2030-02-31T00:00:00Z','2025-02-29T00:00:00Z','2030-04-31T00:00:00Z']) assert.deepEqual(calculateCountdown(date, 0), {kind:'invalid'});
});

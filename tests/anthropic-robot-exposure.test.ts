import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import data from '../data/anthropic-robot-2026/normalized.json';
import { anthropicRobotObservation } from '../lib/anthropic-robot-exposure';

test('all 923 normalized values preserve the pinned source, including zeros', () => {
  const raw = readFileSync('data/anthropic-robot-2026/robot_exposure_occupations.csv');
  assert.equal(createHash('sha256').update(raw).digest('hex'), data.metadata.sourceSha256);
  const lines = raw.toString('utf8').trim().split(/\r?\n/);
  assert.equal(lines.shift(), 'onetsoc_code,occupation_title,robot_exposure_index');
  assert.equal(lines.length, 923);
  const codes = new Set<string>();
  for (const line of lines) {
    const fields = line.match(/^([^,]+),(?:"(?:[^"]|"")*"|[^,]*),([^,]+)$/);
    assert.ok(fields, 'source must remain a single-line CSV row with the expected schema');
    const [, code, value] = fields;
    assert.ok(!codes.has(code), 'source must not contain duplicate codes');
    codes.add(code);
    const mapped = anthropicRobotObservation('O*NET-SOC', '31.0', code);
    assert.equal(mapped?.value, Number(value));
    assert.equal(mapped?.sourceVersion, '29.3');
    assert.equal(mapped?.mapping, 'same_code_cross_version');
    assert.equal(mapped?.sourceUrl, data.metadata.sourceUrl);
  }
  assert.equal(anthropicRobotObservation('O*NET-SOC', '31.0', '11-1011.00')?.value, 0);
  assert.equal(anthropicRobotObservation('O*NET-SOC', '31.0', '53-3054.00')?.value, 2.2235);
});

test('different classifications, unsupported versions, invalid and missing codes are not mapped', () => {
  assert.equal(anthropicRobotObservation('KSCO', '8', '53-3054.00'), null);
  assert.equal(anthropicRobotObservation('ISCO', '08', '53-3054.00'), null);
  assert.equal(anthropicRobotObservation('O*NET-SOC', '29.3', '53-3054.00'), null);
  assert.equal(anthropicRobotObservation('O*NET-SOC', '31.0', '53-3054'), null);
  assert.equal(anthropicRobotObservation('O*NET-SOC', '31.0', '00-0000.00'), null);
});

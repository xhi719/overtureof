import data from '@/data/anthropic-robot-2026/normalized.json';

/** Original Anthropic 0–3 robot task-exposure index, never a probability. */
export type RobotObservation = {
  onetCode: string;
  sourceVersion: string;
  value: number;
  sourceUrl: string;
  mapping: 'same_code_cross_version';
};

/** Return only exact code matches, explicitly noting the 29.3→31.0 version gap. */
export function anthropicRobotObservation(system: string, version: string, code: string): RobotObservation | null {
  if (system !== 'O*NET-SOC' || version !== '31.0' || !/^\d{2}-\d{4}\.\d{2}$/.test(code)) return null;
  const records = data.occupations as Record<string, { value: number }>;
  const row = Object.hasOwn(records, code) ? records[code] : undefined;
  if (!row || !Number.isFinite(row.value) || row.value < 0 || row.value > 3) return null;
  return { onetCode: code, sourceVersion: data.metadata.sourceVersion, value: row.value, sourceUrl: data.metadata.sourceUrl, mapping: 'same_code_cross_version' };
}

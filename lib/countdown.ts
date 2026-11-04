export type CountdownValue = { years: number; days: number; hours: number; minutes: number; seconds: number };
export type CountdownResult = { kind: 'invalid' } | { kind: 'elapsed' } | { kind: 'remaining'; value: CountdownValue };

/** Calculate whole calendar years in UTC and then the remaining days and time.
 * Exact timestamps must carry a timezone; a bare year or date is not enough.
 */
export function calculateCountdown(target: string, now: number): CountdownResult {
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/i.exec(target);
  if (!parts || !Number.isFinite(now)) return { kind: 'invalid' };
  const [, y, m, d, h, min, sec] = parts;
  const year = Number(y), month = Number(m), day = Number(d);
  const validDate = month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year >= 0 && year <= 99 ? year + 400 : year, month, 0)).getUTCDate();
  if (!validDate || Number(h) > 23 || Number(min) > 59 || Number(sec) > 59) return { kind: 'invalid' };
  const end = Date.parse(target);
  if (!Number.isFinite(end)) return { kind: 'invalid' };
  if (end <= now) return { kind: 'elapsed' };
  const start = new Date(now);
  const targetYear = new Date(end).getUTCFullYear();
  if (!Number.isFinite(start.getTime())) return { kind: 'invalid' };
  let years = targetYear - start.getUTCFullYear();
  const anniversary = (yearCount: number) => {
    const date = new Date(start);
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    const year = date.getUTCFullYear() + yearCount;
    date.setUTCDate(1);
    date.setUTCFullYear(year);
    date.setUTCMonth(month);
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
    return date.getTime();
  };
  if (anniversary(years) > end) years--;
  let remaining = end - anniversary(years);
  const days = Math.floor(remaining / 86_400_000); remaining %= 86_400_000;
  const hours = Math.floor(remaining / 3_600_000); remaining %= 3_600_000;
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return { kind: 'remaining', value: { years, days, hours, minutes, seconds } };
}

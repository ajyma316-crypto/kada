/**
 * Работа с календарными датами через «номер дня» (UTC), чтобы часовые пояса
 * и переходы на летнее время не искажали подсчёт дней.
 */
import type { ISODate } from './types';

const MS_DAY = 86_400_000;
export const LUNAR_YEAR_DAYS = 354.36707;
export const SOLAR_YEAR_DAYS = 365.2425;
export const AVG_MONTH_DAYS = SOLAR_YEAR_DAYS / 12;

export function toDayNumber(d: ISODate): number {
  const [y, m, day] = d.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, day) / MS_DAY);
}

export function fromDayNumber(n: number): ISODate {
  return new Date(n * MS_DAY).toISOString().slice(0, 10);
}

export function isValidISODate(d: unknown): d is ISODate {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return fromDayNumber(toDayNumber(d)) === d;
}

/** Локальная дата устройства (а не UTC) — «сегодня» для пользователя. */
export function todayISO(now: Date = new Date()): ISODate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function localDateOf(iso: string): ISODate {
  return todayISO(new Date(iso));
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromDayNumber(toDayNumber(d) + n);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return toDayNumber(b) - toDayNumber(a);
}

/** Полуоткрытый интервал номеров дней [start, end). */
export type Interval = [number, number];

export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = list.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: Interval[] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

export function intervalsLength(list: Interval[]): number {
  return mergeIntervals(list).reduce((s, [a, b]) => s + (b - a), 0);
}

export function intersect(a: Interval[], b: Interval[]): Interval[] {
  const A = mergeIntervals(a);
  const B = mergeIntervals(b);
  const out: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < A.length && j < B.length) {
    const lo = Math.max(A[i][0], B[j][0]);
    const hi = Math.min(A[i][1], B[j][1]);
    if (hi > lo) out.push([lo, hi]);
    if (A[i][1] < B[j][1]) i++;
    else j++;
  }
  return out;
}

export function subtract(a: Interval[], b: Interval[]): Interval[] {
  const B = mergeIntervals(b);
  const out: Interval[] = [];
  for (const [s, e] of mergeIntervals(a)) {
    let cur = s;
    for (const [bs, be] of B) {
      if (be <= cur || bs >= e) continue;
      if (bs > cur) out.push([cur, bs]);
      cur = Math.max(cur, be);
    }
    if (cur < e) out.push([cur, e]);
  }
  return out;
}

/** Диапазон дат «с … по … включительно» → полуоткрытый интервал. */
export function rangeToInterval(start: ISODate, endInclusive: ISODate): Interval {
  return [toDayNumber(start), toDayNumber(endInclusive) + 1];
}

/** Разбивка количества дней на годы/месяцы/дни (приблизительно, для отображения). */
export function humanizeDays(days: number): { years: number; months: number; days: number } {
  const years = Math.floor(days / SOLAR_YEAR_DAYS);
  const rest = days - years * SOLAR_YEAR_DAYS;
  const months = Math.floor(rest / AVG_MONTH_DAYS);
  return { years, months, days: Math.round(rest - months * AVG_MONTH_DAYS) };
}

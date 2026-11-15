/** Агрегации для истории и аналитики. */
import { addDays, daysBetween, localDateOf, todayISO } from './dates';
import { ALL_PRAYERS, emptyCounts, type DebtEvent, type PrayerCounts, type QadaLog } from './types';
import { isActive } from './ledger';

export function countsByDay(logs: QadaLog[]): Map<string, PrayerCounts> {
  const map = new Map<string, PrayerCounts>();
  for (const l of logs) {
    if (!isActive(l)) continue;
    const d = localDateOf(l.createdAt);
    const c = map.get(d) ?? emptyCounts();
    c[l.prayer] += l.count;
    map.set(d, c);
  }
  return map;
}

export const total = (c: PrayerCounts) => ALL_PRAYERS.reduce((s, p) => s + c[p], 0);

export interface Bucket {
  key: string; // YYYY-MM-DD | YYYY-Www | YYYY-MM | YYYY
  start: string;
  counts: PrayerCounts;
  total: number;
}

export type Granularity = 'day' | 'week' | 'month' | 'year';

function bucketStart(date: string, g: Granularity): string {
  if (g === 'day') return date;
  if (g === 'month') return date.slice(0, 7) + '-01';
  if (g === 'year') return date.slice(0, 4) + '-01-01';
  // Неделя начинается с понедельника.
  const dow = (new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7;
  return addDays(date, -dow);
}

function nextStart(start: string, g: Granularity): string {
  if (g === 'day') return addDays(start, 1);
  if (g === 'week') return addDays(start, 7);
  const [y, m] = start.split('-').map(Number);
  if (g === 'month') return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return `${y + 1}-01-01`;
}

/** Последние `count` периодов с заполнением пустых значений нулями. */
export function series(logs: QadaLog[], g: Granularity, count: number, today = todayISO()): Bucket[] {
  const byDay = countsByDay(logs);
  const out: Bucket[] = [];
  let start = bucketStart(today, g);
  const starts: string[] = [start];
  for (let i = 1; i < count; i++) {
    // шаг назад: берём день до начала и находим начало его периода
    start = bucketStart(addDays(start, -1), g);
    starts.unshift(start);
  }
  for (const s of starts) {
    const end = nextStart(s, g);
    const counts = emptyCounts();
    for (const [d, c] of byDay) if (d >= s && d < end) for (const p of ALL_PRAYERS) counts[p] += c[p];
    out.push({ key: s, start: s, counts, total: total(counts) });
  }
  return out;
}

/** Серия дней подряд, в которые восполнен хотя бы один намаз (сегодня можно ещё не отмечать). */
export function streak(logs: QadaLog[], today = todayISO()): number {
  const days = new Set(countsByDay(logs).keys());
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** Средний темп за последние `window` дней (с первого дня учёта, если он позже). */
export function averagePace(logs: QadaLog[], window = 30, today = todayISO()): number {
  const byDay = countsByDay(logs);
  if (byDay.size === 0) return 0;
  const first = [...byDay.keys()].sort()[0];
  const span = Math.min(window, daysBetween(first, today) + 1);
  const from = addDays(today, -(span - 1));
  let s = 0;
  for (const [d, c] of byDay) if (d >= from && d <= today) s += total(c);
  return s / span;
}

/** История остатка задолженности по дням (для графика динамики). */
export function remainingHistory(events: DebtEvent[], logs: QadaLog[], today = todayISO()) {
  const deltaByDay = new Map<string, number>();
  const add = (d: string, v: number) => deltaByDay.set(d, (deltaByDay.get(d) ?? 0) + v);
  for (const e of events) add(localDateOf(e.createdAt), ALL_PRAYERS.reduce((s, p) => s + (e.deltas[p] ?? 0), 0));
  for (const l of logs) if (isActive(l)) add(localDateOf(l.createdAt), -l.count);
  if (deltaByDay.size === 0) return [];
  const days = [...deltaByDay.keys()].sort();
  const out: { date: string; remaining: number }[] = [];
  let cur = 0;
  for (let d = days[0]; d <= today; d = addDays(d, 1)) {
    cur += deltaByDay.get(d) ?? 0;
    out.push({ date: d, remaining: Math.max(0, cur) });
  }
  return out;
}

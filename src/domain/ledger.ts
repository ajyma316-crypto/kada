/** Производные величины: задолженность, восполненное, остаток. */
import { ALL_PRAYERS, emptyCounts, type DebtEvent, type PrayerCounts, type PrayerId, type QadaLog } from './types';

export function debtTotals(events: DebtEvent[]): PrayerCounts {
  const out = emptyCounts();
  for (const e of events) for (const p of ALL_PRAYERS) out[p] += e.deltas[p] ?? 0;
  for (const p of ALL_PRAYERS) out[p] = Math.max(0, out[p]);
  return out;
}

export const isActive = (l: QadaLog) => !l.voidedAt;

export function completedTotals(logs: QadaLog[], filter?: (l: QadaLog) => boolean): PrayerCounts {
  const out = emptyCounts();
  for (const l of logs) if (isActive(l) && (!filter || filter(l))) out[l.prayer] += l.count;
  return out;
}

export function remainingTotals(debt: PrayerCounts, done: PrayerCounts): PrayerCounts {
  const out = emptyCounts();
  for (const p of ALL_PRAYERS) out[p] = Math.max(0, debt[p] - done[p]);
  return out;
}

export const sum = (c: PrayerCounts, only?: PrayerId[]) =>
  (only ?? ALL_PRAYERS).reduce((s, p) => s + c[p], 0);

export interface Summary {
  debt: PrayerCounts;
  done: PrayerCounts;
  remaining: PrayerCounts;
  debtTotal: number;
  doneTotal: number;
  remainingTotal: number;
  /** Доля восполненного 0..1 (засчитывается не больше задолженности). */
  progress: number;
}

export function summarize(events: DebtEvent[], logs: QadaLog[]): Summary {
  const debt = debtTotals(events);
  const done = completedTotals(logs);
  const remaining = remainingTotals(debt, done);
  const debtTotal = sum(debt);
  const remainingTotal = sum(remaining);
  const doneTotal = sum(done);
  const counted = debtTotal - remainingTotal;
  return {
    debt,
    done,
    remaining,
    debtTotal,
    doneTotal,
    remainingTotal,
    progress: debtTotal > 0 ? counted / debtTotal : 0,
  };
}

/** Дельты, которые переводят текущую задолженность в целевую. */
export function deltasTo(current: PrayerCounts, target: PrayerCounts): Partial<PrayerCounts> {
  const d: Partial<PrayerCounts> = {};
  for (const p of ALL_PRAYERS) if (target[p] !== current[p]) d[p] = target[p] - current[p];
  return d;
}

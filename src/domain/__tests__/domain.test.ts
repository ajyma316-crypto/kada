import { describe, expect, it } from 'vitest';
import { subtract, mergeIntervals, intersect } from '../dates';
import { summarize, deltasTo, debtTotals } from '../ledger';
import { project, perDayForTarget, uniformPerDay, perDayForMinutes } from '../plan';
import { series, streak, remainingHistory } from '../stats';
import { emptyCounts, type QadaLog } from '../types';

const counts = (n: number) => ({ ...emptyCounts(), fajr: n, dhuhr: n, asr: n, maghrib: n, isha: n, witr: n });
const log = (id: string, createdAt: string, prayer: QadaLog['prayer'] = 'fajr', count = 1, voidedAt?: string): QadaLog => ({
  id,
  prayer,
  count,
  createdAt,
  voidedAt,
});

describe('intervals', () => {
  it('merge/subtract/intersect', () => {
    expect(mergeIntervals([[5, 10], [1, 6], [20, 21]])).toEqual([[1, 10], [20, 21]]);
    expect(subtract([[0, 10]], [[2, 4], [8, 20]])).toEqual([[0, 2], [4, 8]]);
    expect(intersect([[0, 10]], [[5, 15]])).toEqual([[5, 10]]);
  });
});

describe('ledger', () => {
  it('отменённые записи не учитываются; остаток не уходит в минус', () => {
    const events = [{ id: 'e', createdAt: '2026-01-01T00:00:00Z', kind: 'calculation' as const, deltas: { fajr: 3 } }];
    const logs = [log('1', '2026-01-02T10:00:00Z'), log('2', '2026-01-02T11:00:00Z', 'fajr', 1, '2026-01-02T11:01:00Z'), log('3', '2026-01-03T10:00:00Z', 'dhuhr', 2)];
    const s = summarize(events, logs);
    expect(s.debtTotal).toBe(3);
    expect(s.done.fajr).toBe(1);
    expect(s.remaining.fajr).toBe(2);
    expect(s.remaining.dhuhr).toBe(0);
    expect(s.progress).toBeCloseTo(1 / 3);
  });
  it('deltasTo', () => {
    const cur = debtTotals([{ id: 'a', createdAt: '', kind: 'manual', deltas: { fajr: 10 } }]);
    expect(deltasTo(cur, { ...cur, fajr: 7, isha: 2 })).toEqual({ fajr: -3, isha: 2 });
  });
});

describe('plan', () => {
  it('срок определяется самым долгим намазом', () => {
    const rem = { ...counts(100), fajr: 150 };
    const p = project(rem, uniformPerDay(rem, 2), 1.5, '2026-01-01');
    expect(p.days).toBe(75);
    expect(p.finishDate).toBe('2026-03-17');
  });
  it('блокировка, если темп 0 при долге', () => {
    const rem = counts(10);
    const p = project(rem, { ...uniformPerDay(rem, 1), isha: 0 }, 1.5);
    expect(p.days).toBe(Infinity);
    expect(p.blocked).toEqual(['isha']);
  });
  it('нагрузка к целевой дате', () => {
    const r = perDayForTarget(counts(100), '2026-01-11', '2026-01-01');
    expect(r?.fajr).toBe(10);
    expect(perDayForTarget(counts(100), '2025-01-01', '2026-01-01')).toBeNull();
  });
  it('нагрузка по минутам', () => {
    // комплект: (2+4+4+3+4+3)=20 ракаатов × 1 мин = 20 мин
    expect(perDayForMinutes(counts(100), 45, 1).fajr).toBe(2);
  });
});

describe('stats', () => {
  it('серии по дням и неделям, стрик', () => {
    const logs = [log('a', '2026-01-05T12:00:00'), log('b', '2026-01-06T12:00:00', 'asr', 3), log('c', '2026-01-07T12:00:00')];
    const days = series(logs, 'day', 3, '2026-01-07');
    expect(days.map((d) => d.total)).toEqual([1, 3, 1]);
    const weeks = series(logs, 'week', 2, '2026-01-07');
    expect(weeks[1].start).toBe('2026-01-05');
    expect(weeks[1].total).toBe(5);
    expect(streak(logs, '2026-01-07')).toBe(3);
    expect(streak(logs, '2026-01-08')).toBe(3);
    expect(streak(logs, '2026-01-09')).toBe(0);
    const months = series(logs, 'month', 2, '2026-01-07');
    expect(months[0].start).toBe('2025-12-01');
  });
  it('история остатка', () => {
    const h = remainingHistory(
      [{ id: 'e', createdAt: '2026-01-01T12:00:00', kind: 'calculation', deltas: { fajr: 10 } }],
      [log('a', '2026-01-02T12:00:00', 'fajr', 3)],
      '2026-01-03',
    );
    expect(h.map((x) => x.remaining)).toEqual([10, 7, 7]);
  });
});

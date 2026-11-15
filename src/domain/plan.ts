/** Индивидуальный план возмещения: сроки, нагрузка, сценарии. */
import { addDays, daysBetween, todayISO } from './dates';
import { ALL_PRAYERS, emptyCounts, type PrayerCounts, type PrayerId } from './types';

/** Количество фард-ракаатов (одинаково во всех мазхабах; витр — 3 ракаата у ханафитов). */
export const RAKAHS: Record<PrayerId, number> = { fajr: 2, dhuhr: 4, asr: 4, maghrib: 3, isha: 4, witr: 3 };

export interface PlanProjection {
  /** Дней до полного погашения; Infinity, если по какому-то намазу темп = 0 при ненулевом долге. */
  days: number;
  finishDate: string | null;
  perPrayerDays: PrayerCounts;
  dailyCount: number;
  dailyMinutes: number;
  /** Намазы с долгом, но без ежедневной нагрузки. */
  blocked: PrayerId[];
}

export function project(
  remaining: PrayerCounts,
  perDay: PrayerCounts,
  minutesPerRakah: number,
  today = todayISO(),
): PlanProjection {
  const perPrayerDays = emptyCounts();
  const blocked: PrayerId[] = [];
  let days = 0;
  for (const p of ALL_PRAYERS) {
    if (remaining[p] <= 0) continue;
    if (perDay[p] <= 0) {
      blocked.push(p);
      perPrayerDays[p] = Infinity;
      days = Infinity;
      continue;
    }
    perPrayerDays[p] = Math.ceil(remaining[p] / perDay[p]);
    days = Math.max(days, perPrayerDays[p]);
  }
  const activePerDay = ALL_PRAYERS.filter((p) => remaining[p] > 0);
  const dailyCount = activePerDay.reduce((s, p) => s + perDay[p], 0);
  const dailyMinutes = activePerDay.reduce((s, p) => s + perDay[p] * RAKAHS[p] * minutesPerRakah, 0);
  return {
    days,
    finishDate: Number.isFinite(days) ? addDays(today, days) : null,
    perPrayerDays,
    dailyCount,
    dailyMinutes: Math.round(dailyMinutes),
    blocked,
  };
}

/** Одинаковое количество каждого намаза (с долгом) в день. */
export function uniformPerDay(remaining: PrayerCounts, n: number): PrayerCounts {
  const out = emptyCounts();
  for (const p of ALL_PRAYERS) out[p] = remaining[p] > 0 ? n : 0;
  return out;
}

/** Нагрузка, необходимая, чтобы завершить к целевой дате. */
export function perDayForTarget(remaining: PrayerCounts, target: string, today = todayISO()): PrayerCounts | null {
  const d = daysBetween(today, target);
  if (d <= 0) return null;
  const out = emptyCounts();
  for (const p of ALL_PRAYERS) out[p] = remaining[p] > 0 ? Math.ceil(remaining[p] / d) : 0;
  return out;
}

/** Нагрузка, вписывающаяся в заданное число минут в день (полными «комплектами» намазов). */
export function perDayForMinutes(remaining: PrayerCounts, minutesPerDay: number, minutesPerRakah: number): PrayerCounts {
  const active = ALL_PRAYERS.filter((p) => remaining[p] > 0);
  const setMinutes = active.reduce((s, p) => s + RAKAHS[p] * minutesPerRakah, 0);
  const n = setMinutes > 0 ? Math.max(1, Math.floor(minutesPerDay / setMinutes)) : 0;
  return uniformPerDay(remaining, n);
}

/** Сценарии «что если»: 1…N комплектов в день. */
export function scenarios(remaining: PrayerCounts, minutesPerRakah: number, today = todayISO(), max = 6) {
  return Array.from({ length: max }, (_, i) => {
    const n = i + 1;
    return { n, ...project(remaining, uniformPerDay(remaining, n), minutesPerRakah, today) };
  });
}

/**
 * Слияние данных между устройствами.
 * - Записи (логи и события задолженности) только добавляются → объединение по id.
 * - Отмена записи монотонна: если запись отменена хоть где-то, она отменена везде.
 * - Настройки, план и расчёт — «последняя запись побеждает» по updatedAt.
 */
import type { DebtEvent, QadaLog } from './types';

/** Канонический порядок записей: по времени, при равенстве — по id (детерминированно на всех устройствах). */
export const byCreated = <T extends { createdAt: string; id: string }>(a: T, b: T) =>
  a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

export function mergeLogs(local: QadaLog[], remote: QadaLog[]): QadaLog[] {
  const map = new Map<string, QadaLog>();
  for (const l of local) map.set(l.id, l);
  for (const r of remote) {
    const l = map.get(r.id);
    if (!l) map.set(r.id, r);
    else if (!l.voidedAt && r.voidedAt) map.set(r.id, { ...l, voidedAt: r.voidedAt });
  }
  return [...map.values()].sort(byCreated);
}

export function mergeEvents(local: DebtEvent[], remote: DebtEvent[]): DebtEvent[] {
  const map = new Map<string, DebtEvent>();
  for (const e of [...remote, ...local]) map.set(e.id, e);
  return [...map.values()].sort(byCreated);
}

export function pickNewer<T extends { updatedAt: string }>(a: T | null, b: T | null): T | null {
  if (!a) return b;
  if (!b) return a;
  return b.updatedAt > a.updatedAt ? b : a;
}

/** Какие локальные записи нужно отправить на сервер. */
export function logsToPush(local: QadaLog[], remote: QadaLog[]): QadaLog[] {
  const r = new Map(remote.map((x) => [x.id, x]));
  return local.filter((l) => {
    const x = r.get(l.id);
    return !x || (!!l.voidedAt && !x.voidedAt);
  });
}

export function eventsToPush(local: DebtEvent[], remote: DebtEvent[]): DebtEvent[] {
  const ids = new Set(remote.map((x) => x.id));
  return local.filter((e) => !ids.has(e.id));
}

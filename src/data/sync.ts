/**
 * Двусторонняя синхронизация локального состояния с облаком.
 *
 * Инкрементальный режим (после миграции 0002): с сервера запрашиваются только записи,
 * изменённые после курсора (серверное updated_at), а на сервер отправляются только
 * записи из списка unsynced. Полный режим (первый вход, обновление версии, восстановление
 * копии или база без миграции 0002): скачивается всё и сравнивается с локальными данными.
 *
 * Слияние всегда идемпотентно (merge.ts): повторно полученные записи ничего не портят,
 * поэтому курсор запрашивается с запасом (SAFETY_MS) — так не теряются записи,
 * зафиксированные сервером чуть позже соседних.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { eventsToPush, logsToPush, mergeEvents, mergeLogs, pickNewer } from '../domain/merge';
import type { DebtEvent, Plan, QadaLog, Settings } from '../domain/types';
import { initialState, type CalcState } from './state';
import { actions, getState } from './store';

/** Запас на транзакции, зафиксированные сервером позже соседних (одиночные upsert длятся доли секунды). */
export const SAFETY_MS = 60_000;

export interface Pulled {
  logs: QadaLog[];
  events: DebtEvent[];
  /** Наибольшее серверное updated_at среди полученных (null — ничего не получено). */
  cursor: string | null;
  /** Поддерживает ли сервер выборку по курсору (false — база без миграции 0002). */
  incremental: boolean;
  /** Время сервера, полученное ДО выборки (null, если не incremental). */
  serverTime: string | null;
}

export interface ProfileRow {
  settings: Settings | null;
  plan: Plan | null;
  calc: CalcState | null;
}

/** Всё, что синхронизации нужно от сервера. Реализации: Supabase и имитация для тестов. */
export interface SyncBackend {
  /** since = null — все записи пользователя; иначе — изменённые после since. */
  pull(userId: string, since: string | null): Promise<Pulled>;
  pushLogs(userId: string, logs: QadaLog[]): Promise<void>;
  pushEvents(userId: string, events: DebtEvent[]): Promise<void>;
  getProfile(userId: string): Promise<ProfileRow | null>;
  putProfile(userId: string, p: ProfileRow): Promise<void>;
}

// ---------- Supabase ----------

const PAGE = 1000;

interface LogRow {
  id: string;
  prayer: QadaLog['prayer'];
  count: number;
  created_at: string;
  voided_at: string | null;
  updated_at?: string;
}
interface EventRow {
  id: string;
  created_at: string;
  kind: DebtEvent['kind'];
  deltas: DebtEvent['deltas'];
  note: string | null;
  updated_at?: string;
}

const iso = (t: string) => new Date(t).toISOString();
export const maxIso = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);
export const minIso = (a: string | null, b: string | null) => (!a ? b : !b ? a : a < b ? a : b);
const maxUpdated = (rows: { updated_at?: string }[]) =>
  rows.reduce<string | null>((m, r) => (r.updated_at ? maxIso(m, iso(r.updated_at)) : m), null);
const toLog = (r: LogRow): QadaLog => ({
  id: r.id,
  prayer: r.prayer,
  count: r.count,
  createdAt: iso(r.created_at),
  voidedAt: r.voided_at ? iso(r.voided_at) : null,
});
const toEvent = (r: EventRow): DebtEvent => ({
  id: r.id,
  createdAt: iso(r.created_at),
  kind: r.kind,
  deltas: r.deltas,
  note: r.note ?? undefined,
});

/** Ошибка «нет такой функции» — база ещё без миграции 0002. */
const isMissingFunction = (e: unknown) => {
  const err = e as { code?: string; message?: string } | null;
  return err?.code === 'PGRST202' || err?.code === '42883' || /qada_server_time/.test(err?.message ?? '');
};

/** Ошибка «нет такой колонки» — база ещё без миграции 0002. */
const isMissingColumn = (e: unknown) => {
  const err = e as { code?: string; message?: string } | null;
  return err?.code === '42703' || err?.code === 'PGRST204' || /updated_at/.test(err?.message ?? '');
};

export function supabaseBackend(client: SupabaseClient): SyncBackend {
  /** Постраничная выборка с «ключевой» пагинацией: по (sortCol, id), без пропусков на границах страниц. */
  async function fetchAll<T extends { id: string }>(
    table: string,
    userId: string,
    sortCol: 'updated_at' | 'created_at',
    since: string | null,
  ): Promise<T[]> {
    const out: T[] = [];
    let after: { v: string; id: string } | null = null;
    for (;;) {
      let q = client.from(table).select('*').eq('user_id', userId);
      if (since) q = q.gt(sortCol, since);
      if (after) q = q.or(`${sortCol}.gt.${after.v},and(${sortCol}.eq.${after.v},id.gt.${after.id})`);
      const { data, error } = await q.order(sortCol).order('id').limit(PAGE);
      if (error) throw error;
      const rows = (data ?? []) as (T & Record<string, string>)[];
      out.push(...rows);
      if (rows.length < PAGE) return out;
      const last = rows[rows.length - 1];
      after = { v: last[sortCol], id: last.id };
    }
  }

  async function pullAll(userId: string, sortCol: 'updated_at' | 'created_at', since: string | null): Promise<Pulled> {
    const [logRows, eventRows] = await Promise.all([
      fetchAll<LogRow>('qada_logs', userId, sortCol, since),
      fetchAll<EventRow>('debt_events', userId, sortCol, since),
    ]);
    const incremental = sortCol === 'updated_at';
    const cursor = incremental ? maxUpdated([...logRows, ...eventRows]) : null;
    return { logs: logRows.map(toLog), events: eventRows.map(toEvent), cursor, incremental, serverTime: null };
  }

  async function upsert(table: string, rows: object[]) {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await client.from(table).upsert(rows.slice(i, i + 500), { onConflict: 'id' });
      if (error) throw error;
    }
  }

  return {
    async pull(userId, since) {
      // Время сервера берём ДО выборки: всё, что выборка не увидела, будет иметь updated_at
      // не раньше (serverTime − длительность транзакции).
      const { data: serverTime, error } = await client.rpc('qada_server_time');
      if (error) {
        if (!isMissingFunction(error)) throw error;
        // База без миграции 0002 — работаем как раньше (полная выборка).
        return pullAll(userId, 'created_at', null);
      }
      try {
        const res = await pullAll(userId, 'updated_at', since);
        return { ...res, serverTime: iso(serverTime as string) };
      } catch (e) {
        if (!isMissingColumn(e)) throw e;
        return pullAll(userId, 'created_at', null);
      }
    },
    pushLogs(userId, logs) {
      return upsert(
        'qada_logs',
        logs.map((l) => ({ id: l.id, user_id: userId, prayer: l.prayer, count: l.count, created_at: l.createdAt, voided_at: l.voidedAt ?? null })),
      );
    },
    pushEvents(userId, events) {
      return upsert(
        'debt_events',
        events.map((e) => ({ id: e.id, user_id: userId, created_at: e.createdAt, kind: e.kind, deltas: e.deltas, note: e.note ?? null })),
      );
    },
    async getProfile(userId) {
      const { data, error } = await client.from('profiles').select('settings, plan, calc').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return (data as ProfileRow | null) ?? null;
    },
    async putProfile(userId, p) {
      const { error } = await client.from('profiles').upsert({ user_id: userId, ...p, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
  };
}

// ---------- Алгоритм ----------

/**
 * Привязать локальные данные к аккаунту. Если на устройстве лежат данные
 * другого аккаунта — они очищаются (они уже были синхронизированы с его облаком).
 * Смена владельца всегда означает полную синхронизацию (курсор сбрасывается).
 */
export function adoptLocalData(userId: string) {
  const s = getState();
  if (s.ownerId === userId) return;
  if (s.ownerId && s.ownerId !== userId) actions.replaceFromSync({ ...initialState(), ownerId: userId });
  else actions.replaceFromSync({ ...s, ownerId: userId, syncCursor: null, unsynced: { logs: [], events: [] } });
}

const minus = (isoTime: string, ms: number) => new Date(new Date(isoTime).getTime() - ms).toISOString();

/**
 * Следующий курсор: наибольшее увиденное updated_at, но не позже (время сервера − запас).
 * Ограничение гарантирует, что записи, зафиксированные сервером с задержкой, попадут
 * в следующую выборку; при отсутствии новых записей курсор догоняет последнее изменение.
 */
export function nextCursor(prev: string | null, pulled: string | null, serverTime: string): string {
  return minIso(maxIso(prev, pulled), minus(serverTime, SAFETY_MS))!;
}

export async function syncWith(backend: SyncBackend, userId: string): Promise<void> {
  adoptLocalData(userId);
  const local = getState();
  const full = !local.syncCursor;

  const [pulled, profile] = await Promise.all([
    backend.pull(userId, full ? null : local.syncCursor),
    backend.getProfile(userId),
  ]);
  // Если сервер не поддерживает курсор (нет миграции 0002), каждая синхронизация — полная.
  const serverFull = full || !pulled.incremental;

  // 1. Отправляем на сервер то, чего там нет.
  let pushLogs: QadaLog[];
  let pushEvents: DebtEvent[];
  if (serverFull) {
    pushLogs = logsToPush(local.logs, pulled.logs);
    pushEvents = eventsToPush(local.debtEvents, pulled.events);
  } else {
    const ul = new Set(local.unsynced.logs);
    const ue = new Set(local.unsynced.events);
    pushLogs = local.logs.filter((l) => ul.has(l.id));
    pushEvents = local.debtEvents.filter((e) => ue.has(e.id));
  }
  // События задолженности — раньше отметок (порядок важен для читаемой истории на сервере).
  await backend.pushEvents(userId, pushEvents);
  await backend.pushLogs(userId, pushLogs);
  const cursor =
    pulled.incremental && pulled.serverTime ? nextCursor(full ? null : local.syncCursor, pulled.cursor, pulled.serverTime) : null;

  // 2. Профиль: «последняя запись побеждает».
  const settings = pickNewer(local.settings, profile?.settings ?? null) ?? local.settings;
  const plan = pickNewer(local.plan, profile?.plan ?? null);
  const calc = pickNewer(local.calc, profile?.calc ?? null);
  const ts = (x: { updatedAt: string } | null | undefined) => x?.updatedAt ?? null;
  if (!profile || ts(settings) !== ts(profile.settings) || ts(plan) !== ts(profile.plan) || ts(calc) !== ts(profile.calc)) {
    await backend.putProfile(userId, { settings, plan, calc });
  }

  // 3. Применяем результат локально, учитывая изменения, сделанные за время запроса.
  const latest = getState();
  const pushedLogs = new Set(pushLogs.map((l) => l.id));
  const pushedEvents = new Set(pushEvents.map((e) => e.id));
  // Запись, изменённая на устройстве уже после отправки (например, отменённая), остаётся в unsynced.
  const sentLog = new Map(pushLogs.map((l) => [l.id, l]));
  const latestById = latest.unsynced.logs.length ? new Map(latest.logs.map((l) => [l.id, l])) : new Map<string, QadaLog>();
  const stillUnsyncedLogs = latest.unsynced.logs.filter((id) => !pushedLogs.has(id) || latestById.get(id) !== sentLog.get(id));
  actions.replaceFromSync({
    ...latest,
    ownerId: userId,
    settings: pickNewer(latest.settings, settings) ?? settings,
    plan: pickNewer(latest.plan, plan),
    calc: pickNewer(latest.calc, calc),
    logs: mergeLogs(latest.logs, pulled.logs),
    debtEvents: mergeEvents(latest.debtEvents, pulled.events),
    lastSyncAt: new Date().toISOString(),
    syncCursor: cursor,
    unsynced: {
      logs: stillUnsyncedLogs,
      events: latest.unsynced.events.filter((id) => !pushedEvents.has(id)),
    },
  });
}

export function syncNow(client: SupabaseClient, userId: string): Promise<void> {
  return syncWith(supabaseBackend(client), userId);
}

/** Удалить аккаунт и все его данные на сервере (функция delete_my_account из миграции 0002). */
export async function deleteAccount(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc('delete_my_account');
  if (error) throw error;
}

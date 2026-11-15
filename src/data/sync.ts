/** Двусторонняя синхронизация локального состояния с Supabase. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { eventsToPush, logsToPush, mergeEvents, mergeLogs, pickNewer } from '../domain/merge';
import type { DebtEvent, Plan, QadaLog, Settings } from '../domain/types';
import { initialState, type AppState, type CalcState } from './state';
import { actions, getState } from './store';

const PAGE = 1000;

async function fetchAll<T>(client: SupabaseClient, table: string, userId: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order('created_at')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return out;
  }
}

interface LogRow {
  id: string;
  prayer: QadaLog['prayer'];
  count: number;
  created_at: string;
  voided_at: string | null;
}
interface EventRow {
  id: string;
  created_at: string;
  kind: DebtEvent['kind'];
  deltas: DebtEvent['deltas'];
  note: string | null;
}

const toLog = (r: LogRow): QadaLog => ({
  id: r.id,
  prayer: r.prayer,
  count: r.count,
  createdAt: new Date(r.created_at).toISOString(),
  voidedAt: r.voided_at ? new Date(r.voided_at).toISOString() : null,
});
const toEvent = (r: EventRow): DebtEvent => ({
  id: r.id,
  createdAt: new Date(r.created_at).toISOString(),
  kind: r.kind,
  deltas: r.deltas,
  note: r.note ?? undefined,
});

async function upsertChunks(client: SupabaseClient, table: string, rows: object[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await client.from(table).upsert(rows.slice(i, i + 500), { onConflict: 'id' });
    if (error) throw error;
  }
}

/**
 * Привязать локальные данные к аккаунту. Если на устройстве лежат данные
 * другого аккаунта — они очищаются (они уже были синхронизированы с его облаком).
 */
export function adoptLocalData(userId: string) {
  const s = getState();
  if (s.ownerId === userId) return;
  if (s.ownerId && s.ownerId !== userId) actions.replaceFromSync({ ...initialState(), ownerId: userId });
  else actions.replaceFromSync({ ...s, ownerId: userId });
}

export async function syncNow(client: SupabaseClient, userId: string): Promise<void> {
  adoptLocalData(userId);

  const [remoteLogs, remoteEvents, profileRes] = await Promise.all([
    fetchAll<LogRow>(client, 'qada_logs', userId).then((r) => r.map(toLog)),
    fetchAll<EventRow>(client, 'debt_events', userId).then((r) => r.map(toEvent)),
    client.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
  ]);
  if (profileRes.error) throw profileRes.error;
  const profile = profileRes.data as { settings: Settings | null; plan: Plan | null; calc: CalcState | null } | null;

  const local = getState();

  // 1. Отправляем на сервер то, чего там нет.
  const pushLogs = logsToPush(local.logs, remoteLogs).map((l) => ({
    id: l.id,
    user_id: userId,
    prayer: l.prayer,
    count: l.count,
    created_at: l.createdAt,
    voided_at: l.voidedAt ?? null,
  }));
  const pushEvents = eventsToPush(local.debtEvents, remoteEvents).map((e) => ({
    id: e.id,
    user_id: userId,
    created_at: e.createdAt,
    kind: e.kind,
    deltas: e.deltas,
    note: e.note ?? null,
  }));
  await upsertChunks(client, 'debt_events', pushEvents);
  await upsertChunks(client, 'qada_logs', pushLogs);

  // 2. Сливаем данные.
  const settings = pickNewer(local.settings, profile?.settings ?? null) ?? local.settings;
  const plan = pickNewer(local.plan, profile?.plan ?? null);
  const calc = pickNewer(local.calc, profile?.calc ?? null);

  const ts = (x: { updatedAt: string } | null | undefined) => x?.updatedAt ?? null;
  const profileChanged =
    !profile ||
    ts(settings) !== ts(profile.settings) ||
    ts(plan) !== ts(profile.plan) ||
    ts(calc) !== ts(profile.calc);
  if (profileChanged) {
    const { error } = await client
      .from('profiles')
      .upsert({ user_id: userId, settings, plan, calc, updated_at: new Date().toISOString() });
    if (error) throw error;
  }

  // 3. Применяем результат локально (с учётом изменений, сделанных за время запроса).
  const latest = getState();
  const next: AppState = {
    ...latest,
    ownerId: userId,
    settings: pickNewer(latest.settings, settings) ?? settings,
    plan: pickNewer(latest.plan, plan),
    calc: pickNewer(latest.calc, calc),
    logs: mergeLogs(latest.logs, remoteLogs),
    debtEvents: mergeEvents(latest.debtEvents, remoteEvents),
    lastSyncAt: new Date().toISOString(),
  };
  actions.replaceFromSync(next);
}

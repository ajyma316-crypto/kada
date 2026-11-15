/**
 * Локальное хранилище приложения (offline-first).
 *
 * Состояние живёт в памяти (интерфейс читает его синхронно), а на устройство
 * сохраняется асинхронно через слой persistence (IndexedDB). Частые изменения
 * (быстрые нажатия «+1») объединяются в одну запись. Если сохранить не удалось,
 * состояние saveStatus = 'error' — интерфейс показывает предупреждение.
 *
 * Внешний API (getState, useStore, actions, onUserChange) не изменился.
 */
import { useSyncExternalStore } from 'react';
import { uid } from '../lib/id';
import { debtTotals, deltasTo } from '../domain/ledger';
import type { CalcInput, CalcResult, DebtEvent, Plan, PrayerCounts, PrayerId, QadaLog, Settings } from '../domain/types';
import { initialState, normalizeState, type AppState } from './state';
import {
  THEME_KEY,
  hasIndexedDb,
  indexedDbPersistence,
  loadWithMigration,
  localStoragePersistence,
  type Persistence,
} from './persistence';

type Listener = () => void;

let state: AppState = initialState();
let persistence: Persistence | null = null;
/** Последнее состояние, успешно записанное на устройство. */
let persisted: AppState | null = null;
let writing: Promise<void> | null = null;
let pending = false;

export type SaveStatus = 'ok' | 'saving' | 'error';
let saveStatus: SaveStatus = 'ok';
let saveError: string | null = null;

const listeners = new Set<Listener>();
const statusListeners = new Set<Listener>();
const changeListeners = new Set<Listener>();
const channel: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('qada') : null;

function emit() {
  listeners.forEach((l) => l());
}

function setStatus(s: SaveStatus, err: string | null = null) {
  if (s === saveStatus && err === saveError) return;
  saveStatus = s;
  saveError = err;
  statusListeners.forEach((l) => l());
}

/** Тема хранится отдельно в localStorage — её читает index.html до загрузки приложения (без вспышки). */
function rememberTheme(s: AppState) {
  try {
    localStorage.setItem(THEME_KEY, s.settings.theme);
  } catch {
    /* не критично */
  }
}

/** Записать на устройство всё, что изменилось с прошлой записи. Записи идут строго по очереди. */
function flush(): Promise<void> {
  if (!persistence) return Promise.resolve();
  if (writing) {
    pending = true;
    return writing;
  }
  writing = (async () => {
    try {
      do {
        pending = false;
        const target = state;
        if (target === persisted) continue;
        setStatus('saving', saveError);
        await persistence!.save(persisted, target);
        persisted = target;
        channel?.postMessage('changed');
      } while (pending || state !== persisted);
      setStatus('ok');
    } catch (e) {
      // persisted не обновляется — при следующей попытке будут записаны все накопленные изменения.
      setStatus('error', e instanceof Error ? e.message : String(e));
    } finally {
      writing = null;
    }
  })();
  return writing;
}

let scheduled = false;
function scheduleFlush() {
  if (scheduled) return;
  scheduled = true;
  // Объединяем изменения одного «тика» (например, несколько действий подряд) в одну запись.
  queueMicrotask(() => {
    scheduled = false;
    void flush();
  });
}

function set(updater: (s: AppState) => AppState, opts: { local?: boolean } = {}) {
  const prev = state;
  state = updater(state);
  if (state === prev) return;
  if (state.settings.theme !== prev.settings.theme) rememberTheme(state);
  scheduleFlush();
  emit();
  if (!opts.local) changeListeners.forEach((l) => l());
}

/**
 * Загрузить данные с устройства. Вызывается один раз до первой отрисовки.
 * При первом запуске новой версии переносит данные из localStorage.
 */
export async function initStore(p?: Persistence): Promise<{ migrated: boolean }> {
  // IndexedDB — основной вариант; localStorage — запасной (если IndexedDB недоступна,
  // например в приватном режиме старых браузеров).
  const candidates = p ? [p] : hasIndexedDb() ? [indexedDbPersistence(), localStoragePersistence()] : [localStoragePersistence()];
  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      const { state: loaded, migrated } = await loadWithMigration(candidate);
      persistence = candidate;
      if (loaded) {
        state = loaded;
        persisted = loaded;
      } else {
        persisted = null; // первая запись будет полной
      }
      rememberTheme(state);
      emit();
      requestPersistentStorage();
      return { migrated };
    } catch (e) {
      lastError = e;
    }
  }
  persistence = candidates[candidates.length - 1];
  setStatus('error', lastError instanceof Error ? lastError.message : String(lastError));
  return { migrated: false };
}

/** Просим браузер не удалять данные при нехватке места (Chrome, Safari 15.2+, Firefox). */
function requestPersistentStorage() {
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* не поддерживается */
  }
}

/** Дождаться записи всех изменений (используется перед выходом из аккаунта и в тестах). */
export function flushStore(): Promise<void> {
  return flush();
}

/** Повторить запись после ошибки. */
export function retrySave(): Promise<void> {
  return flush();
}

// Другая вкладка изменила данные — перечитываем их.
channel?.addEventListener('message', async () => {
  if (!persistence || writing) return;
  try {
    const loaded = await persistence.load();
    if (loaded) {
      state = loaded;
      persisted = loaded;
      emit();
    }
  } catch {
    /* следующая запись всё равно синхронизирует */
  }
});

// Перед сворачиванием/закрытием — записать незавершённые изменения.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
}

/** Подписка на изменения данных пользователем (для автосинхронизации). */
export function onUserChange(l: Listener) {
  changeListeners.add(l);
  return () => changeListeners.delete(l);
}

export function getState() {
  return state;
}

export function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

function subscribeStatus(l: Listener) {
  statusListeners.add(l);
  return () => statusListeners.delete(l);
}

export function useSaveStatus(): { status: SaveStatus; error: string | null } {
  const status = useSyncExternalStore(subscribeStatus, () => saveStatus);
  const error = useSyncExternalStore(subscribeStatus, () => saveError);
  return { status, error };
}

const now = () => new Date().toISOString();

/** Отметить записи как ещё не отправленные (только если данные привязаны к аккаунту). */
function markUnsynced(s: AppState, ids: { logs?: string[]; events?: string[] }): AppState['unsynced'] {
  if (!s.ownerId) return s.unsynced;
  const add = (list: string[], extra?: string[]) => (extra?.length ? [...new Set([...list, ...extra])] : list);
  return { logs: add(s.unsynced.logs, ids.logs), events: add(s.unsynced.events, ids.events) };
}

export const actions = {
  updateSettings(patch: Partial<Settings>) {
    set((s) => ({ ...s, settings: { ...s.settings, ...patch, updatedAt: now() } }));
  },

  saveCalc(input: CalcInput, result: CalcResult | null) {
    set((s) => ({ ...s, calc: { input, result, updatedAt: now() } }));
  },

  /** Установить задолженность равной результату расчёта (с записью в историю изменений). */
  applyDebt(target: PrayerCounts, kind: DebtEvent['kind'], note?: string) {
    set((s) => {
      const deltas = deltasTo(debtTotals(s.debtEvents), target);
      if (Object.keys(deltas).length === 0) return s;
      const ev: DebtEvent = { id: uid(), createdAt: now(), kind, deltas, note };
      return { ...s, debtEvents: [...s.debtEvents, ev], unsynced: markUnsynced(s, { events: [ev.id] }) };
    });
  },

  logPrayer(prayer: PrayerId, count = 1): QadaLog {
    const l: QadaLog = { id: uid(), prayer, count, createdAt: now(), voidedAt: null };
    set((s) => ({ ...s, logs: [...s.logs, l], unsynced: markUnsynced(s, { logs: [l.id] }) }));
    return l;
  },

  voidLog(id: string) {
    set((s) => ({
      ...s,
      logs: s.logs.map((l) => (l.id === id && !l.voidedAt ? { ...l, voidedAt: now() } : l)),
      unsynced: markUnsynced(s, { logs: [id] }),
    }));
  },

  setPlan(plan: Omit<Plan, 'updatedAt'> | null) {
    set((s) => ({ ...s, plan: plan ? { ...plan, updatedAt: now() } : null }));
  },

  /** Используется синхронизацией: заменить данные без повторного запуска синхронизации. */
  replaceFromSync(next: AppState) {
    set(() => next, { local: true });
  },

  importState(raw: unknown) {
    const next = normalizeState(raw);
    // После восстановления копии следующая синхронизация — полная (сравнит всё с сервером).
    set((s) => ({ ...next, ownerId: s.ownerId, lastSyncAt: null, syncCursor: null, unsynced: { logs: [], events: [] } }));
  },

  /** Полная очистка данных на устройстве. */
  resetLocal() {
    set(() => initialState(), { local: true });
  },
};

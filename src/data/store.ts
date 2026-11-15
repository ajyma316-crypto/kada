/**
 * Локальное хранилище приложения (offline-first).
 * Источник истины на устройстве — localStorage; облако лишь синхронизируется с ним.
 * Реализовано без сторонних библиотек через useSyncExternalStore.
 */
import { useSyncExternalStore } from 'react';
import { uid } from '../lib/id';
import { debtTotals, deltasTo } from '../domain/ledger';
import type { CalcInput, CalcResult, DebtEvent, Plan, PrayerCounts, PrayerId, QadaLog, Settings } from '../domain/types';
import { initialState, normalizeState, type AppState } from './state';

const KEY = 'qada:v1';
type Listener = () => void;

let state: AppState = load();
const listeners = new Set<Listener>();

function load(): AppState {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return initialState();
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('QADA: не удалось сохранить данные', e);
  }
}

function set(updater: (s: AppState) => AppState, opts: { local?: boolean } = {}) {
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
  if (!opts.local) changeListeners.forEach((l) => l());
}

/** Подписка на изменения данных пользователем (для автосинхронизации). */
const changeListeners = new Set<Listener>();
export function onUserChange(l: Listener) {
  changeListeners.add(l);
  return () => changeListeners.delete(l);
}

// Синхронизация между вкладками браузера.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = load();
      listeners.forEach((l) => l());
    }
  });
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

const now = () => new Date().toISOString();

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
      return { ...s, debtEvents: [...s.debtEvents, ev] };
    });
  },

  logPrayer(prayer: PrayerId, count = 1): QadaLog {
    const l: QadaLog = { id: uid(), prayer, count, createdAt: now(), voidedAt: null };
    set((s) => ({ ...s, logs: [...s.logs, l] }));
    return l;
  },

  voidLog(id: string) {
    set((s) => ({
      ...s,
      logs: s.logs.map((l) => (l.id === id && !l.voidedAt ? { ...l, voidedAt: now() } : l)),
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
    set((s) => ({ ...next, ownerId: s.ownerId, lastSyncAt: null }));
  },

  /** Полная очистка данных на устройстве. */
  resetLocal() {
    set(() => initialState(), { local: true });
  },
};

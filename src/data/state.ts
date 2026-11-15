/** Форма сохраняемого состояния приложения и его миграция/валидация. */
import { defaultCalcInput } from '../domain/calculator';
import type { CalcInput, CalcResult, DebtEvent, Plan, QadaLog, Settings } from '../domain/types';

export interface CalcState {
  input: CalcInput;
  result: CalcResult | null;
  updatedAt: string;
}

export interface AppState {
  v: 1;
  /** id пользователя Supabase, которому принадлежат локальные данные (null — локальный режим). */
  ownerId: string | null;
  settings: Settings;
  calc: CalcState | null;
  debtEvents: DebtEvent[];
  logs: QadaLog[];
  plan: Plan | null;
  lastSyncAt: string | null;
  /**
   * Курсор инкрементальной синхронизации: наибольшее серверное updated_at, уже полученное
   * с сервера. null — следующая синхронизация будет полной (первый вход, обновление версии).
   */
  syncCursor: string | null;
  /** Записи, созданные/изменённые на этом устройстве и ещё не отправленные на сервер (только при входе). */
  unsynced: { logs: string[]; events: string[] };
}

const EPOCH = '1970-01-01T00:00:00.000Z';

export function initialState(): AppState {
  const nav = typeof navigator !== 'undefined' ? navigator.language ?? '' : '';
  const lang: Settings['lang'] = nav.startsWith('ky') ? 'ky' : nav.startsWith('en') ? 'en' : 'ru';
  return {
    v: 1,
    ownerId: null,
    settings: {
      madhab: 'hanafi',
      gender: 'male',
      theme: 'system',
      lang,
      includeWitr: true,
      updatedAt: EPOCH,
    },
    calc: null,
    debtEvents: [],
    logs: [],
    plan: null,
    lastSyncAt: null,
    syncCursor: null,
    unsynced: { logs: [], events: [] },
  };
}

/** Мягкая проверка загруженных данных (localStorage или импорт). */
export function normalizeState(raw: unknown): AppState {
  const base = initialState();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<AppState>;
  if (r.v !== 1) return base;
  return {
    ...base,
    ...r,
    settings: { ...base.settings, ...(r.settings ?? {}) },
    calc: r.calc ? { ...r.calc, input: { ...defaultCalcInput(), ...r.calc.input } } : null,
    debtEvents: Array.isArray(r.debtEvents) ? r.debtEvents : [],
    logs: Array.isArray(r.logs) ? r.logs.filter((l) => l && typeof l.id === 'string' && l.count > 0) : [],
    syncCursor: typeof r.syncCursor === 'string' ? r.syncCursor : null,
    unsynced: {
      logs: Array.isArray(r.unsynced?.logs) ? r.unsynced.logs : [],
      events: Array.isArray(r.unsynced?.events) ? r.unsynced.events : [],
    },
  };
}

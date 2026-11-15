/**
 * Постоянное хранение данных на устройстве.
 *
 * Почему не localStorage: его лимит ~5 МБ, а 20 000 отметок занимают ≈ 4,9 МБ —
 * при переполнении данные переставали бы сохраняться. Кроме того, localStorage
 * приходилось переписывать целиком при каждом нажатии «+1».
 *
 * IndexedDB:
 *  - объём ограничен только свободным местом устройства;
 *  - отметки лежат отдельными записями (store `logs`, ключ — id), поэтому
 *    при «+1» записывается одна запись, а не вся история;
 *  - остальное состояние (настройки, план, расчёт, события задолженности) —
 *    одна запись в store `meta`.
 *
 * Модуль не знает о React и о логике приложения: принимает и отдаёт AppState.
 */
import { byCreated } from '../domain/merge';
import type { QadaLog } from '../domain/types';
import { normalizeState, type AppState } from './state';

export const LEGACY_KEY = 'qada:v1';
export const THEME_KEY = 'qada:theme';
const DB_NAME = 'qada';
const DB_VERSION = 1;
const META = 'meta';
const LOGS = 'logs';
const META_ID = 'state';

type Meta = Omit<AppState, 'logs'>;

export interface Persistence {
  /** Загрузить состояние (null — данных ещё нет). */
  load(): Promise<AppState | null>;
  /** Сохранить изменения относительно предыдущего сохранённого состояния. */
  save(prev: AppState | null, next: AppState): Promise<void>;
}

// ---------- IndexedDB ----------

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export function openDb(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = factory.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
      if (!db.objectStoreNames.contains(LOGS)) db.createObjectStore(LOGS, { keyPath: 'id' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('IndexedDB заблокирована другой вкладкой'));
  });
}

const metaOf = (s: AppState): Meta => {
  const { logs: _logs, ...meta } = s;
  return meta;
};

const metaChanged = (a: AppState, b: AppState) =>
  a.settings !== b.settings ||
  a.calc !== b.calc ||
  a.plan !== b.plan ||
  a.debtEvents !== b.debtEvents ||
  a.ownerId !== b.ownerId ||
  a.lastSyncAt !== b.lastSyncAt ||
  a.v !== b.v;

/** Какие отметки нужно записать и какие удалить (сравнение по ссылкам — O(n), без сериализации). */
export function diffLogs(prev: QadaLog[], next: QadaLog[]): { put: QadaLog[]; del: string[] } {
  if (prev === next) return { put: [], del: [] };
  const before = new Map(prev.map((l) => [l.id, l]));
  const put: QadaLog[] = [];
  for (const l of next) {
    if (before.get(l.id) !== l) put.push(l);
    before.delete(l.id);
  }
  return { put, del: [...before.keys()] };
}

export function indexedDbPersistence(factory: IDBFactory = indexedDB): Persistence {
  let dbp: Promise<IDBDatabase> | null = null;
  const db = () => (dbp ??= openDb(factory));

  return {
    async load() {
      const d = await db();
      const tx = d.transaction([META, LOGS], 'readonly');
      const [meta, logs] = await Promise.all([
        req(tx.objectStore(META).get(META_ID) as IDBRequest<Meta | undefined>),
        req(tx.objectStore(LOGS).getAll() as IDBRequest<QadaLog[]>),
      ]);
      if (!meta) return null;
      logs.sort(byCreated);
      return normalizeState({ ...meta, logs });
    },

    async save(prev, next) {
      const d = await db();
      const tx = d.transaction([META, LOGS], 'readwrite');
      const logs = tx.objectStore(LOGS);
      if (!prev) {
        // Полная запись (первое сохранение / перенос из localStorage).
        logs.clear();
        for (const l of next.logs) logs.put(l);
        tx.objectStore(META).put(metaOf(next), META_ID);
      } else {
        const { put, del } = diffLogs(prev.logs, next.logs);
        for (const id of del) logs.delete(id);
        for (const l of put) logs.put(l);
        if (metaChanged(prev, next)) tx.objectStore(META).put(metaOf(next), META_ID);
      }
      await done(tx);
    },
  };
}

// ---------- Запасной вариант: localStorage (если IndexedDB недоступна) ----------

export function localStoragePersistence(storage: Storage = localStorage): Persistence {
  return {
    async load() {
      const raw = storage.getItem(LEGACY_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : null;
    },
    async save(_prev, next) {
      storage.setItem(LEGACY_KEY, JSON.stringify(next));
    },
  };
}

// ---------- Перенос данных из старой версии ----------

/**
 * Загрузить состояние; если в IndexedDB пусто, а в localStorage есть данные старой
 * версии — перенести их. Старая копия удаляется только после того, как перенос
 * проверен повторным чтением (количество отметок и событий совпадает).
 */
export async function loadWithMigration(
  p: Persistence,
  storage: Storage | undefined = typeof localStorage !== 'undefined' ? localStorage : undefined,
): Promise<{ state: AppState | null; migrated: boolean }> {
  const existing = await p.load();
  if (existing) return { state: existing, migrated: false };

  let legacyRaw: string | null = null;
  try {
    legacyRaw = storage?.getItem(LEGACY_KEY) ?? null;
  } catch {
    legacyRaw = null;
  }
  if (!legacyRaw) return { state: null, migrated: false };

  let legacy: AppState;
  try {
    legacy = normalizeState(JSON.parse(legacyRaw));
  } catch {
    return { state: null, migrated: false }; // повреждённые данные не трогаем
  }

  await p.save(null, legacy);
  const check = await p.load();
  const ok = !!check && check.logs.length === legacy.logs.length && check.debtEvents.length === legacy.debtEvents.length;
  if (ok) {
    try {
      storage?.removeItem(LEGACY_KEY);
    } catch {
      /* не критично: копия просто останется */
    }
  }
  return { state: check ?? legacy, migrated: ok };
}

export function hasIndexedDb(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { indexedDbPersistence, loadWithMigration, diffLogs, LEGACY_KEY, type Persistence } from '../persistence';
import { initialState, type AppState } from '../state';
import { ALL_PRAYERS, type QadaLog } from '../../domain/types';

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
}

const log = (i: number, voided = false): QadaLog => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  prayer: ALL_PRAYERS[i % 6],
  count: 1,
  createdAt: new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString(),
  voidedAt: voided ? '2026-02-01T00:00:00.000Z' : null,
});

function sample(n: number): AppState {
  return {
    ...initialState(),
    settings: { ...initialState().settings, madhab: 'shafii', theme: 'dark', updatedAt: '2026-01-01T00:00:00.000Z' },
    debtEvents: [{ id: 'e1', createdAt: '2026-01-01T00:00:00.000Z', kind: 'calculation', deltas: { fajr: 100 } }],
    logs: Array.from({ length: n }, (_, i) => log(i, i === 1)),
  };
}

let factory: IDBFactory;
beforeEach(() => {
  factory = new IDBFactory();
});

describe('persistence (IndexedDB)', () => {
  it('переносит данные старой версии из localStorage и удаляет старую копию только после проверки', async () => {
    const storage = new MemoryStorage();
    const legacy = sample(5);
    storage.setItem(LEGACY_KEY, JSON.stringify(legacy));
    const p = indexedDbPersistence(factory);
    const { state, migrated } = await loadWithMigration(p, storage);
    expect(migrated).toBe(true);
    expect(state?.logs).toEqual(legacy.logs);
    expect(state?.settings.madhab).toBe('shafii');
    expect(state?.debtEvents).toEqual(legacy.debtEvents);
    expect(storage.getItem(LEGACY_KEY)).toBeNull();
    // Повторный запуск читает уже из IndexedDB
    const again = await loadWithMigration(indexedDbPersistence(factory), storage);
    expect(again.migrated).toBe(false);
    expect(again.state?.logs.length).toBe(5);
  });

  it('повреждённые данные старой версии не удаляются', async () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_KEY, '{broken');
    const r = await loadWithMigration(indexedDbPersistence(factory), storage);
    expect(r.state).toBeNull();
    expect(storage.getItem(LEGACY_KEY)).toBe('{broken');
  });

  it('частичная запись: добавление, отмена и удаление отметок', async () => {
    const p = indexedDbPersistence(factory);
    const s0 = sample(3);
    await p.save(null, s0);
    const s1: AppState = { ...s0, logs: [...s0.logs.slice(0, 2).map((l, i) => (i === 0 ? { ...l, voidedAt: 'x' } : l)), log(10)] };
    expect(diffLogs(s0.logs, s1.logs)).toEqual({ put: [s1.logs[0], s1.logs[2]], del: [s0.logs[2].id] });
    await p.save(s0, s1);
    const back = await indexedDbPersistence(factory).load();
    expect(back?.logs).toEqual(s1.logs);
  });

  it('20 000 отметок: сохраняются полностью, «+1» пишет одну запись', async () => {
    const p = indexedDbPersistence(factory);
    const big = sample(20_000);
    await p.save(null, big);
    const plus: AppState = { ...big, logs: [...big.logs, log(20_000)] };
    expect(diffLogs(big.logs, plus.logs).put.length).toBe(1);
    const t = performance.now();
    await p.save(big, plus);
    const ms = performance.now() - t;
    const back = await indexedDbPersistence(factory).load();
    expect(back?.logs.length).toBe(20_001);
    expect(back?.logs[20_000]).toEqual(log(20_000));
    expect(ms).toBeLessThan(500);
  });
});

describe('store', () => {
  async function freshStore() {
    vi.resetModules();
    return import('../store');
  }

  it('быстрые нажатия сохраняются все; после перезапуска данные на месте', async () => {
    const store = await freshStore();
    await store.initStore(indexedDbPersistence(factory));
    store.actions.applyDebt({ fajr: 50, dhuhr: 50, asr: 50, maghrib: 50, isha: 50, witr: 0 }, 'manual');
    for (let i = 0; i < 200; i++) store.actions.logPrayer(ALL_PRAYERS[i % 5]);
    const first = store.getState().logs[0];
    store.actions.voidLog(first.id);
    await store.flushStore();

    const again = await freshStore();
    await again.initStore(indexedDbPersistence(factory));
    const s = again.getState();
    expect(s.logs.length).toBe(200);
    expect(s.logs.find((l) => l.id === first.id)?.voidedAt).toBeTruthy();
    expect(s.debtEvents.length).toBe(1);
  });

  it('ошибка записи видна, данные не теряются и записываются после «Повторить»', async () => {
    const store = await freshStore();
    const real = indexedDbPersistence(factory);
    let fail = true;
    const flaky: Persistence = {
      load: () => real.load(),
      save: (prev, next) => (fail ? Promise.reject(new Error('QuotaExceededError')) : real.save(prev, next)),
    };
    await store.initStore(flaky);
    store.actions.logPrayer('fajr');
    store.actions.logPrayer('asr');
    await store.flushStore();
    // статус — ошибка (читаем через подписку-хук нельзя вне React, поэтому проверяем повтором)
    let saved = await indexedDbPersistence(factory).load();
    expect(saved).toBeNull();
    fail = false;
    await store.retrySave();
    saved = await indexedDbPersistence(factory).load();
    // Обе отметки сохранены (порядок при одинаковом времени определяется id)
    expect(saved?.logs.map((l) => l.prayer).sort()).toEqual(['asr', 'fajr']);
  });
});

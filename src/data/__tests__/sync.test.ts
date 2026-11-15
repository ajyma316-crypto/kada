import { describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { DebtEvent, QadaLog } from '../../domain/types';
import type { ProfileRow, SyncBackend } from '../sync';

/** Имитация сервера: серверное updated_at (как триггер из миграции 0002), RLS по userId. */
class FakeServer {
  clock = Date.UTC(2026, 0, 1);
  logs = new Map<string, QadaLog & { user: string; updated: string }>();
  events = new Map<string, DebtEvent & { user: string; updated: string }>();
  profiles = new Map<string, ProfileRow>();
  pushedLogCounts: number[] = [];
  pulledLogCounts: number[] = [];
  constructor(public supportsCursor = true) {}
  tick(ms = 1000) {
    this.clock += ms;
    return new Date(this.clock).toISOString();
  }
  backend(): SyncBackend {
    return {
      pull: async (user, since) => {
        const now = new Date(this.clock).toISOString(); // время сервера ДО выборки
        const pick = <T extends { user: string; updated: string }>(m: Map<string, T>) =>
          [...m.values()].filter((r) => r.user === user && (!this.supportsCursor || !since || r.updated > since));
        const logs = pick(this.logs);
        const events = pick(this.events);
        this.pulledLogCounts.push(logs.length);
        let cursor: string | null = null;
        if (this.supportsCursor) for (const r of [...logs, ...events]) if (!cursor || r.updated > cursor) cursor = r.updated;
        const strip = <T extends object>(r: T) => {
          const { user: _u, updated: _x, ...rest } = r as T & { user: string; updated: string };
          return rest;
        };
        return {
          logs: logs.map(strip) as QadaLog[],
          events: events.map(strip) as DebtEvent[],
          cursor,
          incremental: this.supportsCursor,
          serverTime: this.supportsCursor ? now : null,
        };
      },
      pushLogs: async (user, logs) => {
        this.pushedLogCounts.push(logs.length);
        for (const l of logs) this.logs.set(l.id, { ...l, user, updated: this.tick(1) });
      },
      pushEvents: async (user, events) => {
        for (const e of events) this.events.set(e.id, { ...e, user, updated: this.tick(1) });
      },
      getProfile: async (user) => this.profiles.get(user) ?? null,
      putProfile: async (user, p) => {
        this.profiles.set(user, p);
      },
    };
  }
}

/** Отдельное «устройство»: свой экземпляр хранилища и своя IndexedDB. */
async function device() {
  vi.resetModules();
  const store = await import('../store');
  const sync = await import('../sync');
  const { indexedDbPersistence } = await import('../persistence');
  await store.initStore(indexedDbPersistence(new IDBFactory()));
  return { store, sync };
}

const USER = 'user-1';
const debt = { fajr: 100, dhuhr: 100, asr: 100, maghrib: 100, isha: 100, witr: 0 };

describe('курсор', () => {
  it('не уходит дальше «время сервера − запас» и догоняет последнее изменение', async () => {
    const { nextCursor, SAFETY_MS } = await import('../sync');
    const t = (m: number) => new Date(Date.UTC(2026, 0, 1, 0, m)).toISOString();
    // запись в 10:00, сервер сейчас 10:00:30 → курсор ограничен 9:59:30
    expect(nextCursor(null, t(10), new Date(Date.UTC(2026, 0, 1, 0, 10, 30)).toISOString())).toBe(
      new Date(Date.UTC(2026, 0, 1, 0, 10, 30) - SAFETY_MS).toISOString(),
    );
    // через 10 минут без новых записей курсор = 10:00
    expect(nextCursor(t(9), t(10), t(20))).toBe(t(10));
  });
});

describe('синхронизация', () => {
  it('первый вход: локальные данные отправляются целиком, затем — только изменения', async () => {
    const server = new FakeServer();
    const A = await device();
    A.store.actions.applyDebt(debt, 'calculation');
    for (let i = 0; i < 50; i++) A.store.actions.logPrayer('fajr'); // до входа (локальный режим)
    await A.sync.syncWith(server.backend(), USER);
    expect(server.logs.size).toBe(50);
    expect(server.events.size).toBe(1);
    expect(A.store.getState().syncCursor).not.toBeNull();
    expect(A.store.getState().unsynced.logs).toEqual([]);

    // Первая синхронизация после большой отправки может один раз получить её обратно (окно запаса).
    server.tick(10 * 60_000);
    await A.sync.syncWith(server.backend(), USER);
    // Дальше — только изменения.
    for (let round = 0; round < 3; round++) {
      server.tick(10 * 60_000);
      A.store.actions.logPrayer('asr');
      A.store.actions.logPrayer('isha');
      await A.sync.syncWith(server.backend(), USER);
      expect(server.pushedLogCounts[server.pushedLogCounts.length - 1]).toBe(2); // отправлены только 2 новые
      expect(server.pulledLogCounts[server.pulledLogCounts.length - 1]).toBeLessThanOrEqual(2); // скачаны не все 50+
    }
    expect(server.logs.size).toBe(56);
    expect(A.store.getState().logs.length).toBe(56);
  });

  it('два устройства: отметки и отмены доходят в обе стороны, без дублей', async () => {
    const server = new FakeServer();
    const A = await device();
    A.store.actions.applyDebt(debt, 'calculation');
    const a1 = A.store.actions.logPrayer('fajr');
    await A.sync.syncWith(server.backend(), USER);

    const B = await device();
    await B.sync.syncWith(server.backend(), USER);
    expect(B.store.getState().logs.map((l) => l.id)).toEqual([a1.id]);
    expect(B.store.getState().debtEvents.length).toBe(1);

    server.tick(5 * 60_000);
    B.store.actions.voidLog(a1.id); // B отменяет отметку A
    const b1 = B.store.actions.logPrayer('dhuhr');
    await B.sync.syncWith(server.backend(), USER);

    server.tick(5 * 60_000);
    await A.sync.syncWith(server.backend(), USER);
    const aLogs = A.store.getState().logs;
    expect(aLogs.map((l) => l.id).sort()).toEqual([a1.id, b1.id].sort());
    expect(aLogs.find((l) => l.id === a1.id)?.voidedAt).toBeTruthy();
    // повторные синхронизации не создают дублей
    await A.sync.syncWith(server.backend(), USER);
    await B.sync.syncWith(server.backend(), USER);
    expect(A.store.getState().logs.length).toBe(2);
    expect(B.store.getState().logs.length).toBe(2);
    expect(server.logs.size).toBe(2);
  });

  it('отметка, сделанная во время синхронизации, не теряется и уходит следующей', async () => {
    const server = new FakeServer();
    const A = await device();
    await A.sync.syncWith(server.backend(), USER);
    const backend = server.backend();
    const slowPush: SyncBackend = {
      ...backend,
      pushLogs: async (u, logs) => {
        A.store.actions.logPrayer('maghrib'); // нажатие во время отправки
        await backend.pushLogs(u, logs);
      },
    };
    A.store.actions.logPrayer('fajr');
    await A.sync.syncWith(slowPush, USER);
    expect(A.store.getState().unsynced.logs.length).toBe(1);
    await A.sync.syncWith(server.backend(), USER);
    expect(server.logs.size).toBe(2);
    expect(A.store.getState().unsynced.logs).toEqual([]);
  });

  it('база без миграции 0002: синхронизация работает по-старому (полностью), без дублей', async () => {
    const server = new FakeServer(false);
    const A = await device();
    A.store.actions.logPrayer('fajr');
    await A.sync.syncWith(server.backend(), USER);
    A.store.actions.logPrayer('asr');
    await A.sync.syncWith(server.backend(), USER);
    expect(A.store.getState().syncCursor).toBeNull();
    expect(server.logs.size).toBe(2);
    expect(server.pushedLogCounts).toEqual([1, 1]);
  });

  it('вход другим аккаунтом на том же устройстве: чужие данные не смешиваются', async () => {
    const server = new FakeServer();
    const A = await device();
    A.store.actions.logPrayer('fajr');
    await A.sync.syncWith(server.backend(), 'user-1');
    await A.sync.syncWith(server.backend(), 'user-2');
    expect(A.store.getState().logs).toEqual([]);
    expect([...server.logs.values()].every((l) => l.user === 'user-1')).toBe(true);
  });
});

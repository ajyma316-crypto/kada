import { describe, expect, it } from 'vitest';
import { eventsToPush, logsToPush, mergeEvents, mergeLogs, pickNewer } from '../merge';
import type { QadaLog } from '../types';

const L = (id: string, t: string, voidedAt: string | null = null): QadaLog => ({ id, prayer: 'fajr', count: 1, createdAt: t, voidedAt });

describe('merge', () => {
  it('объединяет логи и распространяет отмену в обе стороны', () => {
    const local = [L('a', '1'), L('b', '2')];
    const remote = [L('a', '1', 'x'), L('c', '3')];
    const m = mergeLogs(local, remote);
    expect(m.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(m[0].voidedAt).toBe('x');
    // локальная отмена не перезаписывается «неотменённой» удалённой версией
    expect(mergeLogs([L('a', '1', 'y')], [L('a', '1')])[0].voidedAt).toBe('y');
  });
  it('определяет, что отправить', () => {
    expect(logsToPush([L('a', '1', 'v'), L('b', '2'), L('c', '3')], [L('a', '1'), L('b', '2')]).map((x) => x.id)).toEqual(['a', 'c']);
    const e = (id: string) => ({ id, createdAt: id, kind: 'manual' as const, deltas: {} });
    expect(eventsToPush([e('1'), e('2')], [e('1')]).map((x) => x.id)).toEqual(['2']);
    expect(mergeEvents([e('2')], [e('1')]).map((x) => x.id)).toEqual(['1', '2']);
  });
  it('LWW', () => {
    expect(pickNewer({ updatedAt: '2' }, { updatedAt: '1' })?.updatedAt).toBe('2');
    expect(pickNewer(null, { updatedAt: '1' })?.updatedAt).toBe('1');
  });
});

describe('порядок записей', () => {
  it('одинаковое время — порядок по id, независимо от порядка входа', () => {
    const a = L('b-id', '2026-01-01T00:00:00.000Z');
    const b = L('a-id', '2026-01-01T00:00:00.000Z');
    expect(mergeLogs([a, b], []).map((x) => x.id)).toEqual(['a-id', 'b-id']);
    expect(mergeLogs([b, a], []).map((x) => x.id)).toEqual(['a-id', 'b-id']);
  });
});

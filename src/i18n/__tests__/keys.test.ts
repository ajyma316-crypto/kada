import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ru } from '../ru';
import { en } from '../en';
import { ALL_PRAYERS } from '../../domain/types';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === '__tests__' ? [] : files(p);
    return /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

const src = join(__dirname, '../..');
const code = files(src).map((f) => readFileSync(f, 'utf8')).join('\n');
const used = new Set<string>();
for (const m of code.matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)) used.add(m[1]);
for (const m of code.matchAll(/key: '([a-zA-Z.]+)'/g)) used.add(m[1]);
const dynamic = [
  ...ALL_PRAYERS.map((p) => `prayer.${p}`),
  ...['before_islam', 'insanity', 'unconsciousness', 'hayd_known', 'nifas_known', 'other'].map((k) => `exempt.${k}`),
  ...['idle', 'syncing', 'error', 'offline'].map((k) => `sync.status.${k}`),
  ...['calculation', 'manual'].map((k) => `debt.kind.${k}`),
  ...['day', 'week', 'month', 'year'].map((k) => `stats.period.${k}`),
  ...['unverified', 'reviewed'].map((k) => `rules.status.${k}`),
  ...['home', 'track', 'plan', 'stats', 'calculator', 'rules', 'settings'].map((k) => `nav.${k}`),
  ...['home', 'track', 'plan', 'stats', 'rules'].map((k) => `nav.${k}.short`),
  'unit.lunar',
  'unit.solar',
];
dynamic.forEach((k) => used.add(k));

describe('i18n', () => {
  it('все используемые ключи есть в ru и en', () => {
    const missing = [...used].filter((k) => !(k in ru) || !(k in en));
    expect(missing).toEqual([]);
  });
  it('ru и en содержат одинаковый набор ключей', () => {
    expect(Object.keys(ru).filter((k) => !(k in en))).toEqual([]);
    expect(Object.keys(en).filter((k) => !(k in ru))).toEqual([]);
  });
});

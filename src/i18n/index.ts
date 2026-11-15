/** Лёгкая система переводов: словари + множественные формы через Intl.PluralRules. */
import { useMemo } from 'react';
import { useStore } from '../data/store';
import { MADHAB_RULES, type L10n } from '../fiqh/rules';
import type { Note } from '../domain/types';
import { ru } from './ru';
import { en } from './en';

export type Lang = 'ru' | 'en';
export type Plural = { one: string; few?: string; many?: string; other: string };
export type Dict = Record<string, string | Plural>;

export const DICTS: Record<Lang, Dict> = { ru, en };
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'ru', label: 'Русский' },
  { id: 'en', label: 'English' },
];

type Params = Record<string, string | number>;

export function makeT(lang: Lang) {
  const dict = DICTS[lang];
  const pr = new Intl.PluralRules(lang);
  const nf = new Intl.NumberFormat(lang);
  const df = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const dfShort = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', timeZone: 'UTC' });

  const num = (n: number) => nf.format(n);
  const date = (iso: string) => df.format(new Date(iso.slice(0, 10) + 'T00:00:00Z'));
  const dateShort = (iso: string) => dfShort.format(new Date(iso.slice(0, 10) + 'T00:00:00Z'));

  function t(key: string, params?: Params): string {
    let v = dict[key] ?? DICTS.ru[key];
    if (v === undefined) {
      if (import.meta.env.DEV) console.warn('i18n: нет ключа', key);
      return key;
    }
    if (typeof v !== 'string') {
      const n = Number(params?.n ?? 0);
      const form = pr.select(n) as keyof Plural;
      v = v[form] ?? v.other;
    }
    return v.replace(/\{(\w+)\}/g, (_, k) => {
      const p = params?.[k];
      if (p === undefined) return `{${k}}`;
      return typeof p === 'number' ? num(p) : p;
    });
  }

  /** Текст из примечания калькулятора: параметры-коды переводятся, даты форматируются. */
  function note(n: Note): string {
    const p: Params = {};
    for (const [k, v] of Object.entries(n.params ?? {})) {
      if (k === 'unit') p[k] = t(`unit.${v}`);
      else if (k === 'kind') p[k] = t(`exempt.${v}`);
      else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) p[k] = date(v);
      else p[k] = v;
    }
    return t(n.key, p);
  }

  const l = (x: L10n) => x[lang];
  const madhab = (m: keyof typeof MADHAB_RULES) => l(MADHAB_RULES[m].name);

  return { t, note, num, date, dateShort, l, madhab, lang };
}

export type T = ReturnType<typeof makeT>;

export function useT(): T {
  const lang = useStore((s) => s.settings.lang);
  return useMemo(() => makeT(lang), [lang]);
}

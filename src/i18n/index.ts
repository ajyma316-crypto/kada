/** Лёгкая система переводов: словари + множественные формы через Intl.PluralRules. */
import { useMemo } from 'react';
import { useStore } from '../data/store';
import { MADHAB_RULES, type L10n } from '../fiqh/rules';
import type { Note } from '../domain/types';
import { ru } from './ru';
import { en } from './en';
import { ky } from './ky';

export type Lang = 'ru' | 'ky' | 'en';
export type Plural = { one: string; few?: string; many?: string; other: string };
export type Dict = Record<string, string | Plural>;

export const DICTS: Record<Lang, Dict> = { ru, ky, en };
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'ru', label: 'Русский' },
  { id: 'ky', label: 'Кыргызча' },
  { id: 'en', label: 'English' },
];

type Params = Record<string, string | number>;

const KY_MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const KY_MONTHS_SHORT = ['янв.', 'фев.', 'мар.', 'апр.', 'май', 'июн.', 'июл.', 'авг.', 'сен.', 'окт.', 'ноя.', 'дек.'];

export function makeT(lang: Lang) {
  const dict = DICTS[lang];
  const pr = new Intl.PluralRules(lang);
  // Во многих браузерах (в т.ч. Chromium) нет кыргызских форматов ICU: числа форматируем
  // как в русском (23 742; 5,5), а даты — вручную с кыргызскими названиями месяцев.
  const fmtLocale = lang === 'ky' ? 'ru' : lang;
  const nf = new Intl.NumberFormat(fmtLocale);
  const utc = (iso: string) => new Date(iso.slice(0, 10) + 'T00:00:00Z');
  const ymd = (iso: string) => iso.slice(0, 10).split('-').map(Number) as [number, number, number];
  const df = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const dfShort = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const mShort = new Intl.DateTimeFormat(lang, { month: 'short', timeZone: 'UTC' });
  const mYear = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const tf = new Intl.DateTimeFormat(fmtLocale, { hour: '2-digit', minute: '2-digit' });
  const dtf = new Intl.DateTimeFormat(fmtLocale, { dateStyle: 'medium', timeStyle: 'short' });

  const num = (n: number) => nf.format(n);
  const date = (iso: string) => {
    if (lang !== 'ky') return df.format(utc(iso));
    const [y, m, d] = ymd(iso);
    return `${d}-${KY_MONTHS[m - 1]}, ${y}-ж.`;
  };
  const dateShort = (iso: string) => {
    if (lang !== 'ky') return dfShort.format(utc(iso));
    const [, m, d] = ymd(iso);
    return `${d}-${KY_MONTHS_SHORT[m - 1]}`;
  };
  /** Короткое название месяца (ось графика). */
  const month = (iso: string) => (lang === 'ky' ? KY_MONTHS_SHORT[ymd(iso)[1] - 1] : mShort.format(utc(iso)));
  /** «апрель 2030». */
  const monthYear = (iso: string) => {
    if (lang !== 'ky') return mYear.format(utc(iso));
    const [y, m] = ymd(iso);
    return `${y}-ж. ${KY_MONTHS[m - 1]}`;
  };
  /** Время из метки времени (локальное). */
  const time = (ts: string) => tf.format(new Date(ts));
  const dateTime = (ts: string) => dtf.format(new Date(ts));

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

  const l = (x: L10n) => x[lang] ?? x.ru;
  const madhab = (m: keyof typeof MADHAB_RULES) => l(MADHAB_RULES[m].name);

  return { t, note, num, date, dateShort, month, monthYear, time, dateTime, l, madhab, lang };
}

export type T = ReturnType<typeof makeT>;

export function useT(): T {
  const lang = useStore((s) => s.settings.lang);
  return useMemo(() => makeT(lang), [lang]);
}

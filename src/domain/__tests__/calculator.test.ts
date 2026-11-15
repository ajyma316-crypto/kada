import { describe, expect, it } from 'vitest';
import { bulughDateFromAge, calculate, CalcError, defaultCalcInput } from '../calculator';
import { daysBetween } from '../dates';
import type { CalcInput } from '../types';

const T = '2026-01-01';
const base = (o: Partial<CalcInput> = {}): CalcInput => ({ ...defaultCalcInput(T), ...o });

describe('calculator', () => {
  it('считает дни от булюга (по дате) до начала намазов', () => {
    const r = calculate(base({ bulughMode: 'date', bulughDate: '2020-01-01', endDate: '2021-01-01' }), 'hanafi', T);
    expect(r.breakdown.debtDays).toBe(366); // 2020 — високосный
    expect(r.perPrayer.fajr).toBe(366);
    expect(r.perPrayer.witr).toBe(366);
    expect(r.total).toBe(366 * 6);
    expect(r.approximate).toBe(false);
  });

  it('булюг по возрасту в лунных годах — приближение', () => {
    const d = bulughDateFromAge('2000-01-01', 15, 'lunar');
    expect(daysBetween('2000-01-01', d)).toBe(Math.round(15 * 354.36707));
    const r = calculate(base({ birthDate: '2000-01-01', endDate: '2020-01-01' }), 'hanafi', T);
    expect(r.bulughDate).toBe(d);
    expect(r.approximate).toBe(true);
  });

  it('витр не обязателен у шафиитов — предупреждения нет, при включении — допущение', () => {
    const inp = base({ bulughMode: 'date', bulughDate: '2020-01-01', endDate: '2020-01-11', includeWitr: false });
    const r = calculate(inp, 'shafii', T);
    expect(r.perPrayer.witr).toBe(0);
    expect(r.warnings.find((w) => w.key === 'calc.warn.witrRequired')).toBeUndefined();
    const h = calculate(inp, 'hanafi', T);
    expect(h.warnings.find((w) => w.key === 'calc.warn.witrRequired')).toBeDefined();
  });

  it('хайд вычитается и ограничивается максимумом мазхаба; округление в пользу осторожности', () => {
    const inp = base({
      gender: 'female',
      bulughMode: 'date',
      bulughDate: '2020-01-01',
      endDate: '2021-01-01',
      haydAvgDays: 12,
    });
    const h = calculate(inp, 'hanafi', T); // макс 10
    expect(h.warnings.some((w) => w.key === 'calc.warn.haydMax')).toBe(true);
    expect(h.breakdown.haydDays).toBe(Math.floor((366 * 10) / (365.2425 / 12)));
    const s = calculate(inp, 'shafii', T); // 12 ≤ 15
    expect(s.breakdown.haydDays).toBe(Math.floor((366 * 12) / (365.2425 / 12)));
    expect(h.breakdown.debtDays).toBe(366 - h.breakdown.haydDays);
  });

  it('у мужчин женские параметры игнорируются', () => {
    const r = calculate(
      base({ bulughMode: 'date', bulughDate: '2020-01-01', endDate: '2021-01-01', haydAvgDays: 7, nifasBirths: 2, nifasAvgDays: 40 }),
      'hanafi',
      T,
    );
    expect(r.breakdown.debtDays).toBe(366);
  });

  it('нифас ограничен максимумом мазхаба', () => {
    const inp = base({
      gender: 'female',
      bulughMode: 'date',
      bulughDate: '2020-01-01',
      endDate: '2021-01-01',
      nifasBirths: 1,
      nifasAvgDays: 50,
    });
    expect(calculate(inp, 'hanafi', T).breakdown.nifasDays).toBe(40);
    expect(calculate(inp, 'maliki', T).breakdown.nifasDays).toBe(50);
  });

  it('освобождающие периоды: потеря сознания — по-разному у мазхабов', () => {
    const inp = base({
      bulughMode: 'date',
      bulughDate: '2020-01-01',
      endDate: '2020-02-01',
      exemptions: [{ id: 'a', kind: 'unconsciousness', start: '2020-01-10', end: '2020-01-19' }],
    });
    expect(calculate(inp, 'hanafi', T).breakdown.debtDays).toBe(31 - 10);
    expect(calculate(inp, 'hanbali', T).breakdown.debtDays).toBe(31);
    // Одни сутки у ханафитов не освобождают
    const short = { ...inp, exemptions: [{ id: 'b', kind: 'unconsciousness' as const, start: '2020-01-10', end: '2020-01-10' }] };
    expect(calculate(short, 'hanafi', T).breakdown.debtDays).toBe(31);
  });

  it('доп. периоды не считаются дважды при пересечении с основным', () => {
    const r = calculate(
      base({
        bulughMode: 'date',
        bulughDate: '2020-01-01',
        endDate: '2020-01-11',
        extraMissed: [
          { id: 'x', start: '2020-01-05', end: '2020-01-20' },
          { id: 'y', start: '2021-03-01', end: '2021-03-10' },
        ],
      }),
      'hanafi',
      T,
    );
    // основной 10 дней + 11..20 (10 дней) + 10 дней
    expect(r.breakdown.debtDays).toBe(30);
  });

  it('процент совершённых применяется только к основному периоду', () => {
    const r = calculate(
      base({
        bulughMode: 'date',
        bulughDate: '2020-01-01',
        endDate: '2020-04-10', // 100 дней
        performedPercent: 50,
        extraMissed: [{ id: 'y', start: '2021-03-01', end: '2021-03-10' }],
      }),
      'hanafi',
      T,
    );
    expect(r.breakdown.debtDays).toBe(50 + 10);
    expect(r.approximate).toBe(true);
  });

  it('ошибки ввода', () => {
    expect(() => calculate(base({ birthDate: null }), 'hanafi', T)).toThrow(CalcError);
    expect(() => calculate(base({ bulughMode: 'date', bulughDate: '2030-01-01' }), 'hanafi', T)).toThrow(CalcError);
  });

  it('конец периода раньше булюга — долг 0 и предупреждение', () => {
    const r = calculate(base({ bulughMode: 'date', bulughDate: '2020-01-01', endDate: '2019-01-01' }), 'hanafi', T);
    expect(r.total).toBe(0);
    expect(r.warnings.some((w) => w.key === 'calc.warn.endBeforeBulugh')).toBe(true);
  });
});

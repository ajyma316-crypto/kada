/**
 * Калькулятор пропущенных намазов.
 * Чистая функция: (ввод, мазхаб) → результат с допущениями и предупреждениями.
 * Все религиозные параметры берутся из fiqh/rules.ts.
 */
import { getRules } from '../fiqh/rules';
import {
  AVG_MONTH_DAYS,
  LUNAR_YEAR_DAYS,
  SOLAR_YEAR_DAYS,
  addDays,
  fromDayNumber,
  intervalsLength,
  isValidISODate,
  mergeIntervals,
  rangeToInterval,
  subtract,
  toDayNumber,
  todayISO,
  type Interval,
} from './dates';
import {
  FARD_PRAYERS,
  emptyCounts,
  type CalcInput,
  type CalcResult,
  type Madhab,
  type Note,
} from './types';

export class CalcError extends Error {
  constructor(public note: Note) {
    super(note.key);
  }
}

export function defaultCalcInput(today: string = todayISO()): CalcInput {
  return {
    gender: 'male',
    birthDate: null,
    birthDateApprox: false,
    bulughMode: 'age',
    bulughAge: 15,
    bulughAgeUnit: 'lunar',
    bulughDate: null,
    endDate: today,
    performedPercent: 0,
    haydAvgDays: 0,
    nifasBirths: 0,
    nifasAvgDays: 0,
    exemptions: [],
    extraMissed: [],
    includeWitr: true,
  };
}

/** Дата булюга из даты рождения и возраста. */
export function bulughDateFromAge(birth: string, age: number, unit: 'lunar' | 'solar'): string {
  const yearDays = unit === 'lunar' ? LUNAR_YEAR_DAYS : SOLAR_YEAR_DAYS;
  return fromDayNumber(toDayNumber(birth) + Math.round(age * yearDays));
}

export function lunarToSolarYears(lunar: number): number {
  return (lunar * LUNAR_YEAR_DAYS) / SOLAR_YEAR_DAYS;
}

export function calculate(input: CalcInput, madhab: Madhab, today: string = todayISO()): CalcResult {
  const rules = getRules(madhab);
  const assumptions: Note[] = [];
  const warnings: Note[] = [];
  let approximate = false;
  const todayN = toDayNumber(today);

  // ---------- 1. Дата булюга ----------
  let bulughDate: string;
  if (input.bulughMode === 'date') {
    if (!isValidISODate(input.bulughDate)) throw new CalcError({ key: 'calc.err.bulughDate', severity: 'error' });
    bulughDate = input.bulughDate;
    if (input.birthDate && isValidISODate(input.birthDate)) {
      const ageLunar = (toDayNumber(bulughDate) - toDayNumber(input.birthDate)) / LUNAR_YEAR_DAYS;
      checkBulughAge(ageLunar, input, rules.bulugh, warnings);
    }
  } else {
    if (!isValidISODate(input.birthDate)) throw new CalcError({ key: 'calc.err.birthDate', severity: 'error' });
    if (!(input.bulughAge > 0 && input.bulughAge < 40))
      throw new CalcError({ key: 'calc.err.bulughAge', severity: 'error' });
    bulughDate = bulughDateFromAge(input.birthDate, input.bulughAge, input.bulughAgeUnit);
    const ageLunar =
      input.bulughAgeUnit === 'lunar' ? input.bulughAge : (input.bulughAge * SOLAR_YEAR_DAYS) / LUNAR_YEAR_DAYS;
    checkBulughAge(ageLunar, input, rules.bulugh, warnings);
    assumptions.push({
      key: 'calc.as.bulughAge',
      params: {
        age: input.bulughAge,
        unit: input.bulughAgeUnit,
        solar: Math.round(lunarToSolarYears(ageLunar) * 10) / 10,
        date: bulughDate,
      },
    });
    approximate = true; // возраст вместо реальных признаков — всегда приближение
  }
  if (input.birthDate && input.birthDateApprox) {
    approximate = true;
    assumptions.push({ key: 'calc.as.birthApprox' });
  }

  // ---------- 2. Конец основного периода ----------
  if (!isValidISODate(input.endDate)) throw new CalcError({ key: 'calc.err.endDate', severity: 'error' });
  const endN = Math.min(toDayNumber(input.endDate), todayN);
  if (toDayNumber(input.endDate) > todayN) warnings.push({ key: 'calc.warn.endFuture', severity: 'warning' });
  const bulughN = toDayNumber(bulughDate);
  if (bulughN > todayN) throw new CalcError({ key: 'calc.err.bulughFuture', severity: 'error' });

  // Основной период: [булюг, начало регулярных намазов)
  const main: Interval[] = endN > bulughN ? [[bulughN, endN]] : [];
  if (endN < bulughN) warnings.push({ key: 'calc.warn.endBeforeBulugh', severity: 'warning' });

  // Дополнительные периоды пропусков — только после булюга и не позже сегодняшнего дня.
  const extraRaw: Interval[] = [];
  for (const r of input.extraMissed) {
    if (!isValidISODate(r.start) || !isValidISODate(r.end) || r.end < r.start) {
      warnings.push({ key: 'calc.warn.badRange', severity: 'warning' });
      continue;
    }
    const [s, e] = rangeToInterval(r.start, r.end);
    extraRaw.push([Math.max(s, bulughN), Math.min(e, todayN + 1)]);
  }
  // Пересечения с основным периодом не считаются дважды.
  const extra = subtract(mergeIntervals(extraRaw), main);
  if (intervalsLength(extraRaw) > intervalsLength(extra))
    assumptions.push({ key: 'calc.as.overlapMerged' });

  // ---------- 3. Периоды, освобождающие от намаза ----------
  const exempt: Interval[] = [];
  for (const p of input.exemptions) {
    if (!isValidISODate(p.start) || !isValidISODate(p.end) || p.end < p.start) {
      warnings.push({ key: 'calc.warn.badRange', severity: 'warning' });
      continue;
    }
    if (input.gender === 'male' && (p.kind === 'hayd_known' || p.kind === 'nifas_known')) continue;
    const rule = rules.exemptions[p.kind];
    const len = toDayNumber(p.end) - toDayNumber(p.start) + 1;
    if (!rule.exempt) {
      warnings.push({ key: 'calc.warn.notExempt', params: { kind: p.kind }, severity: 'warning' });
      continue;
    }
    if (rule.minConsecutiveDays && len < rule.minConsecutiveDays) {
      warnings.push({
        key: 'calc.warn.tooShortExempt',
        params: { kind: p.kind, min: rule.minConsecutiveDays },
        severity: 'warning',
      });
      continue;
    }
    if (rule.disputed) warnings.push({ key: 'calc.warn.disputedExempt', params: { kind: p.kind }, severity: 'info' });
    exempt.push(rangeToInterval(p.start, p.end));
  }

  const mainDaysRaw = intervalsLength(main);
  const extraDaysRaw = intervalsLength(extra);
  const mainElig = subtract(main, exempt);
  const extraElig = subtract(extra, exempt);
  const mainDays = intervalsLength(mainElig);
  const extraDays = intervalsLength(extraElig);
  const exemptDays = mainDaysRaw + extraDaysRaw - mainDays - extraDays;
  const eligible = mainDays + extraDays;

  // Известные даты хайда/нифаса уже вычтены как освобождающие периоды.
  const knownHayd = input.exemptions.some((p) => p.kind === 'hayd_known');
  const knownNifas = input.exemptions.some((p) => p.kind === 'nifas_known');

  // ---------- 4. Нифас (средняя оценка) ----------
  let nifasDays = 0;
  if (input.gender === 'female' && input.nifasBirths > 0 && input.nifasAvgDays > 0) {
    let perBirth = input.nifasAvgDays;
    if (perBirth > rules.nifas.maxDays) {
      warnings.push({
        key: 'calc.warn.nifasMax',
        params: { max: rules.nifas.maxDays, value: perBirth },
        severity: 'warning',
      });
      perBirth = rules.nifas.maxDays;
    }
    nifasDays = Math.min(Math.floor(input.nifasBirths * perBirth), eligible);
    approximate = true;
    assumptions.push({ key: 'calc.as.nifas', params: { births: input.nifasBirths, days: perBirth } });
    if (knownNifas) warnings.push({ key: 'calc.warn.nifasDouble', severity: 'warning' });
  }

  // ---------- 5. Хайд (средняя оценка) ----------
  let haydDays = 0;
  if (input.gender === 'female' && input.haydAvgDays > 0) {
    let avg = input.haydAvgDays;
    if (avg > rules.hayd.maxDays) {
      warnings.push({ key: 'calc.warn.haydMax', params: { max: rules.hayd.maxDays, value: avg }, severity: 'warning' });
      avg = rules.hayd.maxDays;
    }
    if (rules.hayd.minDays && avg < rules.hayd.minDays)
      warnings.push({ key: 'calc.warn.haydMin', params: { min: rules.hayd.minDays, value: avg }, severity: 'warning' });
    // Округление вниз: вычитаем не больше, чем есть основания вычесть (осторожность).
    haydDays = Math.floor(((eligible - nifasDays) * avg) / AVG_MONTH_DAYS);
    approximate = true;
    assumptions.push({ key: 'calc.as.hayd', params: { days: avg } });
    assumptions.push({ key: 'calc.as.haydPregnancy' });
    if (knownHayd) warnings.push({ key: 'calc.warn.haydDouble', severity: 'warning' });
  } else if (input.gender === 'female' && !knownHayd && eligible > 0) {
    warnings.push({ key: 'calc.warn.noHayd', severity: 'info' });
  }

  // ---------- 6. Частично совершённые намазы ----------
  const pct = Math.min(100, Math.max(0, input.performedPercent || 0));
  const net = Math.max(0, eligible - nifasDays - haydDays);
  // Женские вычеты распределяем пропорционально между основным и доп. периодами.
  const mainShare = eligible > 0 ? mainDays / eligible : 0;
  const netMain = net * mainShare;
  const netExtra = net - netMain;
  const performedDays = Math.floor(netMain * (pct / 100));
  if (pct > 0) {
    approximate = true;
    assumptions.push({ key: 'calc.as.performed', params: { pct } });
  }
  // Итог округляется вверх — в пользу осторожности.
  const debtDays = Math.max(0, Math.ceil(netMain + netExtra - performedDays - 1e-9));
  if (approximate) assumptions.push({ key: 'calc.as.rounding' });

  // ---------- 7. Распределение по намазам ----------
  const perPrayer = emptyCounts();
  for (const p of FARD_PRAYERS) perPrayer[p] = debtDays;
  if (input.includeWitr) {
    perPrayer.witr = debtDays;
    if (!rules.witr.qadaRequired) assumptions.push({ key: 'calc.as.witrOptional' });
  } else if (rules.witr.qadaRequired) {
    warnings.push({ key: 'calc.warn.witrRequired', severity: 'warning' });
  }

  assumptions.unshift({
    key: 'calc.as.period',
    params: { from: bulughDate, to: addDays(fromDayNumber(Math.max(endN, bulughN)), -1) },
  });
  assumptions.push({ key: 'calc.as.dayFull' });

  return {
    perPrayer,
    total: Object.values(perPrayer).reduce((a, b) => a + b, 0),
    bulughDate,
    breakdown: {
      mainDays: mainDaysRaw,
      extraDays: extraDaysRaw,
      exemptDays,
      nifasDays,
      haydDays,
      performedDays,
      debtDays,
    },
    assumptions,
    warnings,
    approximate,
    madhab,
    computedAt: new Date().toISOString(),
  };
}

function checkBulughAge(
  ageLunar: number,
  input: CalcInput,
  rule: ReturnType<typeof getRules>['bulugh'],
  warnings: Note[],
) {
  const min = rule.minAgeLunar[input.gender];
  if (min != null && ageLunar < min - 0.01)
    warnings.push({ key: 'calc.warn.bulughTooEarly', params: { min }, severity: 'warning' });
  if (ageLunar > rule.defaultAgeLunar + 0.01)
    warnings.push({ key: 'calc.warn.bulughTooLate', params: { max: rule.defaultAgeLunar }, severity: 'warning' });
  if (rule.disputed) warnings.push({ key: 'calc.warn.bulughDisputed', severity: 'info' });
}

/** Базовые типы предметной области. Не зависят от React и хранилища. */

export type Madhab = 'hanafi' | 'shafii' | 'maliki' | 'hanbali';
export type Gender = 'male' | 'female';
export type PrayerId = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha' | 'witr';

export const FARD_PRAYERS: PrayerId[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const ALL_PRAYERS: PrayerId[] = [...FARD_PRAYERS, 'witr'];

export const PRAYER_AR: Record<PrayerId, string> = {
  fajr: 'الفجر',
  dhuhr: 'الظهر',
  asr: 'العصر',
  maghrib: 'المغرب',
  isha: 'العشاء',
  witr: 'الوتر',
};

export type PrayerCounts = Record<PrayerId, number>;

export const emptyCounts = (): PrayerCounts => ({ fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0, witr: 0 });

/** Дата в формате YYYY-MM-DD (календарный день, без часового пояса). */
export type ISODate = string;

export interface DateRange {
  id: string;
  start: ISODate;
  end: ISODate; // включительно
  note?: string;
}

export type ExemptionKind = 'before_islam' | 'insanity' | 'unconsciousness' | 'hayd_known' | 'nifas_known' | 'other';

export interface ExemptionPeriod extends DateRange {
  kind: ExemptionKind;
}

export interface CalcInput {
  gender: Gender;
  birthDate: ISODate | null;
  birthDateApprox: boolean;
  bulughMode: 'age' | 'date';
  bulughAge: number;
  bulughAgeUnit: 'lunar' | 'solar';
  bulughDate: ISODate | null;
  /** День, с которого человек начал регулярно молиться (не включительно). */
  endDate: ISODate;
  /** Примерная доля намазов, всё же совершённых в основной период, %. */
  performedPercent: number;
  haydAvgDays: number;
  nifasBirths: number;
  nifasAvgDays: number;
  exemptions: ExemptionPeriod[];
  extraMissed: DateRange[];
  includeWitr: boolean;
}

export type Severity = 'info' | 'warning' | 'error';

/** Сообщение для пользователя: ключ перевода + параметры. */
export interface Note {
  key: string;
  params?: Record<string, string | number>;
  severity?: Severity;
}

export interface CalcBreakdown {
  mainDays: number;
  extraDays: number;
  exemptDays: number;
  nifasDays: number;
  haydDays: number;
  performedDays: number;
  debtDays: number;
}

export interface CalcResult {
  perPrayer: PrayerCounts;
  total: number;
  bulughDate: ISODate;
  breakdown: CalcBreakdown;
  assumptions: Note[];
  warnings: Note[];
  approximate: boolean;
  madhab: Madhab;
  computedAt: string;
}

/** Изменение задолженности. Сумма всех событий = текущая общая задолженность. */
export interface DebtEvent {
  id: string;
  createdAt: string;
  kind: 'calculation' | 'manual';
  deltas: Partial<PrayerCounts>;
  note?: string;
}

/** Запись о восполненном намазе. Отмена — мягкая (voidedAt), чтобы история оставалась честной. */
export interface QadaLog {
  id: string;
  prayer: PrayerId;
  count: number;
  createdAt: string;
  voidedAt?: string | null;
}

export interface Plan {
  perDay: PrayerCounts;
  /** Минут на один ракаат — для оценки времени. */
  minutesPerRakah: number;
  targetDate: ISODate | null;
  startDate: ISODate;
  updatedAt: string;
}

export interface Settings {
  madhab: Madhab;
  gender: Gender;
  theme: 'system' | 'light' | 'dark';
  lang: 'ru' | 'en';
  includeWitr: boolean;
  updatedAt: string;
}

/** Экспорт данных: CSV (для таблиц), JSON (резервная копия), PDF — страница /report.
 * На сайте файлы скачиваются, в приложении — открывается системное меню «Поделиться». */
import type { AppState } from '../data/state';
import { shareFile } from '../platform';

const stamp = () => new Date().toISOString().slice(0, 10);
const esc = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function exportCSV(state: AppState) {
  const rows = [['id', 'prayer', 'count', 'created_at', 'voided_at']];
  for (const l of state.logs) rows.push([l.id, l.prayer, String(l.count), l.createdAt, l.voidedAt ?? '']);
  const rows2 = [['id', 'kind', 'created_at', 'fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'witr', 'note']];
  for (const e of state.debtEvents)
    rows2.push([e.id, e.kind, e.createdAt, ...(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'witr'] as const).map((p) => String(e.deltas[p] ?? 0)), e.note ?? '']);
  // BOM — чтобы Excel правильно открыл кириллицу.
  await shareFile(`qada-log-${stamp()}.csv`, '﻿' + rows.map((r) => r.map(esc).join(',')).join('\n'), 'text/csv;charset=utf-8');
  await shareFile(`qada-debt-changes-${stamp()}.csv`, '﻿' + rows2.map((r) => r.map(esc).join(',')).join('\n'), 'text/csv;charset=utf-8');
}

export async function exportJSON(state: AppState) {
  const { ownerId: _o, lastSyncAt: _l, ...rest } = state;
  await shareFile(`qada-backup-${stamp()}.json`, JSON.stringify({ ...rest, ownerId: null, lastSyncAt: null }, null, 2), 'application/json');
}

export function readJSONFile(file: File): Promise<unknown> {
  return file.text().then((t) => JSON.parse(t));
}

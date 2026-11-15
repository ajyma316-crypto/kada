/** Экспорт данных: CSV (для таблиц), JSON (резервная копия), печать в PDF — страница /report. */
import type { AppState } from '../data/state';

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);
const esc = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportCSV(state: AppState) {
  const rows = [['id', 'prayer', 'count', 'created_at', 'voided_at']];
  for (const l of state.logs) rows.push([l.id, l.prayer, String(l.count), l.createdAt, l.voidedAt ?? '']);
  const rows2 = [['id', 'kind', 'created_at', 'fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'witr', 'note']];
  for (const e of state.debtEvents)
    rows2.push([e.id, e.kind, e.createdAt, ...(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'witr'] as const).map((p) => String(e.deltas[p] ?? 0)), e.note ?? '']);
  // BOM — чтобы Excel правильно открыл кириллицу.
  download(`qada-log-${stamp()}.csv`, '﻿' + rows.map((r) => r.map(esc).join(',')).join('\n'), 'text/csv;charset=utf-8');
  download(`qada-debt-changes-${stamp()}.csv`, '﻿' + rows2.map((r) => r.map(esc).join(',')).join('\n'), 'text/csv;charset=utf-8');
}

export function exportJSON(state: AppState) {
  const { ownerId: _o, lastSyncAt: _l, ...rest } = state;
  download(`qada-backup-${stamp()}.json`, JSON.stringify({ ...rest, ownerId: null, lastSyncAt: null }, null, 2), 'application/json');
}

export function readJSONFile(file: File): Promise<unknown> {
  return file.text().then((t) => JSON.parse(t));
}

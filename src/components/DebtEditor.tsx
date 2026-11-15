/** Ручная корректировка задолженности по каждому намазу (с записью в историю изменений). */
import { useEffect, useState } from 'react';
import { actions } from '../data/store';
import { emptyCounts, PRAYER_AR, type PrayerCounts } from '../domain/types';
import { useT } from '../i18n';
import { useSummary, useVisiblePrayers } from '../lib/hooks';
import { Modal, NumberInput } from './ui';

export function DebtEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, num } = useT();
  const summary = useSummary();
  const prayers = useVisiblePrayers();
  const [vals, setVals] = useState<PrayerCounts>(emptyCounts());
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setVals({ ...summary.debt });
      setNote('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={t('debt.edit.title')}>
      <p className="mb-4 text-sm text-muted">{t('debt.edit.text')}</p>
      <div className="grid grid-cols-2 gap-3">
        {prayers.map((p) => (
          <label key={p} className="block">
            <span className="mb-1 flex items-baseline justify-between text-sm font-medium">
              {t(`prayer.${p}`)} <span className="ar text-muted" lang="ar">{PRAYER_AR[p]}</span>
            </span>
            <NumberInput value={vals[p]} max={1_000_000} onChange={(n) => setVals({ ...vals, [p]: Math.round(n) })} ariaLabel={t(`prayer.${p}`)} />
            {summary.done[p] > 0 && <span className="hint block">{t('debt.edit.done', { n: summary.done[p] })}</span>}
          </label>
        ))}
      </div>
      <label className="mt-4 block">
        <span className="label">{t('debt.edit.note')}</span>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={t('debt.edit.notePh')} />
      </label>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button
          className="btn-primary"
          onClick={() => {
            actions.applyDebt(vals, 'manual', note || undefined);
            onClose();
          }}
        >
          {t('common.save')} · {num(Object.values(vals).reduce((a, b) => a + b, 0))}
        </button>
      </div>
    </Modal>
  );
}

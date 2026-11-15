/**
 * Ежедневный учёт: +1 к каждому намазу, массовое добавление, отмена ошибочных отметок.
 * Каждая отметка сохраняется с датой и временем и сразу уменьшает остаток.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { EmptyState, Modal, NumberInput, PageHeader } from '../components/ui';
import { actions, useStore } from '../data/store';
import { localDateOf, todayISO } from '../domain/dates';
import { PRAYER_AR, type PrayerId, type QadaLog } from '../domain/types';
import { useT } from '../i18n';
import { useRules, useSummary, useVisiblePrayers } from '../lib/hooks';

export default function Track() {
  const { t, num, l } = useT();
  const s = useSummary();
  const prayers = useVisiblePrayers();
  const plan = useStore((st) => st.plan);
  const logs = useStore((st) => st.logs);
  const rules = useRules();
  const toast = useToast();
  const [bulk, setBulk] = useState<PrayerId | null>(null);
  const today = todayISO();

  const todayLogs = useMemo(() => logs.filter((x) => localDateOf(x.createdAt) === today).reverse(), [logs, today]);
  const todayCount = (p: PrayerId) => todayLogs.reduce((a, x) => a + (!x.voidedAt && x.prayer === p ? x.count : 0), 0);

  function mark(p: PrayerId, count = 1) {
    const entry = actions.logPrayer(p, count);
    if (navigator.vibrate) navigator.vibrate(12);
    toast({
      text: `${t(`prayer.${p}`)} +${count} · ${t('track.left', { n: Math.max(0, s.remaining[p] - count) })}`,
      actionLabel: t('common.undo'),
      onAction: () => actions.voidLog(entry.id),
    });
  }

  if (s.debtTotal === 0) {
    return (
      <>
        <PageHeader arabic="قضاء" title={t('track.title')} />
        <EmptyState
          title={t('track.noDebt.title')}
          text={t('track.noDebt.text')}
          action={<Link to="/calculator" className="btn-primary">{t('dash.empty.calc')}</Link>}
        />
      </>
    );
  }

  const todayTotal = prayers.reduce((a, p) => a + todayCount(p), 0);

  return (
    <>
      <PageHeader
        arabic="قضاء"
        title={t('track.title')}
        subtitle={t('track.subtitle')}
        action={
          <div className="text-end">
            <p className="text-xs text-muted">{t('track.today')}</p>
            <p className="num text-2xl font-semibold">{num(todayTotal)}</p>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {prayers.map((p) => {
          const target = plan?.perDay[p] ?? 0;
          const done = todayCount(p);
          const reached = target > 0 && done >= target;
          const finished = s.remaining[p] === 0;
          return (
            <div key={p} className={`card relative flex flex-col p-4 transition ${reached ? 'border-brand/40' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{t(`prayer.${p}`)}</p>
                  <p className="ar text-lg leading-tight text-gold" lang="ar">{PRAYER_AR[p]}</p>
                </div>
                <button className="btn-quiet -me-2 -mt-1 px-2 py-1 text-xs" onClick={() => setBulk(p)} disabled={finished} aria-label={t('track.bulk', { prayer: t(`prayer.${p}`) })}>
                  +N
                </button>
              </div>
              <p className="mt-3 text-xs text-muted">{t('track.remaining')}</p>
              <p className="num text-2xl font-semibold tracking-tight">{num(s.remaining[p])}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                {reached && <Icon name="check" size={14} className="text-brand" />}
                {target > 0 ? t('track.todayOfPlan', { done, target }) : t('track.todayN', { n: done })}
              </p>
              <button
                className="btn-primary mt-4 h-12 w-full text-base"
                onClick={() => mark(p)}
                disabled={finished}
                aria-label={t('track.plusOne', { prayer: t(`prayer.${p}`) })}
              >
                {finished ? <><Icon name="check" size={18} /> {t('track.cleared')}</> : <><Icon name="plus" size={18} /> 1</>}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        <Icon name="info" size={13} className="me-1 inline align-[-2px]" />
        {l(rules.qadaTiming)}
      </p>

      <section className="mt-8">
        <h2 className="mb-3 font-semibold">{t('track.todayLog')}</h2>
        {todayLogs.length === 0 ? (
          <p className="text-sm text-muted">{t('track.nothingToday')}</p>
        ) : (
          <LogList logs={todayLogs} />
        )}
      </section>

      <BulkModal prayer={bulk} max={bulk ? s.remaining[bulk] : 0} onClose={() => setBulk(null)} onSubmit={(p, n) => mark(p, n)} />
    </>
  );
}

export function LogList({ logs }: { logs: QadaLog[] }) {
  const { t, lang } = useT();
  const toast = useToast();
  const tf = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' });
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl2 border border-line bg-surface">
      {logs.map((x) => (
        <li key={x.id} className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${x.voidedAt ? 'text-muted' : ''}`}>
          <span className="flex min-w-0 items-center gap-3">
            <span className="num w-12 shrink-0 text-muted">{tf.format(new Date(x.createdAt))}</span>
            <span className={x.voidedAt ? 'line-through' : 'font-medium'}>
              {t(`prayer.${x.prayer}`)} <span className="num">+{x.count}</span>
            </span>
          </span>
          {x.voidedAt ? (
            <span className="text-xs">{t('track.voided')}</span>
          ) : (
            <button
              className="btn-quiet px-2 py-1 text-xs"
              onClick={() => {
                actions.voidLog(x.id);
                toast({ text: t('track.undone') });
              }}
            >
              <Icon name="undo" size={14} /> {t('common.undo')}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function BulkModal({ prayer, max, onClose, onSubmit }: { prayer: PrayerId | null; max: number; onClose: () => void; onSubmit: (p: PrayerId, n: number) => void }) {
  const { t } = useT();
  const [n, setN] = useState(2);
  return (
    <Modal open={!!prayer} onClose={onClose} title={prayer ? t('track.bulk', { prayer: t(`prayer.${prayer}`) }) : ''}>
      <p className="mb-4 text-sm text-muted">{t('track.bulkText')}</p>
      <NumberInput value={n} min={1} max={Math.max(1, max)} onChange={(v) => setN(Math.round(v))} ariaLabel={t('track.count')} />
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        <button
          className="btn-primary"
          disabled={n < 1 || n > max}
          onClick={() => {
            if (prayer) onSubmit(prayer, n);
            onClose();
          }}
        >
          {t('track.add', { n })}
        </button>
      </div>
    </Modal>
  );
}

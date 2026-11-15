/** Личный кабинет: общая статистика, прогресс за месяц и за всё время, разбивка по намазам. */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProgressBar, ProgressRing } from '../components/charts';
import { DebtEditor } from '../components/DebtEditor';
import { Icon } from '../components/Icon';
import { Card, EmptyState, PageHeader } from '../components/ui';
import { useStore } from '../data/store';
import { addDays, daysBetween, humanizeDays, localDateOf, todayISO } from '../domain/dates';
import { completedTotals } from '../domain/ledger';
import { project } from '../domain/plan';
import { averagePace, streak } from '../domain/stats';
import { PRAYER_AR, type PrayerCounts } from '../domain/types';
import { useT } from '../i18n';
import { useSummary, useVisiblePrayers } from '../lib/hooks';

const sumC = (c: PrayerCounts) => Object.values(c).reduce((a, b) => a + b, 0);

export default function Dashboard() {
  const tr = useT();
  const { t, num, date } = tr;
  const s = useSummary();
  const logs = useStore((st) => st.logs);
  const plan = useStore((st) => st.plan);
  const calc = useStore((st) => st.calc);
  const prayers = useVisiblePrayers();
  const [editing, setEditing] = useState(false);
  const today = todayISO();

  const month = useMemo(() => {
    const start = today.slice(0, 8) + '01';
    const done = completedTotals(logs, (l) => localDateOf(l.createdAt) >= start);
    const doneToday = completedTotals(logs, (l) => localDateOf(l.createdAt) === today);
    return { start, done: sumC(done), doneToday: sumC(doneToday), byPrayerToday: doneToday };
  }, [logs, today]);

  const pace = useMemo(() => averagePace(logs, 30, today), [logs, today]);
  const days = useMemo(() => streak(logs, today), [logs, today]);
  const projection = plan ? project(s.remaining, plan.perDay, plan.minutesPerRakah, today) : null;
  const planToday = plan ? prayers.reduce((acc, p) => acc + (s.remaining[p] > 0 || month.byPrayerToday[p] > 0 ? plan.perDay[p] : 0), 0) : 0;
  // Ожидаемое по плану в этом месяце (с даты начала плана или с 1-го числа).
  const planMonthTarget = plan
    ? planToday * Math.max(0, daysBetween(plan.startDate > month.start ? plan.startDate : month.start, today) + 1)
    : 0;

  const approx = calc?.result?.approximate && s.debtTotal > 0;
  const pct = Math.floor(s.progress * 1000) / 10;

  if (s.debtTotal === 0 && s.doneTotal === 0) {
    return (
      <>
        <PageHeader arabic="السلام عليكم" title={t('dash.title')} subtitle={t('dash.subtitle')} />
        <EmptyState
          title={t('dash.empty.title')}
          text={t('dash.empty.text')}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/calculator" className="btn-primary">
                <Icon name="calc" size={18} /> {t('dash.empty.calc')}
              </Link>
              <button className="btn-ghost" onClick={() => setEditing(true)}>
                <Icon name="edit" size={18} /> {t('dash.empty.manual')}
              </button>
            </div>
          }
        />
        <DebtEditor open={editing} onClose={() => setEditing(false)} />
      </>
    );
  }

  const finished = s.debtTotal > 0 && s.remainingTotal === 0;

  return (
    <>
      <PageHeader
        arabic="السلام عليكم"
        title={t('dash.title')}
        subtitle={t('dash.subtitle')}
        action={
          <Link to="/track" className="btn-primary no-print">
            <Icon name="plus" size={18} /> {t('dash.cta.track')}
          </Link>
        }
      />

      {finished && (
        <div className="mb-5 rounded-xl2 border border-brand/30 bg-brand-soft p-5">
          <p className="ar text-xl text-brand" lang="ar">الحمد لله</p>
          <p className="mt-1 font-semibold">{t('dash.finished')}</p>
        </div>
      )}

      {/* Главная карточка */}
      <Card className="mb-5">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-10">
          <ProgressRing value={s.progress} label={t('dash.progressAria', { pct })}>
            <div>
              <div className="num text-4xl font-semibold tracking-tight">{pct}%</div>
              <div className="text-xs text-muted">{t('dash.progress')}</div>
            </div>
          </ProgressRing>
          <dl className="grid w-full flex-1 grid-cols-3 gap-3 sm:gap-6">
            <Big label={t('dash.total')} value={(approx ? '≈ ' : '') + num(s.debtTotal)} />
            <Big label={t('dash.done')} value={num(s.debtTotal - s.remainingTotal)} accent />
            <Big label={t('dash.remaining')} value={num(s.remainingTotal)} />
          </dl>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-sm">
          <span className="text-muted">
            {approx ? t('dash.approxNote') : t('dash.exactNote')}
          </span>
          <span className="flex gap-1">
            <Link to="/calculator" className="btn-quiet px-2.5 py-1.5">{t('dash.recalc')}</Link>
            <button className="btn-quiet px-2.5 py-1.5" onClick={() => setEditing(true)}>{t('dash.adjust')}</button>
          </span>
        </div>
      </Card>

      {/* Карточки статистики */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          label={t('dash.today')}
          value={num(month.doneToday)}
          sub={plan ? t('dash.ofPlan', { n: planToday }) : t('dash.noPlan')}
          progress={plan && planToday ? month.doneToday / planToday : undefined}
        />
        <Stat
          label={t('dash.month')}
          value={num(month.done)}
          sub={plan && planMonthTarget ? t('dash.ofPlan', { n: planMonthTarget }) : t('dash.monthSub', { pct: s.debtTotal ? ((month.done / s.debtTotal) * 100).toFixed(1) : 0 })}
          progress={plan && planMonthTarget ? month.done / planMonthTarget : undefined}
        />
        <Stat label={t('dash.streak')} value={num(days)} sub={t('unit.days', { n: days })} icon="flame" />
        <Stat
          label={t('dash.finish')}
          value={projection?.finishDate ? date(projection.finishDate) : pace > 0 ? date(addDays(today, Math.ceil(s.remainingTotal / pace))) : '—'}
          sub={projection?.finishDate ? t('dash.byPlan') : pace > 0 ? t('dash.byPace', { n: num(Math.round(pace * 10) / 10) }) : t('dash.makePlan')}
          small
        />
      </div>

      {/* По намазам */}
      <Card className="mb-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">{t('dash.byPrayer')}</h2>
          {projection && Number.isFinite(projection.days) && (
            <span className="text-sm text-muted">{fmtDuration(tr, projection.days)}</span>
          )}
        </div>
        <ul className="space-y-4">
          {prayers.map((p) => {
            const done = s.debt[p] - s.remaining[p];
            return (
              <li key={p}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">
                    {t(`prayer.${p}`)} <span className="ar ms-1 text-muted" lang="ar">{PRAYER_AR[p]}</span>
                  </span>
                  <span className="num text-muted">
                    <span className="font-semibold text-ink">{num(s.remaining[p])}</span> / {num(s.debt[p])}
                  </span>
                </div>
                <ProgressBar value={s.debt[p] ? done / s.debt[p] : 0} label={t(`prayer.${p}`)} />
              </li>
            );
          })}
        </ul>
      </Card>

      {!plan && s.remainingTotal > 0 && (
        <Link to="/plan" className="card flex items-center justify-between gap-4 transition hover:border-brand/40">
          <div>
            <p className="font-semibold">{t('dash.planCta.title')}</p>
            <p className="mt-0.5 text-sm text-muted">{t('dash.planCta.text')}</p>
          </div>
          <Icon name="arrow" className="shrink-0 text-brand" />
        </Link>
      )}

      <DebtEditor open={editing} onClose={() => setEditing(false)} />
    </>
  );
}

export function fmtDuration(tr: ReturnType<typeof useT>, days: number): string {
  const h = humanizeDays(days);
  const parts: string[] = [];
  if (h.years) parts.push(tr.t('unit.years', { n: h.years }));
  if (h.months) parts.push(tr.t('unit.months', { n: h.months }));
  if (!h.years && (h.days || !parts.length)) parts.push(tr.t('unit.days', { n: h.days }));
  return parts.join(' ');
}

function Big({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center sm:text-start">
      <dt className="text-xs text-muted sm:text-sm">{label}</dt>
      <dd className={`num mt-1 text-xl font-semibold tracking-tight sm:text-3xl ${accent ? 'text-brand' : ''}`}>{value}</dd>
    </div>
  );
}

function Stat({ label, value, sub, progress, icon, small }: { label: string; value: string; sub: string; progress?: number; icon?: string; small?: boolean }) {
  return (
    <div className="card p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {icon && <Icon name={icon} size={14} className="text-gold" />}
        {label}
      </p>
      <p className={`num mt-1.5 font-semibold tracking-tight ${small ? 'text-base sm:text-lg' : 'text-2xl'}`}>{value}</p>
      <p className="mt-0.5 text-xs text-muted">{sub}</p>
      {progress !== undefined && <ProgressBar value={progress} className="mt-3 h-1.5" />}
    </div>
  );
}

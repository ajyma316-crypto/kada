/** Аналитика: динамика по дням/неделям/месяцам/годам, по видам намазов, остаток во времени, история. */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Heatmap, LineChart } from '../components/charts';
import { Icon } from '../components/Icon';
import { Card, EmptyState, PageHeader, Segmented } from '../components/ui';
import { getState, useStore } from '../data/store';
import { addDays, localDateOf, todayISO } from '../domain/dates';
import { completedTotals } from '../domain/ledger';
import { averagePace, countsByDay, remainingHistory, series, streak, total, type Granularity } from '../domain/stats';
import { PRAYER_AR, type QadaLog } from '../domain/types';
import { useT } from '../i18n';
import { exportCSV, exportJSON } from '../lib/export';
import { useSummary, useVisiblePrayers } from '../lib/hooks';
import { LogList } from './Track';

const COUNTS: Record<Granularity, number> = { day: 30, week: 12, month: 12, year: 5 };

export default function Stats() {
  const tr = useT();
  const { t, num, date, dateShort, lang } = tr;
  const logs = useStore((s) => s.logs);
  const events = useStore((s) => s.debtEvents);
  const s = useSummary();
  const prayers = useVisiblePrayers();
  const [g, setG] = useState<Granularity>('day');
  const [historyLimit, setHistoryLimit] = useState(10);
  const today = todayISO();

  const buckets = useMemo(() => series(logs, g, COUNTS[g], today), [logs, g, today]);
  const periodCounts = useMemo(() => {
    const from = buckets[0]?.start ?? today;
    return completedTotals(logs, (l) => localDateOf(l.createdAt) >= from);
  }, [logs, buckets, today]);
  const history = useMemo(() => remainingHistory(events, logs, today), [events, logs, today]);
  const heat = useMemo(() => {
    const byDay = countsByDay(logs);
    const dow = (new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7;
    const start = addDays(today, -(25 * 7 + dow));
    const out: { date: string; value: number }[] = [];
    for (let d = start; d <= today; d = addDays(d, 1)) out.push({ date: d, value: byDay.has(d) ? total(byDay.get(d)!) : 0 });
    return out;
  }, [logs, today]);

  const monthFmt = new Intl.DateTimeFormat(lang, { month: 'short', timeZone: 'UTC' });
  const monthYearFmt = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const asDate = (d: string) => new Date(d + 'T00:00:00Z');
  const axisLabel = (start: string) =>
    g === 'day' ? start.slice(8) : g === 'week' ? dateShort(start) : g === 'month' ? monthFmt.format(asDate(start)) : start.slice(0, 4);
  const tipLabel = (start: string) =>
    g === 'day' ? date(start) : g === 'week' ? t('stats.weekOf', { date: dateShort(start) }) : g === 'month' ? monthYearFmt.format(asDate(start)) : start.slice(0, 4);

  const allLogs = useMemo(() => [...logs].reverse(), [logs]);
  const pace = averagePace(logs, 30, today);
  const periodTotal = buckets.reduce((a, b) => a + b.total, 0);
  const activeDays = buckets.filter((b) => b.total > 0).length;

  if (logs.length === 0 && events.length === 0) {
    return (
      <>
        <PageHeader arabic="الإحصاء" title={t('stats.title')} />
        <EmptyState title={t('stats.empty.title')} text={t('stats.empty.text')} action={<Link to="/track" className="btn-primary">{t('dash.cta.track')}</Link>} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        arabic="الإحصاء"
        title={t('stats.title')}
        subtitle={t('stats.subtitle')}
        action={
          <div className="no-print flex flex-wrap gap-2">
            <Link to="/report" className="btn-ghost"><Icon name="print" size={17} /> PDF</Link>
            <button className="btn-ghost" onClick={() => exportCSV(getState())}><Icon name="download" size={17} /> CSV</button>
            <button className="btn-ghost" onClick={() => exportJSON(getState())}><Icon name="download" size={17} /> JSON</button>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Mini label={t('stats.allTime')} value={num(s.doneTotal)} />
        <Mini label={t('stats.pace30')} value={num(Math.round(pace * 10) / 10)} sub={t('stats.perDay')} />
        <Mini label={t('dash.streak')} value={num(streak(logs, today))} sub={t('unit.days', { n: streak(logs, today) })} />
        <Mini label={t('dash.remaining')} value={num(s.remainingTotal)} />
      </div>

      <Card className="mb-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{t('stats.dynamics')}</h2>
            <p className="text-sm text-muted">
              {t(`stats.period.${g}`)} · {t('stats.periodTotal', { n: periodTotal })}
              {g === 'day' && ` · ${t('stats.activeDays', { n: activeDays })}`}
            </p>
          </div>
          <Segmented
            label={t('stats.dynamics')}
            value={g}
            onChange={setG}
            options={[
              { value: 'day', label: t('stats.g.day') },
              { value: 'week', label: t('stats.g.week') },
              { value: 'month', label: t('stats.g.month') },
              { value: 'year', label: t('stats.g.year') },
            ]}
          />
        </div>
        <BarChart caption={t('stats.dynamics')} format={(n) => num(Math.round(n))} data={buckets.map((b) => ({ key: b.key, label: axisLabel(b.start), tip: tipLabel(b.start), value: b.total }))} />
      </Card>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-1 font-semibold">{t('stats.byPrayer')}</h2>
          <p className="mb-4 text-sm text-muted">{t(`stats.period.${g}`)}</p>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="pb-2 text-start font-medium">{t('stats.prayer')}</th>
                <th className="pb-2 text-end font-medium">{t('stats.inPeriod')}</th>
                <th className="pb-2 text-end font-medium">{t('stats.allTime')}</th>
                <th className="pb-2 text-end font-medium">{t('dash.remaining')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {prayers.map((p) => (
                <tr key={p}>
                  <td className="py-2">
                    {t(`prayer.${p}`)} <span className="ar ms-1 hidden text-muted sm:inline" lang="ar">{PRAYER_AR[p]}</span>
                  </td>
                  <td className="num py-2 text-end">{num(periodCounts[p])}</td>
                  <td className="num py-2 text-end font-semibold">{num(s.done[p])}</td>
                  <td className="num py-2 text-end text-muted">{num(s.remaining[p])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 font-semibold">{t('stats.calendar')}</h2>
          <p className="mb-4 text-sm text-muted">{t('stats.calendarText')}</p>
          <Heatmap
            days={heat}
            caption={t('stats.calendar')}
            format={(n) => t('stats.nPrayers', { n })}
            formatDate={date}
            weekdayLabels={t('stats.weekdays').split(',')}
          />
        </Card>
      </div>

      {history.length > 1 && (
        <Card className="mb-5">
          <h2 className="mb-1 font-semibold">{t('stats.remainingChart')}</h2>
          <p className="mb-4 text-sm text-muted">{t('stats.remainingChartText')}</p>
          <LineChart caption={t('stats.remainingChart')} data={history.map((h) => ({ x: h.date, y: h.remaining }))} format={(n) => num(Math.round(n))} formatX={dateShort} />
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-semibold">{t('stats.history')}</h2>
          {allLogs.length === 0 ? (
            <p className="text-sm text-muted">{t('track.nothingToday')}</p>
          ) : (
            <HistoryByDay logs={allLogs.slice(0, historyLimit)} />
          )}
          {allLogs.length > historyLimit && (
            <button className="btn-ghost mt-3 w-full" onClick={() => setHistoryLimit((n) => n + 30)}>
              {t('stats.showMore')}
            </button>
          )}
        </section>
        <section>
          <h2 className="mb-3 font-semibold">{t('stats.debtChanges')}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl2 border border-line bg-surface">
            {[...events].reverse().map((e) => {
              const sum = Object.values(e.deltas).reduce((a, b) => a + (b ?? 0), 0);
              return (
                <li key={e.id} className="px-4 py-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium">{t(`debt.kind.${e.kind}`)}</span>
                    <span className={`num font-semibold ${sum < 0 ? 'text-brand' : ''}`}>{sum > 0 ? '+' : ''}{num(sum)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {date(localDateOf(e.createdAt))}
                    {e.note ? ` · ${e.note}` : ''}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}

function HistoryByDay({ logs }: { logs: QadaLog[] }) {
  const { date } = useT();
  const groups = new Map<string, typeof logs>();
  for (const l of logs) {
    const d = localDateOf(l.createdAt);
    groups.set(d, [...(groups.get(d) ?? []), l]);
  }
  return (
    <div className="space-y-4">
      {[...groups].map(([d, items]) => (
        <div key={d}>
          <p className="mb-1.5 text-xs font-medium text-muted">{date(d)}</p>
          <LogList logs={items} />
        </div>
      ))}
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="num mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

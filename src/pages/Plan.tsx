/**
 * Индивидуальный план: три способа задать темп (количество / срок / время),
 * мгновенный пересчёт срока, сценарии «что если» и сравнение с фактическим темпом.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { Card, EmptyState, Field, Notice, NumberInput, PageHeader, Segmented, Stepper } from '../components/ui';
import { actions, useStore } from '../data/store';
import { addDays, todayISO } from '../domain/dates';
import { perDayForMinutes, perDayForTarget, project, RAKAHS, scenarios, uniformPerDay } from '../domain/plan';
import { averagePace } from '../domain/stats';
import { PRAYER_AR, type PrayerCounts } from '../domain/types';
import { useT } from '../i18n';
import { useRules, useSummary, useVisiblePrayers } from '../lib/hooks';
import { fmtDuration } from './Dashboard';

type Mode = 'count' | 'date' | 'time';

export default function PlanPage() {
  const tr = useT();
  const { t, num, date, l } = tr;
  const s = useSummary();
  const saved = useStore((st) => st.plan);
  const logs = useStore((st) => st.logs);
  const prayers = useVisiblePrayers();
  const rules = useRules();
  const toast = useToast();
  const today = todayISO();

  const [mode, setMode] = useState<Mode>('count');
  const [perDay, setPerDay] = useState<PrayerCounts>(() => saved?.perDay ?? uniformPerDay(s.remaining, 1));
  const [minPerRakah, setMinPerRakah] = useState(saved?.minutesPerRakah ?? 1.5);
  const [target, setTarget] = useState(saved?.targetDate ?? addDays(today, 365));
  const [minutes, setMinutes] = useState(30);

  // Режимы «к дате» и «по времени» вычисляют нагрузку автоматически.
  useEffect(() => {
    if (mode === 'date') {
      const p = perDayForTarget(s.remaining, target, today);
      if (p) setPerDay(p);
    } else if (mode === 'time') setPerDay(perDayForMinutes(s.remaining, minutes, minPerRakah));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, target, minutes, minPerRakah, s.remainingTotal]);

  const proj = useMemo(() => project(s.remaining, perDay, minPerRakah, today), [s.remaining, perDay, minPerRakah, today]);
  const scen = useMemo(() => scenarios(s.remaining, minPerRakah, today, 5), [s.remaining, minPerRakah, today]);
  const pace = useMemo(() => averagePace(logs, 30, today), [logs, today]);
  const dirty = !saved || JSON.stringify(saved.perDay) !== JSON.stringify(perDay) || saved.minutesPerRakah !== minPerRakah;

  if (s.remainingTotal === 0) {
    return (
      <>
        <PageHeader arabic="خطة القضاء" title={t('plan.title')} />
        <EmptyState
          title={s.debtTotal ? t('dash.finished') : t('track.noDebt.title')}
          text={s.debtTotal ? '' : t('track.noDebt.text')}
          action={!s.debtTotal && <Link to="/calculator" className="btn-primary">{t('dash.empty.calc')}</Link>}
        />
      </>
    );
  }

  const uniformN = prayers.every((p) => s.remaining[p] === 0 || perDay[p] === perDay[prayers.find((q) => s.remaining[q] > 0)!]) ? perDay[prayers.find((q) => s.remaining[q] > 0)!] : null;

  return (
    <>
      <PageHeader arabic="خطة القضاء" title={t('plan.title')} subtitle={t('plan.subtitle')} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-5">
          <Card>
            <p className="label">{t('plan.mode')}</p>
            <Segmented
              label={t('plan.mode')}
              value={mode}
              onChange={setMode}
              options={[
                { value: 'count', label: t('plan.mode.count') },
                { value: 'date', label: t('plan.mode.date') },
                { value: 'time', label: t('plan.mode.time') },
              ]}
            />

            <div className="mt-5">
              {mode === 'count' && (
                <div>
                  <p className="mb-2 text-sm text-muted">{t('plan.quick')}</p>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        className={`btn px-3.5 py-2 ${uniformN === n ? 'bg-brand text-brand-ink' : 'border border-line bg-surface hover:bg-surface-2'}`}
                        onClick={() => setPerDay(uniformPerDay(s.remaining, n))}
                      >
                        {t('plan.setsN', { n })}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {mode === 'date' && (
                <Field id="target" label={t('plan.targetDate')} hint={t('plan.targetHint')}>
                  <input id="target" type="date" className="input sm:max-w-xs" min={addDays(today, 1)} value={target} onChange={(e) => e.target.value && setTarget(e.target.value)} />
                </Field>
              )}
              {mode === 'time' && (
                <Field id="mins" label={t('plan.minutesPerDay')} hint={t('plan.minutesHint')}>
                  <NumberInput id="mins" value={minutes} min={5} max={600} step={5} onChange={setMinutes} className="sm:max-w-[10rem]" />
                </Field>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="mb-1 font-semibold">{t('plan.daily')}</h2>
            <p className="mb-4 text-sm text-muted">{t('plan.dailyText')}</p>
            <ul className="divide-y divide-line">
              {prayers.map((p) => (
                <li key={p} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="font-medium">
                      {t(`prayer.${p}`)} <span className="ar ms-1 text-muted" lang="ar">{PRAYER_AR[p]}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {s.remaining[p] > 0
                        ? t('plan.prayerLine', { left: s.remaining[p], days: Number.isFinite(proj.perPrayerDays[p]) ? proj.perPrayerDays[p] : '∞', rk: RAKAHS[p] })
                        : t('track.cleared')}
                    </p>
                  </div>
                  <Stepper
                    label={t(`prayer.${p}`)}
                    value={perDay[p]}
                    max={50}
                    onChange={(n) => {
                      setMode('count');
                      setPerDay({ ...perDay, [p]: n });
                    }}
                  />
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-line pt-4">
              <Field id="mpr" label={t('plan.minPerRakah')} hint={t('plan.minPerRakahHint')}>
                <NumberInput id="mpr" value={minPerRakah} min={0.5} max={10} step={0.5} onChange={setMinPerRakah} className="sm:max-w-[8rem]" />
              </Field>
            </div>
          </Card>

          <Card>
            <h2 className="mb-1 font-semibold">{t('plan.scenarios')}</h2>
            <p className="mb-4 text-sm text-muted">{t('plan.scenariosText')}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-start text-xs text-muted">
                    <th className="pb-2 text-start font-medium">{t('plan.sc.load')}</th>
                    <th className="pb-2 text-start font-medium">{t('plan.sc.perDay')}</th>
                    <th className="pb-2 text-start font-medium">{t('plan.sc.time')}</th>
                    <th className="pb-2 text-start font-medium">{t('plan.sc.duration')}</th>
                    <th className="pb-2 text-start font-medium">{t('plan.sc.finish')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {scen.map((x) => (
                    <tr
                      key={x.n}
                      className={`cursor-pointer hover:bg-surface-2 ${uniformN === x.n ? 'font-semibold text-brand' : ''}`}
                      onClick={() => {
                        setMode('count');
                        setPerDay(uniformPerDay(s.remaining, x.n));
                      }}
                    >
                      <td className="py-2">{t('plan.setsN', { n: x.n })}</td>
                      <td className="num py-2">{num(x.dailyCount)}</td>
                      <td className="num py-2">{t('unit.min', { n: x.dailyMinutes })}</td>
                      <td className="py-2">{fmtDuration(tr, x.days)}</td>
                      <td className="py-2">{x.finishDate ? date(x.finishDate) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Итог плана */}
        <div className="space-y-4 lg:sticky lg:top-6">
          <Card>
            <p className="eyebrow">{t('plan.summary')}</p>
            {proj.blocked.length > 0 ? (
              <div className="mt-3">
                <Notice tone="warning">{t('plan.blocked', { list: proj.blocked.map((p) => t(`prayer.${p}`)).join(', ') })}</Notice>
              </div>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted">{t('plan.finishBy')}</p>
                <p className="text-2xl font-semibold tracking-tight">{proj.finishDate && date(proj.finishDate)}</p>
                <p className="mt-0.5 text-sm text-muted">{fmtDuration(tr, proj.days)}</p>
              </>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
              <div>
                <dt className="text-xs text-muted">{t('plan.perDayTotal')}</dt>
                <dd className="num text-xl font-semibold">{num(proj.dailyCount)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t('plan.timePerDay')}</dt>
                <dd className="num text-xl font-semibold">{t('unit.min', { n: proj.dailyMinutes })}</dd>
              </div>
            </dl>
            <button
              className="btn-primary mt-5 w-full"
              disabled={!dirty || proj.blocked.length > 0}
              onClick={() => {
                actions.setPlan({ perDay, minutesPerRakah: minPerRakah, targetDate: mode === 'date' ? target : null, startDate: today });
                toast({ text: t('plan.saved') });
              }}
            >
              <Icon name="check" size={18} /> {saved ? (dirty ? t('plan.update') : t('plan.isSaved')) : t('plan.save')}
            </button>
          </Card>

          {pace > 0 && (
            <Card className="p-4">
              <p className="text-sm font-medium">{t('plan.actual')}</p>
              <p className="mt-1 text-sm text-muted">
                {t('plan.actualText', { n: num(Math.round(pace * 10) / 10), date: date(addDays(today, Math.ceil(s.remainingTotal / pace))) })}
              </p>
            </Card>
          )}

          <Notice>{l(rules.order)}</Notice>
        </div>
      </div>
    </>
  );
}

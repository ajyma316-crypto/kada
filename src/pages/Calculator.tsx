/**
 * Калькулятор пропущенных намазов.
 * Форма → domain/calculator.calculate() → результат с допущениями и предупреждениями.
 * Ввод автоматически сохраняется; задолженность меняется только по явному нажатию.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DebtEditor } from '../components/DebtEditor';
import { Icon } from '../components/Icon';
import { Card, Field, Modal, Notice, NumberInput, PageHeader, Segmented, Toggle } from '../components/ui';
import { actions, useStore } from '../data/store';
import { calculate, CalcError, defaultCalcInput, lunarToSolarYears } from '../domain/calculator';
import { humanizeDays, todayISO } from '../domain/dates';
import { ALL_PRAYERS, PRAYER_AR, type CalcInput, type CalcResult, type DateRange, type ExemptionKind, type ExemptionPeriod, type Madhab, type Note } from '../domain/types';
import { COMMON_RULES, MADHABS, getRules } from '../fiqh/rules';
import { useT } from '../i18n';
import { uid } from '../lib/id';
import { useRules, useSummary } from '../lib/hooks';

const EXEMPT_KINDS: ExemptionKind[] = ['before_islam', 'insanity', 'unconsciousness', 'hayd_known', 'nifas_known', 'other'];

export default function Calculator() {
  const tr = useT();
  const { t, l, note } = tr;
  const settings = useStore((s) => s.settings);
  const saved = useStore((s) => s.calc);
  const rules = useRules();
  const summary = useSummary();
  const navigate = useNavigate();
  const today = todayISO();

  const input: CalcInput = saved?.input ?? defaultCalcInput(today);
  const set = (patch: Partial<CalcInput>) => actions.saveCalc({ ...input, ...patch }, saved?.result ?? null);

  // Пол, мазхаб и витр берутся из настроек — единый источник истины.
  const effective: CalcInput = { ...input, gender: settings.gender, includeWitr: settings.includeWitr };

  const computed = useMemo((): { result: CalcResult | null; error: Note | null } => {
    try {
      return { result: calculate(effective, settings.madhab, today), error: null };
    } catch (e) {
      if (e instanceof CalcError) return { result: null, error: e.note };
      throw e;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(effective), settings.madhab, today]);

  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const female = settings.gender === 'female';
  const res = computed.result;

  function apply() {
    if (!res) return;
    actions.saveCalc(effective, res);
    actions.applyDebt(res.perPrayer, 'calculation', t('debt.kind.calcNote', { madhab: tr.madhab(settings.madhab) }));
    setConfirm(false);
    navigate('/');
  }

  return (
    <>
      <PageHeader arabic="حساب الفوائت" title={t('calc.title')} subtitle={t('calc.subtitle')} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="space-y-5">
          {/* 1. Основное */}
          <Card>
            <SectionTitle n={1} title={t('calc.s1')} />
            <div className="space-y-4">
              <Field label={t('settings.madhab')}>
                <select className="input" value={settings.madhab} onChange={(e) => changeMadhab(e.target.value as typeof settings.madhab)}>
                  {MADHABS.map((m) => (
                    <option key={m} value={m}>{tr.madhab(m)}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('settings.gender')}>
                <Segmented
                  label={t('settings.gender')}
                  value={settings.gender}
                  onChange={(g) => actions.updateSettings({ gender: g })}
                  options={[{ value: 'male', label: t('gender.male') }, { value: 'female', label: t('gender.female') }]}
                />
              </Field>
            </div>
          </Card>

          {/* 2. Булюг */}
          <Card>
            <SectionTitle n={2} title={t('calc.s2')} />
            <div className="space-y-4">
              <Segmented
                label={t('calc.s2')}
                value={input.bulughMode}
                onChange={(v) => set({ bulughMode: v })}
                options={[{ value: 'age', label: t('calc.bulugh.byAge') }, { value: 'date', label: t('calc.bulugh.byDate') }]}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="birth" label={t('calc.birthDate')} hint={input.bulughMode === 'date' ? t('calc.birthOptional') : undefined}>
                  <input id="birth" type="date" className="input" max={today} value={input.birthDate ?? ''} onChange={(e) => set({ birthDate: e.target.value || null })} />
                  <label className="mt-2 flex items-center gap-2 text-sm text-muted">
                    <input type="checkbox" className="accent-[rgb(var(--brand))]" checked={input.birthDateApprox} onChange={(e) => set({ birthDateApprox: e.target.checked })} />
                    {t('calc.birthApprox')}
                  </label>
                </Field>
                {input.bulughMode === 'age' ? (
                  <Field
                    id="age"
                    label={t('calc.bulughAge')}
                    hint={input.bulughAgeUnit === 'lunar' ? t('calc.lunarHint', { solar: lunarToSolarYears(input.bulughAge).toFixed(1) }) : undefined}
                  >
                    <div className="flex gap-2">
                      <NumberInput id="age" value={input.bulughAge} min={1} max={39} step={0.5} onChange={(n) => set({ bulughAge: n })} className="w-24" />
                      <select className="input" value={input.bulughAgeUnit} onChange={(e) => set({ bulughAgeUnit: e.target.value as 'lunar' | 'solar' })} aria-label={t('calc.unit')}>
                        <option value="lunar">{t('unit.lunar')}</option>
                        <option value="solar">{t('unit.solar')}</option>
                      </select>
                    </div>
                  </Field>
                ) : (
                  <Field id="bdate" label={t('calc.bulughDate')}>
                    <input id="bdate" type="date" className="input" max={today} value={input.bulughDate ?? ''} onChange={(e) => set({ bulughDate: e.target.value || null })} />
                  </Field>
                )}
              </div>
              {input.bulughMode === 'age' && input.bulughAge !== rules.bulugh.defaultAgeLunar && (
                <button className="text-sm font-medium text-brand" onClick={() => set({ bulughAge: rules.bulugh.defaultAgeLunar, bulughAgeUnit: 'lunar' })}>
                  {t('calc.useDefaultAge', { n: rules.bulugh.defaultAgeLunar, madhab: tr.madhab(settings.madhab) })}
                </button>
              )}
              <Notice title={t('calc.bulughRuleTitle', { madhab: tr.madhab(settings.madhab) })}>
                <p>{l(rules.bulugh.note)}</p>
                <p className="mt-1.5 text-muted">{l(COMMON_RULES.bulughSigns)}</p>
              </Notice>
            </div>
          </Card>

          {/* 3. Период */}
          <Card>
            <SectionTitle n={3} title={t('calc.s3')} />
            <div className="space-y-5">
              <Field id="end" label={t('calc.endDate')} hint={t('calc.endHint')}>
                <input id="end" type="date" className="input sm:max-w-xs" max={today} value={input.endDate} onChange={(e) => set({ endDate: e.target.value || today })} />
              </Field>
              <Field id="pct" label={t('calc.performed', { pct: input.performedPercent })} hint={t('calc.performedHint')}>
                <input
                  id="pct"
                  type="range"
                  min={0}
                  max={95}
                  step={5}
                  value={input.performedPercent}
                  onChange={(e) => set({ performedPercent: Number(e.target.value) })}
                  className="w-full accent-[rgb(var(--brand))]"
                />
              </Field>
            </div>
          </Card>

          {/* 4. Для женщин */}
          {female && (
            <Card>
              <SectionTitle n={4} title={t('calc.s4')} />
              <div className="space-y-4">
                <Notice>{l(COMMON_RULES.haydNoQada)}</Notice>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field id="hayd" label={t('calc.haydAvg')} hint={t('calc.haydRange', { min: rules.hayd.minDays ?? '—', max: rules.hayd.maxDays })}>
                    <NumberInput id="hayd" value={input.haydAvgDays} max={31} step={0.5} onChange={(n) => set({ haydAvgDays: n })} />
                  </Field>
                  <Field id="births" label={t('calc.births')}>
                    <NumberInput id="births" value={input.nifasBirths} max={30} onChange={(n) => set({ nifasBirths: Math.round(n) })} />
                  </Field>
                  <Field id="nifas" label={t('calc.nifasAvg')} hint={t('calc.nifasMax', { max: rules.nifas.maxDays })}>
                    <NumberInput id="nifas" value={input.nifasAvgDays} max={120} onChange={(n) => set({ nifasAvgDays: Math.round(n) })} />
                  </Field>
                </div>
                <details className="text-sm text-muted">
                  <summary className="cursor-pointer font-medium text-ink">{t('calc.madhabDetails')}</summary>
                  <p className="mt-2">{l(rules.hayd.note)}</p>
                  <p className="mt-1">{l(rules.nifas.note)}</p>
                </details>
              </div>
            </Card>
          )}

          {/* 5. Освобождающие периоды */}
          <Card>
            <SectionTitle n={female ? 5 : 4} title={t('calc.s5')} />
            <p className="mb-4 text-sm text-muted">{t('calc.exemptText')}</p>
            <RangeList
              items={input.exemptions}
              onChange={(exemptions) => set({ exemptions })}
              newItem={(): ExemptionPeriod => ({ id: uid(), kind: 'before_islam', start: '', end: '' })}
              addLabel={t('calc.addExempt')}
              renderExtra={(item, update) => (
                <select className="input" value={item.kind} onChange={(e) => update({ kind: e.target.value as ExemptionKind })} aria-label={t('calc.kind')}>
                  {EXEMPT_KINDS.filter((k) => female || (k !== 'hayd_known' && k !== 'nifas_known')).map((k) => (
                    <option key={k} value={k}>{t(`exempt.${k}`)}</option>
                  ))}
                </select>
              )}
              renderNote={(item) => (
                <p className="text-xs leading-relaxed text-muted sm:col-span-4">
                  {rules.exemptions[item.kind].disputed && <span className="font-semibold text-warn">{t('common.disputed')} · </span>}
                  {l(rules.exemptions[item.kind].note)}
                </p>
              )}
            />
          </Card>

          {/* 6. Дополнительные пропуски */}
          <Card>
            <SectionTitle n={female ? 6 : 5} title={t('calc.s6')} />
            <p className="mb-4 text-sm text-muted">{t('calc.extraText')}</p>
            <RangeList items={input.extraMissed} onChange={(extraMissed) => set({ extraMissed })} newItem={() => ({ id: uid(), start: '', end: '' })} addLabel={t('calc.addExtra')} />
          </Card>

          {/* 7. Витр */}
          <Card>
            <SectionTitle n={female ? 7 : 6} title={t('calc.s7')} />
            <Toggle
              checked={settings.includeWitr}
              onChange={(v) => actions.updateSettings({ includeWitr: v })}
              label={t('calc.includeWitr')}
              description={<>{t('calc.witrStatus', { madhab: tr.madhab(settings.madhab), status: l(rules.witr.status) })} {l(rules.witr.note)}</>}
            />
          </Card>
        </div>

        {/* Результат */}
        <div className="scroll-mt-20 lg:sticky lg:top-6" id="result">
          <Card>
            <p className="eyebrow">{t('calc.result')}</p>
            {computed.error ? (
              <div className="mt-3">
                <Notice tone="warning">{note(computed.error)}</Notice>
              </div>
            ) : res ? (
              <ResultView res={res} />
            ) : null}

            <div className="mt-5 flex flex-col gap-2">
              <button className="btn-primary" disabled={!res} onClick={() => (summary.debtTotal > 0 ? setConfirm(true) : apply())}>
                <Icon name="check" size={18} /> {t('calc.apply')}
              </button>
              <button className="btn-ghost" onClick={() => setEditing(true)}>
                <Icon name="edit" size={18} /> {t('calc.manual')}
              </button>
            </div>
            <p className="hint">{t('calc.disclaimer')} <Link to="/rules" className="text-brand underline">{t('nav.rules')}</Link></p>
          </Card>
        </div>
      </div>

      {/* Мобильная плашка с итогом — результат на телефоне находится внизу формы */}
      {res && (
        <a
          href="#result"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById('result')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="no-print fixed inset-x-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex items-center justify-between rounded-2xl bg-ink px-4 py-3 text-sm text-bg shadow-lg lg:hidden"
        >
          <span>
            {t('calc.result')}: <span className="num font-semibold">{res.approximate ? '≈ ' : ''}{tr.num(res.total)}</span>
          </span>
          <Icon name="arrow" size={18} className="rotate-90" />
        </a>
      )}

      <Modal open={confirm} onClose={() => setConfirm(false)} title={t('calc.confirm.title')}>
        <p className="text-sm text-muted">
          {t('calc.confirm.text', { from: summary.debtTotal, to: res?.total ?? 0 })}
        </p>
        {summary.doneTotal > 0 && <p className="mt-2 text-sm text-muted">{t('calc.confirm.keepDone', { n: summary.doneTotal })}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setConfirm(false)}>{t('common.cancel')}</button>
          <button className="btn-primary" onClick={apply}>{t('calc.apply')}</button>
        </div>
      </Modal>
      <DebtEditor open={editing} onClose={() => setEditing(false)} />
    </>
  );

  function changeMadhab(m: typeof settings.madhab) {
    // При смене мазхаба витр включается/выключается по его правилу (пользователь может изменить).
    actions.updateSettings({ madhab: m, includeWitr: rulesWitr(m) });
  }
}

function rulesWitr(m: Madhab) {
  return getRules(m).witr.qadaRequired;
}

function ResultView({ res }: { res: CalcResult }) {
  const tr = useT();
  const { t, num, note, date } = tr;
  const b = res.breakdown;
  const h = humanizeDays(b.debtDays);
  const warnings = res.warnings.filter((w) => w.severity !== 'info');
  const infos = res.warnings.filter((w) => w.severity === 'info');
  return (
    <div className="mt-2">
      <div className="flex items-baseline gap-2">
        <span className="num text-4xl font-semibold tracking-tight">{res.approximate ? '≈ ' : ''}{num(res.total)}</span>
        <span className="text-sm text-muted">{t('calc.prayers', { n: res.total })}</span>
      </div>
      <p className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${res.approximate ? 'bg-warn-soft text-warn' : 'bg-brand-soft text-brand'}`}>
        {res.approximate ? t('calc.approximate') : t('calc.exact')}
      </p>

      <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
        {ALL_PRAYERS.filter((p) => p !== 'witr' || res.perPrayer.witr > 0).map((p) => (
          <li key={p} className="flex items-center justify-between px-3.5 py-2 text-sm">
            <span>
              {t(`prayer.${p}`)} <span className="ar ms-1 text-muted" lang="ar">{PRAYER_AR[p]}</span>
            </span>
            <span className="num font-semibold">{num(res.perPrayer[p])}</span>
          </li>
        ))}
      </ul>

      <details className="mt-4 text-sm" open>
        <summary className="cursor-pointer font-medium">{t('calc.breakdown')}</summary>
        <dl className="mt-2 space-y-1 text-muted">
          <Row k={t('calc.b.bulugh')} v={date(res.bulughDate)} />
          <Row k={t('calc.b.main')} v={num(b.mainDays)} />
          {b.extraDays > 0 && <Row k={t('calc.b.extra')} v={'+ ' + num(b.extraDays)} />}
          {b.exemptDays > 0 && <Row k={t('calc.b.exempt')} v={'− ' + num(b.exemptDays)} />}
          {b.nifasDays > 0 && <Row k={t('calc.b.nifas')} v={'− ' + num(b.nifasDays)} />}
          {b.haydDays > 0 && <Row k={t('calc.b.hayd')} v={'− ' + num(b.haydDays)} />}
          {b.performedDays > 0 && <Row k={t('calc.b.performed')} v={'− ' + num(b.performedDays)} />}
          <Row k={t('calc.b.debtDays')} v={num(b.debtDays)} strong />
          <p className="pt-1 text-xs">
            ≈ {[h.years && t('unit.years', { n: h.years }), h.months && t('unit.months', { n: h.months }), t('unit.days', { n: h.days })].filter(Boolean).join(' ')}
          </p>
        </dl>
      </details>

      {warnings.length > 0 && (
        <div className="mt-4 space-y-2">
          {warnings.map((w, i) => (
            <Notice key={i} tone="warning">{note(w)}</Notice>
          ))}
        </div>
      )}

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-medium">{t('calc.assumptions', { n: res.assumptions.length + infos.length })}</summary>
        <ul className="mt-2 list-disc space-y-1.5 ps-5 text-muted">
          {res.assumptions.map((a, i) => (
            <li key={i}>{note(a)}</li>
          ))}
          {infos.map((a, i) => (
            <li key={'i' + i}>{note(a)}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? 'border-t border-line pt-1 font-semibold text-ink' : ''}`}>
      <dt>{k}</dt>
      <dd className="num">{v}</dd>
    </div>
  );
}

function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-2.5 font-semibold">
      <span className="num grid h-6 w-6 place-items-center rounded-full bg-brand-soft text-xs text-brand">{n}</span>
      {title}
    </h2>
  );
}

function RangeList<R extends DateRange>({
  items,
  onChange,
  newItem,
  addLabel,
  renderExtra,
  renderNote,
}: {
  items: R[];
  onChange: (items: R[]) => void;
  newItem: () => R;
  addLabel: string;
  renderExtra?: (item: R, update: (p: Partial<R>) => void) => React.ReactNode;
  renderNote?: (item: R) => React.ReactNode;
}) {
  const { t } = useT();
  const today = todayISO();
  return (
    <div className="space-y-3">
      {items.map((it, i) => {
        const update = (p: Partial<R>) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
        const bad = it.start && it.end && it.end < it.start;
        return (
          <div key={it.id} className={`grid gap-2 rounded-xl border border-line bg-surface-2/50 p-3 sm:items-center ${renderExtra ? 'sm:grid-cols-[1.3fr_1fr_1fr_auto]' : 'sm:grid-cols-[1fr_1fr_auto]'}`}>
            {renderExtra && renderExtra(it, update)}
            <input type="date" className="input" max={today} value={it.start} onChange={(e) => update({ start: e.target.value } as Partial<R>)} aria-label={t('calc.from')} />
            <input type="date" className="input" max={today} value={it.end} onChange={(e) => update({ end: e.target.value } as Partial<R>)} aria-label={t('calc.to')} />
            <button className="btn-quiet justify-self-end p-2" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={t('common.delete')}>
              <Icon name="trash" size={18} />
            </button>
            {renderNote && renderNote(it)}
            {bad && <p className="text-xs text-danger sm:col-span-4">{t('calc.badRange')}</p>}
          </div>
        );
      })}
      <button className="btn-ghost" onClick={() => onChange([...items, newItem()])}>
        <Icon name="plus" size={16} /> {addLabel}
      </button>
    </div>
  );
}

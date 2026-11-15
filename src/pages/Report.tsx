/** Печатный отчёт (через «Печать → Сохранить как PDF»). Без навигации, оптимизирован для A4. */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useStore } from '../data/store';
import { todayISO } from '../domain/dates';
import { series } from '../domain/stats';
import { PRAYER_AR } from '../domain/types';
import { useT } from '../i18n';
import { useSummary, useVisiblePrayers } from '../lib/hooks';

export default function Report() {
  const tr = useT();
  const { t, num, date } = tr;
  const s = useSummary();
  const prayers = useVisiblePrayers();
  const logs = useStore((st) => st.logs);
  const settings = useStore((st) => st.settings);
  const calc = useStore((st) => st.calc);
  const plan = useStore((st) => st.plan);
  const months = useMemo(() => series(logs, 'month', 12, todayISO()), [logs]);
  const monthFmt = new Intl.DateTimeFormat(tr.lang, { month: 'long', year: 'numeric', timeZone: 'UTC' });

  return (
    <div className="mx-auto max-w-3xl bg-bg px-6 py-8 print:max-w-none print:p-0">
      <div className="no-print mb-6 flex justify-between">
        <Link to="/stats" className="btn-ghost">← {t('common.back')}</Link>
        <button className="btn-primary" onClick={() => window.print()}><Icon name="print" size={17} /> {t('report.print')}</button>
      </div>

      <header className="mb-6 flex items-end justify-between border-b border-line pb-4">
        <div>
          <p className="ar text-xl text-gold" lang="ar">قضاء الصلاة</p>
          <h1 className="text-2xl font-semibold">{t('report.title')}</h1>
        </div>
        <p className="text-sm text-muted">{date(todayISO())}</p>
      </header>

      <section className="mb-6 grid grid-cols-4 gap-3">
        {[
          [t('dash.total'), (calc?.result?.approximate ? '≈ ' : '') + num(s.debtTotal)],
          [t('dash.done'), num(s.debtTotal - s.remainingTotal)],
          [t('dash.remaining'), num(s.remainingTotal)],
          [t('dash.progress'), `${num(Math.floor(s.progress * 1000) / 10)}%`],
        ].map(([k, v]) => (
          <div key={k} className="card p-3">
            <p className="text-xs text-muted">{k}</p>
            <p className="num text-xl font-semibold">{v}</p>
          </div>
        ))}
      </section>

      <section className="card mb-6">
        <h2 className="mb-3 font-semibold">{t('dash.byPrayer')}</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th className="pb-2 text-start font-medium">{t('stats.prayer')}</th>
              <th className="pb-2 text-end font-medium">{t('dash.total')}</th>
              <th className="pb-2 text-end font-medium">{t('dash.done')}</th>
              <th className="pb-2 text-end font-medium">{t('dash.remaining')}</th>
              {plan && <th className="pb-2 text-end font-medium">{t('report.perDay')}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {prayers.map((p) => (
              <tr key={p}>
                <td className="py-1.5">{t(`prayer.${p}`)} <span className="ar text-muted" lang="ar">{PRAYER_AR[p]}</span></td>
                <td className="num py-1.5 text-end">{num(s.debt[p])}</td>
                <td className="num py-1.5 text-end">{num(s.debt[p] - s.remaining[p])}</td>
                <td className="num py-1.5 text-end font-semibold">{num(s.remaining[p])}</td>
                {plan && <td className="num py-1.5 text-end">{plan.perDay[p]}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card mb-6">
        <h2 className="mb-3 font-semibold">{t('report.monthly')}</h2>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-line">
            {months.map((m) => (
              <tr key={m.key}>
                <td className="py-1.5">{monthFmt.format(new Date(m.start + 'T00:00:00Z'))}</td>
                <td className="num py-1.5 text-end">{num(m.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="text-xs leading-relaxed text-muted">
        <p>{t('report.madhab', { madhab: tr.madhab(settings.madhab) })}</p>
        {calc?.result && <ul className="mt-2 list-disc ps-5">{calc.result.assumptions.map((a, i) => <li key={i}>{tr.note(a)}</li>)}</ul>}
        <p className="mt-2">{t('report.disclaimer')}</p>
      </section>
    </div>
  );
}

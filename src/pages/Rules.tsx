/** Правила по мазхабам, сравнительная таблица, источники и порядок проверки специалистом. */
import { useState } from 'react';
import { Card, Notice, PageHeader, Segmented } from '../components/ui';
import { useStore } from '../data/store';
import type { ExemptionKind, Madhab } from '../domain/types';
import { COMMON_RULES, MADHAB_RULES, MADHABS, SOURCES } from '../fiqh/rules';
import { useT } from '../i18n';

export default function Rules() {
  const tr = useT();
  const { t, l } = tr;
  const current = useStore((s) => s.settings.madhab);
  const [m, setM] = useState<Madhab>(current);
  const r = MADHAB_RULES[m];

  return (
    <>
      <PageHeader arabic="الأحكام والمصادر" title={t('rules.title')} subtitle={t('rules.subtitle')} />

      {MADHABS.some((x) => MADHAB_RULES[x].review.status === 'unverified') && (
        <div className="mb-5">
          <Notice tone="warning" title={t('rules.unverified.title')}>
            {t('rules.unverified.text')}
          </Notice>
        </div>
      )}

      <Card className="mb-5">
        <h2 className="mb-4 font-semibold">{t('rules.compare')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="pb-2 text-start font-medium" />
                {MADHABS.map((x) => (
                  <th key={x} className={`pb-2 text-start font-medium ${x === current ? 'text-brand' : ''}`}>{tr.madhab(x)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <CompareRow label={t('rules.c.bulugh')} cell={(x) => t('rules.c.years', { n: MADHAB_RULES[x].bulugh.defaultAgeLunar }) + (MADHAB_RULES[x].bulugh.disputed ? ' *' : '')} />
              <CompareRow label={t('rules.c.hayd')} cell={(x) => `${MADHAB_RULES[x].hayd.minDays ?? '—'} – ${MADHAB_RULES[x].hayd.maxDays}`} />
              <CompareRow label={t('rules.c.nifas')} cell={(x) => `≤ ${MADHAB_RULES[x].nifas.maxDays}`} />
              <CompareRow label={t('rules.c.witr')} cell={(x) => l(MADHAB_RULES[x].witr.status)} />
              <CompareRow label={t('rules.c.witrQada')} cell={(x) => (MADHAB_RULES[x].witr.qadaRequired ? t('common.yes') : t('common.no'))} />
              <CompareRow label={t('rules.c.unconscious')} cell={(x) => (MADHAB_RULES[x].exemptions.unconsciousness.exempt ? t('rules.c.exempt') : t('rules.c.makeup'))} />
            </tbody>
          </table>
        </div>
        <p className="hint">{t('rules.c.note')}</p>
      </Card>

      <div className="mb-4">
        <Segmented label={t('settings.madhab')} value={m} onChange={setM} options={MADHABS.map((x) => ({ value: x, label: tr.madhab(x) }))} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <RuleCard title={t('rules.bulugh')} disputed={r.bulugh.disputed}>{l(r.bulugh.note)}</RuleCard>
        <RuleCard title={t('rules.witr')}>{l(r.witr.note)}</RuleCard>
        <RuleCard title={t('rules.hayd')}>{l(r.hayd.note)}</RuleCard>
        <RuleCard title={t('rules.nifas')}>{l(r.nifas.note)}</RuleCard>
        <RuleCard title={t('rules.timing')}>{l(r.qadaTiming)}</RuleCard>
        <RuleCard title={t('rules.order')}>{l(r.order)}</RuleCard>
      </div>

      <Card className="mt-4">
        <h2 className="mb-3 font-semibold">{t('rules.exemptions')}</h2>
        <ul className="space-y-3 text-sm">
          {(Object.keys(r.exemptions) as ExemptionKind[]).map((k) => (
            <li key={k}>
              <p className="font-medium">
                {t(`exempt.${k}`)}{' '}
                {r.exemptions[k].disputed && <span className="ms-1 rounded-full bg-warn-soft px-2 py-0.5 text-xs text-warn">{t('common.disputed')}</span>}
              </p>
              <p className="mt-0.5 text-muted">{l(r.exemptions[k].note)}</p>
            </li>
          ))}
        </ul>
      </Card>

      <h2 className="mb-3 mt-8 font-semibold">{t('rules.common')}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <RuleCard title={t('rules.common.hayd')}>{l(COMMON_RULES.haydNoQada)}</RuleCard>
        <RuleCard title={t('rules.common.deliberate')} disputed>{l(COMMON_RULES.deliberateMissed)}</RuleCard>
        <RuleCard title={t('rules.common.approx')}>{l(COMMON_RULES.approximation)}</RuleCard>
        <RuleCard title={t('rules.common.travel')}>{l(COMMON_RULES.travel)}</RuleCard>
      </div>

      <h2 className="mb-3 mt-8 font-semibold">{t('rules.sources')}</h2>
      <Card>
        <ul className="divide-y divide-line text-sm">
          {Object.values(SOURCES).map((src) => (
            <li key={src.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
              <span>
                <span className="ar text-base" lang="ar">{src.title}</span>
                <span className="ms-2 text-muted">— {l(src.author)}</span>
              </span>
              <span className="text-xs text-muted">{src.madhab === 'general' ? '' : tr.madhab(src.madhab)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <h2 className="mb-3 mt-8 font-semibold">{t('rules.review')}</h2>
      <Card>
        <ol className="list-decimal space-y-2 ps-5 text-sm text-muted">
          <li>{t('rules.review.1')}</li>
          <li>{t('rules.review.2')}</li>
          <li>{t('rules.review.3')}</li>
          <li>{t('rules.review.4')}</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {MADHABS.map((x) => (
            <span key={x} className={`rounded-full px-2.5 py-1 ${MADHAB_RULES[x].review.status === 'reviewed' ? 'bg-brand-soft text-brand' : 'bg-warn-soft text-warn'}`}>
              {tr.madhab(x)}: {t(`rules.status.${MADHAB_RULES[x].review.status}`)}
            </span>
          ))}
        </div>
      </Card>
    </>
  );
}

function CompareRow({ label, cell }: { label: string; cell: (m: Madhab) => string }) {
  return (
    <tr>
      <td className="py-2 pe-3 text-muted">{label}</td>
      {MADHABS.map((m) => (
        <td key={m} className="py-2 pe-3">{cell(m)}</td>
      ))}
    </tr>
  );
}

function RuleCard({ title, children, disputed }: { title: string; children: React.ReactNode; disputed?: boolean }) {
  const { t } = useT();
  return (
    <Card className="p-4">
      <h3 className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
        {title}
        {disputed && <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">{t('common.disputed')}</span>}
      </h3>
      <p className="text-sm leading-relaxed text-muted">{children}</p>
    </Card>
  );
}

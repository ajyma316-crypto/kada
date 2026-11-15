import { useMemo } from 'react';
import { useStore } from '../data/store';
import { summarize } from '../domain/ledger';
import { ALL_PRAYERS, type PrayerId } from '../domain/types';
import { getRules } from '../fiqh/rules';

export function useSummary() {
  const events = useStore((s) => s.debtEvents);
  const logs = useStore((s) => s.logs);
  return useMemo(() => summarize(events, logs), [events, logs]);
}

/** Намазы, которые показываются пользователю: витр — только если он включён или по нему есть долг. */
export function useVisiblePrayers(): PrayerId[] {
  const includeWitr = useStore((s) => s.settings.includeWitr);
  const summary = useSummary();
  return ALL_PRAYERS.filter((p) => p !== 'witr' || includeWitr || summary.debt.witr > 0);
}

export function useRules() {
  const madhab = useStore((s) => s.settings.madhab);
  return getRules(madhab);
}

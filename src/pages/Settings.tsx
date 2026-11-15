/** Настройки: мазхаб, профиль, оформление, язык, аккаунт и синхронизация, данные. */
import { useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { Card, Field, Modal, Notice, PageHeader, Segmented, Toggle } from '../components/ui';
import { useCloud } from '../data/cloud';
import { actions, getState, useStore } from '../data/store';
import type { Madhab } from '../domain/types';
import { getRules, MADHABS } from '../fiqh/rules';
import { LANGS, useT } from '../i18n';
import { exportCSV, exportJSON, readJSONFile } from '../lib/export';

export default function SettingsPage() {
  const tr = useT();
  const { t, l } = tr;
  const settings = useStore((s) => s.settings);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  function setMadhab(m: Madhab) {
    actions.updateSettings({ madhab: m, includeWitr: getRules(m).witr.qadaRequired });
  }

  return (
    <>
      <PageHeader title={t('nav.settings')} />
      <div className="mx-auto max-w-2xl space-y-5">
        <Card>
          <h2 className="mb-1 font-semibold">{t('settings.madhab')}</h2>
          <p className="mb-4 text-sm text-muted">{t('settings.madhabText')}</p>
          <div className="grid grid-cols-2 gap-2">
            {MADHABS.map((m) => (
              <button
                key={m}
                onClick={() => setMadhab(m)}
                aria-pressed={settings.madhab === m}
                className={`rounded-xl border p-3 text-start transition ${settings.madhab === m ? 'border-brand bg-brand-soft' : 'border-line hover:bg-surface-2'}`}
              >
                <span className="block font-medium">{tr.madhab(m)}</span>
                <span className="ar block text-muted" lang="ar">{getRules(m).nameAr}</span>
              </button>
            ))}
          </div>
          <div className="mt-5 space-y-4 border-t border-line pt-4">
            <Field label={t('settings.gender')}>
              <Segmented
                label={t('settings.gender')}
                value={settings.gender}
                onChange={(g) => actions.updateSettings({ gender: g })}
                options={[{ value: 'male', label: t('gender.male') }, { value: 'female', label: t('gender.female') }]}
              />
            </Field>
            <Toggle
              checked={settings.includeWitr}
              onChange={(v) => actions.updateSettings({ includeWitr: v })}
              label={t('calc.includeWitr')}
              description={l(getRules(settings.madhab).witr.note)}
            />
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold">{t('settings.appearance')}</h2>
          <div className="space-y-4">
            <Field label={t('settings.theme')}>
              <Segmented
                label={t('settings.theme')}
                value={settings.theme}
                onChange={(v) => actions.updateSettings({ theme: v })}
                options={[
                  { value: 'system', label: t('theme.system') },
                  { value: 'light', label: t('theme.light') },
                  { value: 'dark', label: t('theme.dark') },
                ]}
              />
            </Field>
            <Field label={t('settings.lang')} hint={t('settings.langSoon')}>
              <Segmented label={t('settings.lang')} value={settings.lang} onChange={(v) => actions.updateSettings({ lang: v })} options={LANGS.map((x) => ({ value: x.id, label: x.label }))} />
            </Field>
          </div>
        </Card>

        <Account />

        <Card>
          <h2 className="mb-1 font-semibold">{t('settings.data')}</h2>
          <p className="mb-4 text-sm text-muted">{t('settings.dataText')}</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => exportJSON(getState())}><Icon name="download" size={17} /> {t('settings.backup')}</button>
            <button className="btn-ghost" onClick={() => fileRef.current?.click()}><Icon name="upload" size={17} /> {t('settings.restore')}</button>
            <button className="btn-ghost" onClick={() => exportCSV(getState())}><Icon name="download" size={17} /> CSV</button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try {
                  const data = await readJSONFile(f);
                  if (!confirm(t('settings.restoreConfirm'))) return;
                  actions.importState(data);
                  toast({ text: t('settings.restored') });
                } catch {
                  toast({ text: t('settings.restoreError') });
                }
              }}
            />
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <button className="btn text-danger hover:bg-danger/10" onClick={() => setConfirmReset(true)}>
              <Icon name="trash" size={17} /> {t('settings.reset')}
            </button>
          </div>
        </Card>

        <p className="pb-4 text-center text-xs text-muted">QADA · {t('settings.privacy')}</p>
      </div>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title={t('settings.reset')}>
        <p className="text-sm text-muted">{t('settings.resetText')}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setConfirmReset(false)}>{t('common.cancel')}</button>
          <button
            className="btn bg-danger text-white"
            onClick={() => {
              actions.resetLocal();
              setConfirmReset(false);
            }}
          >
            {t('settings.resetConfirm')}
          </button>
        </div>
      </Modal>
    </>
  );
}

function Account() {
  const { t, dateTime } = useT();
  const cloud = useCloud();
  const lastSync = useStore((s) => s.lastSyncAt);
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  if (!cloud.configured) {
    return (
      <Card>
        <h2 className="mb-1 font-semibold">{t('account.title')}</h2>
        <Notice>{t('account.notConfigured')}</Notice>
      </Card>
    );
  }

  if (cloud.session) {
    return (
      <Card>
        <h2 className="mb-1 font-semibold">{t('account.title')}</h2>
        <p className="text-sm text-muted">{t('account.signedInAs', { email: cloud.session.user.email ?? '' })}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 px-4 py-3 text-sm">
          <Icon name="cloud" size={18} className={cloud.status === 'error' ? 'text-danger' : 'text-brand'} />
          <span className="flex-1">
            {t(`sync.status.${cloud.status}`)}
            {lastSync && <span className="block text-xs text-muted">{t('sync.last', { time: dateTime(lastSync) })}</span>}
          </span>
          <button className="btn-ghost py-1.5" onClick={() => cloud.sync()} disabled={cloud.status === 'syncing'}>{t('sync.now')}</button>
        </div>
        {cloud.error && <p className="mt-2 text-xs text-danger">{cloud.error}</p>}
        <button className="btn-quiet mt-4" onClick={() => setSignOutOpen(true)}>{t('account.signOut')}</button>
        <Modal open={signOutOpen} onClose={() => setSignOutOpen(false)} title={t('account.signOut')}>
          <p className="text-sm text-muted">{t('account.signOutText')}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button className="btn-ghost" onClick={() => { cloud.signOut(false); setSignOutOpen(false); }}>{t('account.keepLocal')}</button>
            <button className="btn-primary" onClick={() => { cloud.signOut(true); setSignOutOpen(false); }}>{t('account.wipeLocal')}</button>
          </div>
        </Modal>
      </Card>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const err = mode === 'in' ? await cloud.signIn(email, password) : await cloud.signUp(email, password);
    setBusy(false);
    if (err) setMsg({ tone: 'error', text: err });
    else if (mode === 'up') setMsg({ tone: 'info', text: t('account.checkEmail') });
  }

  return (
    <Card>
      <h2 className="mb-1 font-semibold">{t('account.title')}</h2>
      <p className="mb-4 text-sm text-muted">{t('account.text')}</p>
      <Segmented label={t('account.title')} value={mode} onChange={setMode} options={[{ value: 'in', label: t('account.signIn') }, { value: 'up', label: t('account.signUp') }]} />
      <form className="mt-4 space-y-3" onSubmit={submit}>
        <input className="input" type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          className="input"
          type="password"
          required
          minLength={8}
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          placeholder={t('account.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary" disabled={busy}>{mode === 'in' ? t('account.signIn') : t('account.signUp')}</button>
          {mode === 'in' && (
            <button
              type="button"
              className="btn-quiet"
              onClick={async () => {
                if (!email) return setMsg({ tone: 'error', text: t('account.enterEmail') });
                const err = await cloud.resetPassword(email);
                setMsg(err ? { tone: 'error', text: err } : { tone: 'info', text: t('account.resetSent') });
              }}
            >
              {t('account.forgot')}
            </button>
          )}
        </div>
      </form>
    </Card>
  );
}

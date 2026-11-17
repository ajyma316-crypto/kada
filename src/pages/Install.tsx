/** Как установить QADA и поделиться им: Android (APK), iPhone (экран «Домой»), веб-версия, QR-код. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Card, PageHeader } from '../components/ui';
import { useT } from '../i18n';
import { isNative, platform } from '../platform';

export const APP_URL = 'https://kada-peach.vercel.app/';
export const INSTALL_URL = APP_URL + '#/install';
export const APK_URL = 'https://github.com/ajyma316-crypto/kada/releases/download/android-latest/qada.apk';

export default function Install() {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const onIOS = platform === 'ios' || /iPhone|iPad|iPod/i.test(ua);
  const onAndroid = platform === 'android' || /Android/i.test(ua);

  async function share() {
    const data = { title: 'QADA — قضاء الصلاة', text: t('install.shareText'), url: INSTALL_URL };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
    } catch {
      return; // пользователь закрыл меню
    }
    try {
      await navigator.clipboard.writeText(INSTALL_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* буфер обмена недоступен */
    }
  }

  const android = (
    <Card key="android">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">{t('install.android.title')}</h2>
      <p className="mb-4 text-sm text-muted">{t('install.android.text')}</p>
      <a className="btn-primary w-full sm:w-auto" href={APK_URL}>
        <Icon name="download" size={18} /> {t('install.android.download')}
      </a>
      <ol className="mt-4 list-decimal space-y-1.5 ps-5 text-sm text-muted">
        <li>{t('install.android.step1')}</li>
        <li>{t('install.android.step2')}</li>
        <li>{t('install.android.step3')}</li>
      </ol>
      <p className="hint">{t('install.android.note')}</p>
    </Card>
  );

  const ios = (
    <Card key="ios">
      <h2 className="mb-1 font-semibold">{t('install.ios.title')}</h2>
      <p className="mb-3 text-sm text-muted">{t('install.ios.text')}</p>
      <ol className="list-decimal space-y-1.5 ps-5 text-sm text-muted">
        <li>{t('install.ios.step1')}</li>
        <li>{t('install.ios.step2')}</li>
        <li>{t('install.ios.step3')}</li>
      </ol>
      <p className="hint">{t('install.ios.note')}</p>
    </Card>
  );

  return (
    <>
      <PageHeader arabic="قضاء الصلاة" title={t('install.title')} subtitle={t('install.subtitle')} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="space-y-5">
          {!isNative && (onIOS ? [ios, android] : onAndroid ? [android, ios] : [android, ios])}
          <Card>
            <h2 className="mb-1 font-semibold">{t('install.web.title')}</h2>
            <p className="mb-4 text-sm text-muted">{t('install.web.text')}</p>
            <a className="btn-ghost" href={APP_URL} target={isNative ? '_blank' : undefined} rel="noreferrer">
              {APP_URL.replace('https://', '').replace(/\/$/, '')}
            </a>
          </Card>
        </div>

        <Card className="text-center">
          <h2 className="font-semibold">{t('install.share.title')}</h2>
          <p className="mt-1 text-sm text-muted">{t('install.share.text')}</p>
          <img src="./qr-install.svg" alt={t('install.qrAlt')} className="mx-auto my-4 w-48 rounded-xl bg-white p-2" width={192} height={192} />
          <button className="btn-primary w-full" onClick={share}>
            <Icon name="upload" size={18} /> {copied ? t('install.copied') : t('install.share.button')}
          </button>
          <p className="mt-3 break-all text-xs text-muted">{INSTALL_URL}</p>
        </Card>
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        <Link to="/privacy" className="underline">{t('privacy.title')}</Link>
      </p>
    </>
  );
}

/** Политика конфиденциальности (нужна пользователям, App Store и Google Play). */
import { Card, PageHeader } from '../components/ui';
import { useT } from '../i18n';

const SECTIONS = ['what', 'local', 'account', 'storage', 'sharing', 'delete', 'children', 'changes', 'contact'] as const;
export const CONTACT_URL = 'https://github.com/ajyma316-crypto/kada/issues';

export default function Privacy() {
  const { t } = useT();
  return (
    <>
      <PageHeader title={t('privacy.title')} subtitle={t('privacy.updated', { date: '17.11.2026' })} />
      <Card className="mx-auto max-w-3xl">
        <div className="space-y-5 text-sm leading-relaxed">
          {SECTIONS.map((k) => (
            <section key={k}>
              <h2 className="mb-1 font-semibold">{t(`privacy.${k}.title`)}</h2>
              <p className="text-muted">{t(`privacy.${k}.text`)}</p>
              {k === 'contact' && (
                <a className="mt-1 inline-block text-brand underline" href={CONTACT_URL} target="_blank" rel="noreferrer">
                  {CONTACT_URL.replace('https://', '')}
                </a>
              )}
            </section>
          ))}
        </div>
      </Card>
    </>
  );
}

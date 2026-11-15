import { NavLink, Outlet } from 'react-router-dom';
import { useT } from '../i18n';
import { useCloud } from '../data/cloud';
import { Icon } from './Icon';

const NAV = [
  { to: '/', icon: 'home', key: 'nav.home', mobile: true },
  { to: '/track', icon: 'check', key: 'nav.track', mobile: true },
  { to: '/plan', icon: 'plan', key: 'nav.plan', mobile: true },
  { to: '/stats', icon: 'chart', key: 'nav.stats', mobile: true },
  { to: '/calculator', icon: 'calc', key: 'nav.calculator', mobile: false },
  { to: '/rules', icon: 'book', key: 'nav.rules', mobile: false },
  { to: '/settings', icon: 'settings', key: 'nav.settings', mobile: false },
];

export function Layout() {
  const { t } = useT();
  const cloud = useCloud();
  return (
    <div className="min-h-dvh lg:flex">
      {/* Боковая панель (десктоп) */}
      <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-line bg-surface px-4 py-6 lg:flex">
        <Brand />
        <nav className="mt-8 flex flex-col gap-1" aria-label={t('nav.main')}>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition ${
                  isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-2 hover:text-ink'
                }`
              }
            >
              <Icon name={n.icon} size={19} />
              {t(n.key)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-xl bg-surface-2 p-3 text-xs text-muted">
          <div className="flex items-center gap-2">
            <Icon name="cloud" size={15} />
            {!cloud.configured
              ? t('sync.localOnly')
              : cloud.session
                ? t(`sync.status.${cloud.status}`)
                : t('sync.signedOut')}
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Верхняя панель (мобильная) */}
        <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/85 px-4 py-3 backdrop-blur lg:hidden">
          <Brand />
          <div className="flex items-center gap-1">
            <NavLink to="/calculator" className="btn-quiet p-2" aria-label={t('nav.calculator')}>
              <Icon name="calc" />
            </NavLink>
            <NavLink to="/settings" className="btn-quiet p-2" aria-label={t('nav.settings')}>
              <Icon name="settings" />
            </NavLink>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
          <Outlet />
        </main>
      </div>

      {/* Нижняя навигация (мобильная) */}
      <nav
        className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label={t('nav.main')}
      >
        {[...NAV.filter((n) => n.mobile), NAV.find((n) => n.to === '/rules')!].map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) => `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${isActive ? 'text-brand' : 'text-muted'}`}
          >
            <Icon name={n.icon} size={22} />
            {t(n.key + '.short')}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function Brand() {
  return (
    <NavLink to="/" className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-brand-ink">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M15 4.5a7.5 7.5 0 1 0 0 15 6 6 0 1 1 0-15z" fill="currentColor" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-wide">QADA</span>
        <span className="ar block text-xs text-muted" lang="ar">قضاء الصلاة</span>
      </span>
    </NavLink>
  );
}

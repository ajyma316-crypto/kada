import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { useStore } from './data/store';
import { setSystemBarsDark } from './platform';
import Dashboard from './pages/Dashboard';
import Calculator from './pages/Calculator';
import Track from './pages/Track';
import PlanPage from './pages/Plan';
import Stats from './pages/Stats';
import Rules from './pages/Rules';
import SettingsPage from './pages/Settings';
import Report from './pages/Report';
import Install from './pages/Install';
import Privacy from './pages/Privacy';

export default function App() {
  const theme = useStore((s) => s.settings.theme);
  const lang = useStore((s) => s.settings.lang);

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#09110f' : '#f7f6f2');
      setSystemBarsDark(dark);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <ToastProvider>
      <Routes>
        <Route path="/report" element={<Report />} />
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="calculator" element={<Calculator />} />
          <Route path="track" element={<Track />} />
          <Route path="plan" element={<PlanPage />} />
          <Route path="stats" element={<Stats />} />
          <Route path="rules" element={<Rules />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="install" element={<Install />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="*" element={<Dashboard />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}

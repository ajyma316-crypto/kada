/** Авторизация и автоматическая синхронизация (React-контекст). */
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { actions, onUserChange } from './store';
import { cloudConfigured, supabase } from './supabase';
import { deleteAccount as deleteAccountRpc, syncNow } from './sync';

type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

interface CloudCtx {
  configured: boolean;
  session: Session | null;
  status: SyncStatus;
  error: string | null;
  sync: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  /** error — текст ошибки; needsConfirm — нужно подтвердить email (если подтверждение включено в Supabase). */
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirm: boolean }>;
  resetPassword: (email: string) => Promise<string | null>;
  signOut: (wipeLocal: boolean) => Promise<void>;
  /** Удалить аккаунт и все облачные данные; локальные данные на устройстве тоже очищаются. */
  deleteAccount: () => Promise<string | null>;
}

const Ctx = createContext<CloudCtx | null>(null);

export function CloudProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SyncStatus>(navigator.onLine ? 'idle' : 'offline');
  const [error, setError] = useState<string | null>(null);
  const running = useRef<Promise<void> | null>(null);
  const again = useRef(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const sync = useCallback(async () => {
    if (!supabase || !userId) return;
    if (!navigator.onLine) {
      setStatus('offline');
      return;
    }
    // Не запускаем параллельные синхронизации — повторим после текущей.
    if (running.current) {
      again.current = true;
      return running.current;
    }
    setStatus('syncing');
    running.current = (async () => {
      try {
        do {
          again.current = false;
          await syncNow(supabase!, userId);
        } while (again.current);
        setStatus('idle');
        setError(null);
      } catch (e) {
        setStatus('error');
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        running.current = null;
      }
    })();
    return running.current;
  }, [userId]);

  // Синхронизация: при входе, при появлении сети, через 2 с после изменений, при возвращении во вкладку.
  useEffect(() => {
    if (!userId) return;
    sync();
    let timer: number | undefined;
    const off = onUserChange(() => {
      clearTimeout(timer);
      timer = window.setTimeout(sync, 2000);
    });
    const online = () => sync();
    const offline = () => setStatus('offline');
    const visible = () => document.visibilityState === 'visible' && sync();
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', visible);
    return () => {
      off();
      clearTimeout(timer);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [userId, sync]);

  const value: CloudCtx = {
    configured: cloudConfigured,
    session,
    status,
    error,
    sync,
    async signIn(email, password) {
      if (!supabase) return 'not-configured';
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error?.message ?? null;
    },
    async signUp(email, password) {
      if (!supabase) return { error: 'not-configured', needsConfirm: false };
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: location.origin + location.pathname },
      });
      // Если в Supabase выключено подтверждение email, сессия приходит сразу — пользователь уже вошёл.
      return { error: error?.message ?? null, needsConfirm: !error && !data.session };
    },
    async resetPassword(email) {
      if (!supabase) return 'not-configured';
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + location.pathname,
      });
      return error?.message ?? null;
    },
    async signOut(wipeLocal) {
      if (!supabase) return;
      try {
        await sync();
      } catch {
        /* выход возможен и без финальной синхронизации */
      }
      await supabase.auth.signOut();
      if (wipeLocal) actions.resetLocal();
    },
    async deleteAccount() {
      if (!supabase) return 'not-configured';
      try {
        await deleteAccountRpc(supabase);
      } catch (e) {
        return e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
      }
      // Аккаунта больше нет: завершаем сессию локально и стираем данные с устройства.
      await supabase.auth.signOut({ scope: 'local' });
      actions.resetLocal();
      return null;
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCloud() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCloud outside CloudProvider');
  return c;
}

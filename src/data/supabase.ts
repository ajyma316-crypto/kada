import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Preferences } from '@capacitor/preferences';
import { isNative } from '../platform';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * В приложении сессия хранится в нативном хранилище (UserDefaults / SharedPreferences),
 * а не в localStorage WebView, которое система может очистить.
 */
const nativeStorage = {
  getItem: async (k: string) => (await Preferences.get({ key: k })).value,
  setItem: (k: string, v: string) => Preferences.set({ key: k, value: v }),
  removeItem: (k: string) => Preferences.remove({ key: k }),
};

/** null — облако не настроено, приложение работает только локально. */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: isNative ? { storage: nativeStorage, detectSessionInUrl: false, persistSession: true, autoRefreshToken: true } : undefined,
      })
    : null;
export const cloudConfigured = supabase !== null;

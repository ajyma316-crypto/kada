/**
 * Страховочная копия данных в приложении (iOS/Android).
 *
 * Основное хранилище — IndexedDB внутри WebView. iOS в редких случаях может очистить
 * данные WebView при нехватке места; папка Data приложения (Filesystem, Directory.Data)
 * системой не очищается. Поэтому в приложении после сохранения (с задержкой) пишется
 * полная копия состояния, а при пустой IndexedDB данные восстанавливаются из неё.
 * На сайте модуль ничего не делает.
 */
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { normalizeState, type AppState } from '../data/state';
import { isNative } from './index';

const FILE = 'qada-state.json';
const DELAY_MS = 5000;

let timer: ReturnType<typeof setTimeout> | null = null;
let latest: AppState | null = null;

export function scheduleNativeBackup(state: AppState) {
  if (!isNative) return;
  latest = state;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void writeNativeBackup(), DELAY_MS);
}

export async function writeNativeBackup(): Promise<void> {
  if (!isNative || !latest) return;
  timer = null;
  const s = latest;
  try {
    await Filesystem.writeFile({ path: FILE, data: JSON.stringify(s), directory: Directory.Data, encoding: Encoding.UTF8 });
  } catch (e) {
    console.warn('QADA: страховочная копия не записана', e);
  }
}

export async function readNativeBackup(): Promise<AppState | null> {
  if (!isNative) return null;
  try {
    const { data } = await Filesystem.readFile({ path: FILE, directory: Directory.Data, encoding: Encoding.UTF8 });
    return normalizeState(JSON.parse(String(data)));
  } catch {
    return null; // файла ещё нет
  }
}

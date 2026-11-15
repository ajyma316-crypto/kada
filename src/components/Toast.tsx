/** Всплывающее уведомление с кнопкой «Отменить» (для ошибочных отметок). */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

interface ToastData {
  id: number;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

const Ctx = createContext<(t: Omit<ToastData, 'id'>) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<number>();
  const show = useCallback((t: Omit<ToastData, 'id'>) => {
    clearTimeout(timer.current);
    setToast({ ...t, id: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), 5000);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+var(--sab))] z-50 flex justify-center px-4 lg:bottom-8" aria-live="polite">
        {toast && (
          <div key={toast.id} className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-ink py-2.5 pl-4 pr-2 text-sm text-bg shadow-lg">
            <span>{toast.text}</span>
            {toast.onAction && (
              <button
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-semibold text-brand-soft hover:bg-white/10"
                onClick={() => {
                  toast.onAction?.();
                  setToast(null);
                }}
              >
                <Icon name="undo" size={16} />
                {toast.actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

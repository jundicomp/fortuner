import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface T { id: number; msg: string; kind: 'ok' | 'err' }
const Ctx = createContext<(msg: string, kind?: 'ok' | 'err') => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, msg, kind }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === 'err' ? 5000 : 2600);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {items.map((t) => (
          <div key={t.id} role="status" className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-lg ${t.kind === 'ok' ? 'bg-ink text-canvas' : 'bg-bad text-white'}`}>
            {t.kind === 'ok' ? <CheckCircle2 size={18} className="mt-px shrink-0 text-brand" /> : <AlertTriangle size={18} className="mt-px shrink-0" />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

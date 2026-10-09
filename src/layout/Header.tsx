import { Menu, Moon, Sun, Monitor, LogOut, KeyRound, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { ALL_ITEMS } from './menu';
import { applyTheme, getThemePref, type ThemePref } from '@/lib/theme';
import { IS_DEMO } from '@/lib/api';
import { ROLES } from '@/types';
import { SyncStatus } from './SyncStatus';
import { UpdateNotifier } from '@/components/UpdateDialog';
import { sync } from '@/lib/offline';
import { useToast } from '@/components/ui/Toast';

export function Header({ onBurger, onChangePassword }: { onBurger: () => void; onChangePassword: () => void }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const item = ALL_ITEMS.filter((i) => (i.path === '/' ? loc.pathname === '/' : loc.pathname.startsWith(i.path))).sort((a, b) => b.path.length - a.path.length)[0];
  const [theme, setTheme] = useState<ThemePref>(getThemePref());
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const click = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', click);
    return () => document.removeEventListener('mousedown', click);
  }, []);

  const cycle = () => { const next: ThemePref = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'; setTheme(next); applyTheme(next); };
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex h-16 items-center gap-2 px-3 sm:px-5">
        <button className="btn btn-ghost px-2.5" onClick={onBurger} aria-label="Buka/tutup menu"><Menu size={20} /></button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold">{item?.label || 'Fortuner POS'}</div>
        </div>
        {IS_DEMO && <span className="pill pill-brand hidden sm:inline-flex">Mode demo</span>}
        <UpdateNotifier />
        <SyncStatus />
        <button className="btn btn-ghost px-2.5" onClick={cycle} title={`Tema: ${theme === 'system' ? 'ikuti sistem' : theme === 'dark' ? 'gelap' : 'terang'}`} aria-label="Ganti tema"><ThemeIcon size={18} /></button>
        <div className="relative" ref={ref}>
          <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-sunk" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-bold text-canvas">{(user?.nama || '?').slice(0, 1).toUpperCase()}</span>
            <span className="hidden text-left md:block">
              <span className="block max-w-[140px] truncate text-[13px] font-bold leading-tight">{user?.nama}</span>
              <span className="block text-[11px] text-muted">{ROLES.find((r) => r.value === user?.role)?.label}</span>
            </span>
            <ChevronDown size={14} className="hidden text-muted md:block" />
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-xl">
              <div className="border-b border-line px-4 py-2.5 md:hidden">
                <div className="text-sm font-bold">{user?.nama}</div>
                <div className="text-xs text-muted">{user?.username}</div>
              </div>
              <button className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-sunk" onClick={() => { setOpen(false); onChangePassword(); }}><KeyRound size={16} /> Ganti password</button>
              <button className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-bad hover:bg-sunk" onClick={() => {
                const n = sync.pendingCount();
                if (n) { setOpen(false); toast(`Masih ada ${n} data belum terkirim. Tunggu internet kembali dan sinkron dulu sebelum keluar.`, 'err'); return; }
                logout();
              }}><LogOut size={16} /> Keluar</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

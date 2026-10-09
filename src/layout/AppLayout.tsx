import { VirtualPrinterDock } from '@/components/VirtualPrinterDock';
import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ChangePasswordModal } from '@/pages/ChangePassword';
import { useAuth } from '@/auth/AuthContext';
import { useSettings } from '@/lib/queries';

const KEY = 'fortuner-sidebar-collapsed';

export function AppLayout() {
  const { user } = useAuth();
  const settings = useSettings();
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setMobileOpen(false), [loc.pathname]);

  const burger = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setCollapsed((c) => { try { localStorage.setItem(KEY, c ? '0' : '1'); } catch { /* abaikan */ } return !c; });
    } else setMobileOpen((o) => !o);
  };

  return (
    <div className="min-h-full">
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} appName={settings.data?.nama_usaha || import.meta.env.VITE_APP_NAME || 'Fortuner POS'} />
      <div className={`transition-[padding] duration-200 ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-[248px]'}`}>
        <Header onBurger={burger} onChangePassword={() => setPwOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
          <Outlet />
        </main>
      </div>
      <VirtualPrinterDock />
      <ChangePasswordModal open={pwOpen || !!user?.harus_ganti_password} forced={!!user?.harus_ganti_password} onClose={() => setPwOpen(false)} />
    </div>
  );
}

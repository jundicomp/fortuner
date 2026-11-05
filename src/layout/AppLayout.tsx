import { VirtualPrinterDock } from '@/components/VirtualPrinterDock';
import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ChangePasswordModal } from '@/pages/ChangePassword';
import { useAuth } from '@/auth/AuthContext';
import { useSettings } from '@/lib/queries';
import { setExportMeta } from '@/components/table/exportXlsx';
import { useToast } from '@/components/ui/Toast';
import { useMaintenance } from '@/lib/maintenance';
import { Link } from 'react-router-dom';
import { Wrench } from 'lucide-react';

const KEY = 'fortuner-sidebar-collapsed';

export function AppLayout() {
  const { user, logout } = useAuth();
  const settings = useSettings();
  const mt = useMaintenance();
  const owner = user?.role === 'owner' || user?.role === 'superadmin';
  // mode perbaikan: pengguna selain owner langsung keluar (server juga menolak semua permintaannya)
  useEffect(() => { if (mt.data?.aktif && user && !owner) void logout(); }, [mt.data?.aktif, user, owner, logout]);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setMobileOpen(false), [loc.pathname]);
  // kop & catatan kaki file Excel
  useEffect(() => { setExportMeta({ company: settings.data?.nama_usaha, user: user?.nama }); }, [settings.data?.nama_usaha, user?.nama]);
  // aplikasi PC: beri tahu lokasi file hasil export
  const toast = useToast();
  useEffect(() => {
    const on = (e: Event) => toast(`Tersimpan di Downloads: ${(e as CustomEvent<{ name: string }>).detail.name}`);
    window.addEventListener('fortuner:file-saved', on);
    return () => window.removeEventListener('fortuner:file-saved', on);
  }, [toast]);

  const burger = () => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setCollapsed((c) => { try { localStorage.setItem(KEY, c ? '0' : '1'); } catch { /* abaikan */ } return !c; });
    } else setMobileOpen((o) => !o);
  };

  return (
    <div className="min-h-full">
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} appName={settings.data?.nama_usaha || import.meta.env.VITE_APP_NAME || 'Fortuner POS'} />
      <div className={`transition-[padding] duration-200 ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-[248px]'}`}>
        {mt.data?.aktif && owner && (
          <div id="maint-banner" className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-[#111] px-4 py-2 text-[13px] text-white sm:px-6">
            <Wrench size={14} className="text-[#F26B1D]" /><b className="text-[#F26B1D]">Mode perbaikan aktif</b>
            <span className="text-white/70">· hanya superadmin yang bisa masuk · pengguna lain melihat halaman perbaikan</span>
            <Link to="/pengaturan/perbaikan" className="ml-auto font-semibold underline underline-offset-2">Atur / matikan</Link>
          </div>
        )}
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

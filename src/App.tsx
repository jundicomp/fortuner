import { HashRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { AppLayout } from '@/layout/AppLayout';
import { ALL_ITEMS } from '@/layout/menu';
import { LoginPage } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { Forbidden, Placeholder } from '@/pages/Placeholder';
import { ProductsPage } from '@/pages/master/ProductsPage';
import { CustomersPage, MachinesPage, PaymentMethodsPage, SuppliersPage } from '@/pages/master/SimpleMasters';
import { UsersPage } from '@/pages/settings/UsersPage';
import { RolesPage } from '@/pages/settings/RolesPage';
import { DevicesPage } from '@/pages/settings/DevicesPage';
import { GeneralPage } from '@/pages/settings/GeneralPage';
import { LogPage } from '@/pages/settings/LogPage';
import { KasirPage } from '@/pages/kasir/KasirPage';
import { FoPage } from '@/pages/fo/FoPage';
import { OrderPage } from '@/pages/order/OrderPage';
import { PiutangPage } from '@/pages/piutang/PiutangPage';
import { ProduksiPage } from '@/pages/produksi/ProduksiPage';
import { MesinPage } from '@/pages/mesin/MesinPage';
import { KasPage } from '@/pages/kas/KasPage';
import { PengeluaranPage } from '@/pages/keuangan/PengeluaranPage';
import { HutangPage } from '@/pages/keuangan/HutangPage';
import { LaporanPage } from '@/pages/laporan/LaporanPage';
import { PrinterPage } from '@/pages/desktop/PrinterPage';
import { PcPage } from '@/pages/desktop/PcPage';
import { isDesktop } from '@/platform/desktop';
import type { ReactElement } from 'react';

const PAGES: Record<string, () => ReactElement | null> = {
  '/': Dashboard,
  '/fo': FoPage,
  '/kasir': KasirPage,
  '/order': OrderPage,
  '/piutang': PiutangPage,
  '/produksi': ProduksiPage,
  '/mesin': MesinPage,
  '/kas': KasPage,
  '/pengeluaran': PengeluaranPage,
  '/hutang': HutangPage,
  '/laporan': LaporanPage,
  '/master/produk': ProductsPage,
  '/master/konsumen': CustomersPage,
  '/master/supplier': SuppliersPage,
  '/master/mesin': MachinesPage,
  '/master/metode-bayar': PaymentMethodsPage,
  '/pengaturan/user': UsersPage,
  '/pengaturan/hak-akses': RolesPage,
  '/pengaturan/perangkat': DevicesPage,
  '/pengaturan/umum': GeneralPage,
  '/pengaturan/log': LogPage,
  '/pengaturan/printer': PrinterPage,
  '/pengaturan/pc': PcPage,
};

function Guard({ perm, children }: { perm: string; children: ReactElement }) {
  const { can } = useAuth();
  return can(perm) ? children : <Forbidden />;
}

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="flex h-full items-center justify-center text-sm text-muted">Memuat…</div>;
  // HashRouter: URL jadi /#/master/produk sehingga tidak 404 di GitHub Pages.
  // Build demo satu-file memakai MemoryRouter supaya bisa jalan di halaman pratinjau yang membatasi perubahan URL.
  const Router = import.meta.env.MODE === 'demo' ? MemoryRouter : HashRouter;
  return (
    <Router>
      {!user ? (
        <Routes><Route path="*" element={<LoginPage />} /></Routes>
      ) : (
        <Routes>
          <Route element={<AppLayout />}>
            {ALL_ITEMS.filter((i) => !i.desktop || isDesktop()).map((i) => {
              const Page = PAGES[i.path];
              return <Route key={i.path} path={i.path} element={<Guard perm={i.perm}>{Page ? <Page /> : <Placeholder item={i} />}</Guard>} />;
            })}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
    </Router>
  );
}

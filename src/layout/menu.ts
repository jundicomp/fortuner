import {
  LayoutDashboard, ShoppingCart, FilePlus2, ClipboardList, Factory, HandCoins, Receipt, Truck, Wallet, Gauge, Package, Users, Store, Cog,
  CreditCard, BarChart3, Boxes, ShoppingBag, TrendingUp, BookOpen, Percent, UserCog, ShieldCheck, MonitorSmartphone, SlidersHorizontal, History, ArrowLeftRight, Landmark, Database, Settings, Printer, MonitorCog, Info, type LucideIcon,
} from 'lucide-react';

/** `desktop` = hanya muncul di aplikasi desktop (Tauri). */
export interface MenuItem { path: string; label: string; icon: LucideIcon; perm: string; tahap?: number; desc?: string; desktop?: boolean }
export interface MenuGroup { label: string; icon?: LucideIcon; items: MenuItem[] }

/** Menu sidebar. `tahap` = modul yang belum dibangun; halamannya menampilkan rencana tahap itu. */
export const MENU: MenuGroup[] = [
  { label: 'Umum', items: [{ path: '/', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard' }] },
  {
    label: 'Transaksi',
    icon: ArrowLeftRight,
    items: [
      { path: '/fo', label: 'Front Office', icon: FilePlus2, perm: 'fo', desc: 'Terima desain dan buat order (nota/SPK) dengan harga otomatis dari matriks.' },
      { path: '/kasir', label: 'Kasir', icon: ShoppingCart, perm: 'kasir', desc: 'Terima pembayaran berdasarkan nota/SPK dari Front Office.' },
      { path: '/order', label: 'Order', icon: ClipboardList, perm: 'order', desc: 'Daftar nota, pembayaran berkali-kali, status diambil, dan batal dengan alasan.' },
      { path: '/produksi', label: 'Produksi', icon: Factory, perm: 'produksi', desc: 'Antrian per mesin dengan status Antrian → Proses → Selesai.' },
    ],
  },
  {
    label: 'Keuangan',
    icon: Landmark,
    items: [
      { path: '/piutang', label: 'Piutang', icon: HandCoins, perm: 'piutang', desc: 'Piutang aktif, umur piutang, dan piutang per konsumen.' },
      { path: '/pengeluaran', label: 'Pengeluaran', icon: Receipt, perm: 'pengeluaran', desc: 'Pembelian bahan dan operasional; mengisi riwayat harga beli.' },
      { path: '/hutang', label: 'Hutang Supplier', icon: Truck, perm: 'hutang', desc: 'Tagihan supplier, cicilan, dan jatuh tempo.' },
      { path: '/kas', label: 'Kas', icon: Wallet, perm: 'kas', desc: 'Kas kecil, setoran kasir, dan pencocokan transfer dengan mutasi bank.' },
    ],
  },
  {
    label: 'Operasional',
    icon: Gauge,
    items: [
      { path: '/mesin', label: 'Mesin & Operator', icon: Gauge, perm: 'mesin', desc: 'Counter harian per mesin, reject, dan selisih klik dengan FO.' },
      { path: '/stok', label: 'Stok Bahan', icon: Boxes, perm: 'stok', desc: 'Stok bahan baku, kartu stok, stok opname, dan daftar belanja.' },
      { path: '/pembelian', label: 'Pembelian Bahan', icon: ShoppingBag, perm: 'pembelian', desc: 'Form pembelian bahan; menambah stok dan mencatat pengeluaran/hutang.' },
    ],
  },
  {
    label: 'Master Data',
    icon: Database,
    items: [
      { path: '/master/produk', label: 'Produk & Harga', icon: Package, perm: 'master.produk' },
      { path: '/master/konsumen', label: 'Konsumen', icon: Users, perm: 'master.konsumen' },
      { path: '/master/supplier', label: 'Supplier', icon: Store, perm: 'master.supplier' },
      { path: '/master/mesin', label: 'Mesin', icon: Cog, perm: 'master.mesin' },
      { path: '/master/metode-bayar', label: 'Metode Bayar', icon: CreditCard, perm: 'master.metode' },
    ],
  },
  {
    label: 'Laporan',
    icon: BarChart3,
    items: [
      { path: '/laporan', label: 'Laporan', icon: BarChart3, perm: 'laporan', desc: 'Rekap harian/bulanan, omzet per CS/produk/mesin, dan laba kotor.' },
      { path: '/laporan/laba-rugi', label: 'Laba Rugi', icon: TrendingUp, perm: 'laporan.laba', desc: 'Pendapatan, komponen HPP, beban, dan laba bersih.' },
      { path: '/laporan/buku-besar', label: 'Buku Besar', icon: BookOpen, perm: 'laporan.laba', desc: 'Neraca saldo, buku besar per akun, dan jurnal.' },
      { path: '/laporan/margin', label: 'Margin Produk', icon: Percent, perm: 'laporan.laba', desc: 'HPP per produk dibanding harga jual.' },
    ],
  },
  {
    label: 'Pengaturan',
    icon: Settings,
    items: [
      { path: '/pengaturan/user', label: 'User', icon: UserCog, perm: 'pengaturan.user' },
      { path: '/pengaturan/hak-akses', label: 'Hak Akses', icon: ShieldCheck, perm: 'pengaturan.role' },
      { path: '/pengaturan/perangkat', label: 'Perangkat', icon: MonitorSmartphone, perm: 'pengaturan.perangkat' },
      { path: '/pengaturan/umum', label: 'Umum', icon: SlidersHorizontal, perm: 'pengaturan.umum' },
      { path: '/pengaturan/log', label: 'Log Aktivitas', icon: History, perm: 'pengaturan.log' },
      { path: '/pengaturan/printer', label: 'Printer & Laci', icon: Printer, perm: 'dashboard', desktop: true },
      { path: '/pengaturan/pc', label: 'Aplikasi PC Ini', icon: MonitorCog, perm: 'dashboard', desktop: true },
      { path: '/pengaturan/tentang', label: 'Tentang Aplikasi', icon: Info, perm: 'dashboard' },
    ],
  },
];

export const ALL_ITEMS = MENU.flatMap((g) => g.items);

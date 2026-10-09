import type { PermissionMap, Role } from '@/types';

/** Daftar modul/sub modul yang punya hak akses. Kunci ini juga dipakai Apps Script (lihat apps-script/Permissions.gs). */
export const MODULES: { key: string; label: string; group: string }[] = [
  { key: 'dashboard', label: 'Dashboard', group: 'Umum' },
  { key: 'fo', label: 'Front Office (buat order)', group: 'Transaksi' },
  { key: 'kasir.harga_manual', label: 'Ubah harga di Front Office', group: 'Transaksi' },
  { key: 'kasir', label: 'Kasir (terima pembayaran)', group: 'Transaksi' },
  { key: 'order', label: 'Order', group: 'Transaksi' },
  { key: 'produksi', label: 'Produksi', group: 'Transaksi' },
  { key: 'piutang', label: 'Piutang', group: 'Keuangan' },
  { key: 'pengeluaran', label: 'Pengeluaran', group: 'Keuangan' },
  { key: 'hutang', label: 'Hutang Supplier', group: 'Keuangan' },
  { key: 'kas', label: 'Kas', group: 'Keuangan' },
  { key: 'mesin', label: 'Mesin & Operator', group: 'Operasional' },
  { key: 'master.produk', label: 'Produk & Harga', group: 'Master Data' },
  { key: 'master.harga_beli', label: 'Lihat harga beli', group: 'Master Data' },
  { key: 'master.konsumen', label: 'Konsumen', group: 'Master Data' },
  { key: 'master.supplier', label: 'Supplier', group: 'Master Data' },
  { key: 'master.mesin', label: 'Mesin', group: 'Master Data' },
  { key: 'master.metode', label: 'Metode Bayar', group: 'Master Data' },
  { key: 'laporan', label: 'Laporan', group: 'Laporan' },
  { key: 'laporan.laba', label: 'Laporan laba', group: 'Laporan' },
  { key: 'pengaturan.user', label: 'User', group: 'Pengaturan' },
  { key: 'pengaturan.role', label: 'Hak akses role', group: 'Pengaturan' },
  { key: 'pengaturan.perangkat', label: 'Perangkat', group: 'Pengaturan' },
  { key: 'pengaturan.umum', label: 'Pengaturan umum', group: 'Pengaturan' },
  { key: 'pengaturan.log', label: 'Log aktivitas', group: 'Pengaturan' },
];

export const OPS = ['lihat', 'tambah', 'ubah', 'hapus', 'ekspor'] as const;

const all = { lihat: true, tambah: true, ubah: true, hapus: true, ekspor: true };
const view = { lihat: true };

/** Hak akses awal per role. Bisa diubah owner/admin di Pengaturan → Hak akses role. */
export function defaultPermissions(role: Role): PermissionMap {
  const p: PermissionMap = {};
  MODULES.forEach((m) => (p[m.key] = {}));
  const set = (keys: string[], v: object) => keys.forEach((k) => (p[k] = { ...v }));
  switch (role) {
    case 'owner':
      set(MODULES.map((m) => m.key), all);
      break;
    case 'admin':
      set(MODULES.map((m) => m.key).filter((k) => k !== 'laporan.laba'), all);
      break;
    case 'cs':
      set(['dashboard', 'order', 'produksi', 'master.produk'], view);
      set(['fo'], { lihat: true, tambah: true });
      set(['master.konsumen'], { lihat: true, tambah: true, ubah: true });
      break;
    case 'kasir':
      set(['dashboard', 'produksi', 'master.produk', 'master.konsumen'], view);
      set(['kasir', 'order', 'piutang', 'kas'], { lihat: true, tambah: true, ubah: true, ekspor: true });
      break;
    case 'operator':
      set(['dashboard', 'order'], view);
      set(['produksi', 'mesin'], { lihat: true, tambah: true, ubah: true });
      break;
    case 'keuangan':
      set(['dashboard', 'order', 'piutang', 'master.produk', 'master.harga_beli', 'master.supplier'], { lihat: true, ekspor: true });
      set(['pengeluaran', 'hutang', 'kas', 'laporan'], all);
      break;
  }
  return p;
}

export function can(perms: PermissionMap | undefined, key: string, op: keyof typeof all = 'lihat'): boolean {
  return !!perms?.[key]?.[op];
}

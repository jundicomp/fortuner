import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Material {
  id: string; kode: string; nama: string; satuan: string; kategori: string; stok: number; stok_min: number; harga_rata: number; harga_terakhir: number;
  aktif: boolean; catatan: string; nilai: number; status: 'aman' | 'menipis' | 'habis' | 'nonaktif';
}
export interface StockMeta {
  materials: Material[];
  suppliers: { id: string; nama: string }[];
  payment_methods: { id: string; nama: string; jenis: string }[];
  mode: 'selesai' | 'bayar';
  lihat_harga: boolean;
}
export interface PurchaseItem { id: string; material_id: string; nama: string; satuan: string; qty_beli: number; satuan_beli: string; isi: number; harga_beli: number; subtotal: number; qty_stok: number; harga_stok: number }
export interface Purchase {
  id: string; tanggal: string; nota: string; supplier_id: string; supplier: string; total: number; cara_bayar: 'lunas' | 'hutang'; metode: string; jatuh_tempo: string;
  sisa_hutang: number; keterangan: string; oleh: string; created_at: string; items: PurchaseItem[];
}
export interface StockMove { id: string; tanggal: string; jenis: string; qty: number; harga: number; nilai: number; saldo_berjalan: number; ref_tabel: string; keterangan: string; created_at: string }
export interface Opname {
  id: string; tanggal: string; keterangan: string; jumlah_item: number; nilai_selisih: number; oleh: string; created_at: string;
  items: { id: string; material_id: string; nama: string; satuan: string; stok_sistem: number; stok_fisik: number; selisih: number; harga: number; nilai: number; keterangan: string }[];
}

export const useStockMeta = (enabled = true) => useQuery({ queryKey: ['stock-meta'], queryFn: () => api<StockMeta>('stock.meta'), staleTime: 20e3, enabled });

export const STATUS_STOK: Record<Material['status'], [string, string]> = {
  aman: ['Aman', 'pill-ok'], menipis: ['Menipis', 'pill-warn'], habis: ['Habis', 'pill-bad'], nonaktif: ['Nonaktif', 'pill-mute'],
};
export const JENIS_MOVE: Record<string, string> = { awal: 'Stok awal', beli: 'Pembelian', pakai: 'Pemakaian', opname: 'Opname', batal_beli: 'Hapus pembelian' };

/** Angka desimal gaya Indonesia ("1.250,5") atau biasa ("1250.5"). */
export const numIn = (s: string | number) => {
  const t = String(s ?? '').trim();
  if (!t) return 0;
  if (/,/.test(t)) return Number(t.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, '')) || 0;
  return Number(t.replace(/[^\d.-]/g, '')) || 0;
};
/** Angka dengan desimal bila perlu (stok meter, harga rata-rata). */
export const dec = (n: number | null | undefined, d = 2) => (n == null || isNaN(n) ? '–' : n.toLocaleString('id-ID', { maximumFractionDigits: d }));

/** Usulan belanja: isi sampai 3× batas minimum. */
export const saranBeli = (m: Material) => Math.max(0, Math.ceil(m.stok_min * 3 - m.stok));

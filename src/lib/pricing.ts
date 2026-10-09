import type { JenisHarga, PriceRow } from '@/types';

/** Kolom tier pada price_history, urut sama dengan sheet "Basis data" lama. */
export const TIERS = [
  { key: 'rb', label: 'Reseller · Banyak' },
  { key: 'rb_bb', label: 'Reseller · Banyak BB' },
  { key: 'rs', label: 'Reseller · Sedikit' },
  { key: 'rs_bb', label: 'Reseller · Sedikit BB' },
  { key: 'eb', label: 'End user · Banyak' },
  { key: 'eb_bb', label: 'End user · Banyak BB' },
  { key: 'es', label: 'End user · Sedikit' },
  { key: 'es_bb', label: 'End user · Sedikit BB' },
] as const;
export type TierKey = (typeof TIERS)[number]['key'];

/** Untuk produk cutting, 4 kolom pertama dipakai sebagai harga per ukuran stiker. */
export const CUT_SIZES = ['di atas 5 cm', '3,1 – 5 cm', '2 – 3 cm', 'di bawah 2 cm'] as const;
export const CUT_KEYS: TierKey[] = ['rb', 'rb_bb', 'rs', 'rs_bb'];

export const JENIS_HARGA: { value: JenisHarga; label: string; hint: string }[] = [
  { value: 'matriks', label: 'Matriks 8 tier', hint: 'Reseller/End user × Banyak/Sedikit × 1 sisi/BB' },
  { value: 'cutting', label: 'Cutting per ukuran', hint: '4 harga sesuai ukuran stiker' },
  { value: 'tetap', label: 'Harga tetap', hint: 'Satu harga untuk semua konsumen' },
  { value: 'manual', label: 'Manual', hint: 'Harga diisi CS saat transaksi' },
];

export interface PriceInput {
  jenis: JenisHarga;
  harga: PriceRow | null | undefined;
  tipe: 'reseller' | 'enduser';
  qty: number;
  sisi: 1 | 2;
  ukuran?: number; // index CUT_SIZES
  minQtyBanyak: number; // default 26
}
export interface PriceResult { harga: number | null; tier: TierKey | null; label: string; peringatan?: string }

/** Logika pemilihan harga. Versi yang sama ada di apps-script/Pricing.gs — ubah keduanya bersamaan. */
export function hitungHarga(i: PriceInput): PriceResult {
  const h = i.harga;
  if (i.jenis === 'manual') return { harga: null, tier: null, label: 'Harga manual' };
  if (!h) return { harga: null, tier: null, label: 'Belum ada harga', peringatan: 'Produk ini belum punya harga yang berlaku.' };
  if (i.jenis === 'tetap') return { harga: h.rb, tier: 'rb', label: 'Harga tetap' };
  if (i.jenis === 'cutting') {
    const k = CUT_KEYS[i.ukuran ?? 0];
    return { harga: h[k], tier: k, label: `Cutting · ${CUT_SIZES[i.ukuran ?? 0]}` };
  }
  const banyak = i.qty >= i.minQtyBanyak;
  let fallback = false;
  let base: TierKey = (`${i.tipe === 'enduser' ? 'e' : 'r'}${banyak ? 'b' : 's'}`) as TierKey;
  if (i.tipe === 'enduser' && h[base] == null) { base = (`r${banyak ? 'b' : 's'}`) as TierKey; fallback = true; }
  let tier: TierKey = base;
  if (i.sisi === 2 && h[(base + '_bb') as TierKey] != null) tier = (base + '_bb') as TierKey;
  const label = `${base.startsWith('e') ? 'End user' : 'Reseller'} · ${banyak ? `Banyak (≥${i.minQtyBanyak})` : 'Sedikit'}${tier.endsWith('_bb') ? ' · BB' : ''}`;
  return {
    harga: h[tier],
    tier,
    label,
    peringatan: fallback ? 'Harga end user kosong, memakai harga reseller.' : i.sisi === 2 && !tier.endsWith('_bb') ? 'Tidak ada harga BB, memakai harga 1 sisi.' : undefined,
  };
}

/** Pilih baris harga yang berlaku pada tanggal tertentu (YYYY-MM-DD). */
export function hargaBerlaku(rows: PriceRow[], tanggal: string): PriceRow | null {
  const ok = rows.filter((r) => r.berlaku_mulai <= tanggal && (!r.berlaku_sampai || r.berlaku_sampai >= tanggal));
  ok.sort((a, b) => b.berlaku_mulai.localeCompare(a.berlaku_mulai));
  return ok[0] || null;
}

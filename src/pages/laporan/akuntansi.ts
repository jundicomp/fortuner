export interface Account { kode: string; nama: string; tipe: 'aset' | 'kewajiban' | 'modal' | 'pendapatan' | 'hpp' | 'beban' }
export interface PnlRow { kode: string; nama: string; nilai: number }
export interface Pnl {
  pendapatan: number; pendapatan_lain: number; hpp: PnlRow[]; total_hpp: number; laba_kotor: number; beban: PnlRow[]; total_beban: number; laba_bersih: number;
}
export interface PnlReport {
  from: string; to: string; sekarang: Pnl; sebelumnya: Pnl & { from: string; to: string };
  belum_hpp: { item: number; nilai_jual: number }; tagihan_klik: number;
}
export interface TrialRow { kode: string; nama: string; tipe: Account['tipe']; saldo_awal: number; debit: number; kredit: number; saldo_akhir: number }
export interface JEntry { tanggal: string; ref: string; sumber: string; keterangan: string; lines: { akun: string; d: number; k: number }[] }

export const TIPE: Record<Account['tipe'], string> = { aset: 'Aset', kewajiban: 'Kewajiban', modal: 'Modal', pendapatan: 'Pendapatan', hpp: 'HPP', beban: 'Beban' };
export const SUMBER: Record<string, string> = { nota: 'Nota', pembayaran: 'Pembayaran', stok: 'Stok', pembelian: 'Pembelian', pengeluaran: 'Pengeluaran', hutang: 'Bayar hutang', 'kas kecil': 'Kas kecil', kas: 'Tutup kas', manual: 'Jurnal manual' };
/** "1100:pay_abc" → "1100" (akun kas per metode bayar memakai kode induk 1100). */
export const kodeTampil = (k: string) => k.split(':')[0];
export const persen = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1).replace('.', ',')}%` : '–');

/** Helper teks nota tanpa React, dipakai layar (ReceiptBody) dan printer thermal (escpos). */
export interface ShopFooter { catatan?: string; footer_spk?: string; footer_kwitansi?: string }

/** Footer sesuai jenis nota (Pengaturan → Nota & SPK); bila belum diatur, pakai catatan struk lama. */
export function footerOf(d: { jenis?: string }, shop: ShopFooter) {
  const f = d.jenis === 'kwitansi' ? shop.footer_kwitansi : shop.footer_spk;
  return (f && f.trim() ? f : shop.catatan || '').trim();
}
/** 4 digit terakhir nomor nota (FT-K1-1026-0038 → 0038), untuk blok nomor besar. */
export const no4 = (nomor: string) => { const m = /(\d+)\D*$/.exec(nomor || ''); return m ? m[1].slice(-4).padStart(4, '0') : nomor; };

const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
function eja(n: number): string {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${eja(n - 10)} belas`;
  if (n < 100) return `${eja(Math.floor(n / 10))} puluh ${eja(n % 10)}`;
  if (n < 200) return `seratus ${eja(n - 100)}`;
  if (n < 1000) return `${eja(Math.floor(n / 100))} ratus ${eja(n % 100)}`;
  if (n < 2000) return `seribu ${eja(n - 1000)}`;
  if (n < 1e6) return `${eja(Math.floor(n / 1000))} ribu ${eja(n % 1000)}`;
  if (n < 1e9) return `${eja(Math.floor(n / 1e6))} juta ${eja(n % 1e6)}`;
  if (n < 1e12) return `${eja(Math.floor(n / 1e9))} miliar ${eja(n % 1e9)}`;
  return `${eja(Math.floor(n / 1e12))} triliun ${eja(n % 1e12)}`;
}
/** 433500 → "empat ratus tiga puluh tiga ribu lima ratus rupiah" */
export const terbilang = (n: number) => {
  const v = Math.round(Math.abs(n || 0));
  return `${v === 0 ? 'nol' : eja(v)} rupiah`.replace(/\s+/g, ' ').trim();
};

/** Keterangan cara bayar di bawah cap LUNAS/DP: "via TUNAI (Cash)", "via TRANSFER BANK BCA", "via EDC MANDIRI". */
export function viaLabel(nama?: string, jenis?: string) {
  const n = String(nama || '').trim();
  if (jenis === 'tunai' || /tunai|cash/i.test(n)) return 'via TUNAI (Cash)';
  if (jenis === 'transfer' || /transfer/i.test(n)) return `via TRANSFER BANK ${n.replace(/transfer|bank/gi, '').trim().toUpperCase()}`.trim();
  if (jenis === 'edc' || /edc/i.test(n)) return `via ${/edc/i.test(n) ? n.toUpperCase() : `EDC ${n.toUpperCase()}`}`;
  return n ? `via ${n.toUpperCase()}` : '';
}

/** Status cap nota/kwitansi dari sisa & yang sudah dibayar. */
export function statusOf(sisa: number, terbayar: number): 'LUNAS' | 'DP' | 'BELUM DIBAYAR' {
  return sisa <= 0 ? 'LUNAS' : terbayar > 0 ? 'DP' : 'BELUM DIBAYAR';
}

/** "Untuk pembayaran" di kwitansi. ke = pembayaran ke-berapa untuk nota ini. */
export function untukLabel(ke: number, sisaSetelah: number, sebelumnya: number) {
  if (sisaSetelah <= 0) return sebelumnya > 0 ? 'Pelunasan Nota/SPK' : 'Pembayaran lunas Nota/SPK';
  return ke <= 1 ? 'Uang muka (DP) Nota/SPK' : `Angsuran ke-${ke} Nota/SPK`;
}

export const KEEP_NOTE = 'Simpan dan satukan struk ini jika diperlukan';
export const SAH_NOTE = 'Pembayaran sah jika ada KWITANSI';

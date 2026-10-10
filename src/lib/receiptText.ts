/** Helper teks nota tanpa React, dipakai layar (ReceiptBody) dan printer thermal (escpos). */
export interface ShopFooter { catatan?: string; footer_spk?: string; footer_kwitansi?: string }

/** Footer sesuai jenis nota (Pengaturan → Nota & SPK); bila belum diatur, pakai catatan struk lama. */
export function footerOf(d: { jenis?: string }, shop: ShopFooter) {
  const f = d.jenis === 'kwitansi' ? shop.footer_kwitansi : shop.footer_spk;
  return (f && f.trim() ? f : shop.catatan || '').trim();
}
/** 4 digit terakhir nomor nota (FT-K1-1026-0038 → 0038), untuk blok nomor besar. */
export const no4 = (nomor: string) => { const m = /(\d+)\D*$/.exec(nomor || ''); return m ? m[1].slice(-4).padStart(4, '0') : nomor; };

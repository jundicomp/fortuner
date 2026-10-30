import { no4 } from './receiptText';

/** Kode jenis konsumen yang tercetak di nota/kwitansi: 01 = Percetakan (harga reseller), 02 = End user. */
export const KODE_JENIS: Record<string, string> = { reseller: '01', enduser: '02' };
export const kodeJenis = (tipe?: string) => (tipe === 'reseller' ? '01' : tipe === 'enduser' || tipe === 'end user' ? '02' : /^\d\d$/.test(tipe || '') ? tipe! : '');
export const namaJenis = (tipe?: string) => (tipe === 'reseller' ? 'Percetakan' : 'End user');
/** "01 · Percetakan" / "02 · End user" untuk tabel, form, dan laporan. */
export const jenisLabel = (tipe?: string) => `${kodeJenis(tipe) || '02'} · ${namaJenis(tipe)}`;
/** Nomor pendek 6 digit di nota/kwitansi & antrian kasir: kode jenis + 4 digit nomor urut, mis. 020001. */
export const noPendek = (nomor: string, tipe?: string) => `${kodeJenis(tipe)}${no4(nomor)}`;

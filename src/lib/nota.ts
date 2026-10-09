/** Format & counter nomor nota di perangkat. Format sama dengan server: FT-K1-1026-0001. */
export const counterKey = (kode: string, ymd: string) => `nota-${kode}-${ymd.slice(0, 7)}`;
export const formatNota = (prefix: string, kode: string, ymd: string, n: number) => `${prefix || 'FT'}-${kode}-${ymd.slice(5, 7)}${ymd.slice(2, 4)}-${String(n).padStart(4, '0')}`;

const LS = (k: string) => 'fortuner-counter:' + k;
const read = (k: string) => { try { return Number(localStorage.getItem(LS(k)) || 0); } catch { return 0; } };

/** Nomor berikutnya = lebih besar dari counter lokal maupun counter server terakhir yang diketahui. Belum dipakai sampai commit(). */
export function peekNo(key: string, serverValue: number) { return Math.max(read(key), serverValue || 0) + 1; }
export function commitNo(key: string, n: number) { try { if (n > read(key)) localStorage.setItem(LS(key), String(n)); } catch { /* abaikan */ } }

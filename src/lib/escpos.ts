/**
 * Penyusun perintah ESC/POS untuk printer thermal 58/80 mm (hampir semua printer kasir).
 * Hasilnya array byte yang dikirim mentah ke printer (USB lewat spooler Windows, atau LAN port 9100).
 * Tidak bergantung pada browser/Tauri supaya bisa diuji di Node.
 */
import { CUT_SIZES } from './pricing';
import type { ReceiptData, ReceiptShop } from '@/components/Receipt';

const ESC = 0x1b, GS = 0x1d;

/** Printer thermal memakai code page ASCII/PC437: ganti huruf & simbol non-ASCII dengan padanan sederhana. */
export function toAscii(s: string): string {
  return String(s ?? '')
    .replace(/[–—−]/g, '-').replace(/[·•]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/→/g, '>').replace(/×/g, 'x').replace(/…/g, '...').replace(/ /g, ' ')
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^\x20-\x7e\n]/g, '?');
}

/** Pecah teks panjang jadi beberapa baris selebar `w` (memotong di spasi bila bisa). */
export function wrap(text: string, w: number): string[] {
  const out: string[] = [];
  toAscii(text).split('\n').forEach((para) => {
    let line = '';
    para.split(' ').forEach((word) => {
      while (word.length > w) { if (line) { out.push(line); line = ''; } out.push(word.slice(0, w)); word = word.slice(w); }
      if (!line) line = word;
      else if ((line + ' ' + word).length <= w) line += ' ' + word;
      else { out.push(line); line = word; }
    });
    out.push(line);
  });
  return out;
}

/** Kiri-kanan dalam satu baris; kalau tidak muat, bagian kiri dibungkus dan angka kanan di baris terakhir. */
export function lr(left: string, right: string, w: number): string[] {
  const l = toAscii(left), r = toAscii(right);
  if (l.length + r.length + 1 <= w) return [l + ' '.repeat(w - l.length - r.length) + r];
  const lines = wrap(l, w);
  const last = lines[lines.length - 1];
  if (last.length + r.length + 1 <= w) lines[lines.length - 1] = last + ' '.repeat(w - last.length - r.length) + r;
  else lines.push(' '.repeat(Math.max(0, w - r.length)) + r);
  return lines;
}

export class EscPos {
  private b: number[] = [];
  constructor(public cols: number) { this.raw(ESC, 0x40); /* init */ this.raw(ESC, 0x74, 0); /* code page PC437 */ }
  raw(...bytes: number[]) { this.b.push(...bytes); return this; }
  private bytesOf(s: string) { for (let i = 0; i < s.length; i++) this.b.push(s.charCodeAt(i) & 0x7f); }
  align(a: 'left' | 'center' | 'right') { return this.raw(ESC, 0x61, a === 'left' ? 0 : a === 'center' ? 1 : 2); }
  bold(on: boolean) { return this.raw(ESC, 0x45, on ? 1 : 0); }
  /** 0 = normal, 1 = tinggi 2x, 2 = lebar & tinggi 2x */
  size(n: 0 | 1 | 2) { return this.raw(GS, 0x21, n === 0 ? 0x00 : n === 1 ? 0x01 : 0x11); }
  line(s = '') { this.bytesOf(toAscii(s)); return this.raw(0x0a); }
  lines(ls: string[]) { ls.forEach((l) => this.line(l)); return this; }
  text(s: string) { return this.lines(wrap(s, this.cols)); }
  /** Teks besar (lebar 2x): kolom efektif setengahnya. */
  bigText(s: string) { this.size(2); wrap(s, Math.floor(this.cols / 2)).forEach((l) => this.line(l)); return this.size(0); }
  row(l: string, r: string) { return r ? this.lines(lr(l, r, this.cols)) : this.text(l); }
  hr(ch = '-') { return this.line(ch.repeat(this.cols)); }
  feed(n = 1) { return this.raw(ESC, 0x64, Math.max(0, Math.min(255, n))); }
  /** Barcode CODE128 (subset B) dengan teks di bawahnya, untuk discan kasir. */
  barcode(data: string, narrow = false) {
    const d = toAscii(data).slice(0, 40);
    this.align('center').raw(GS, 0x68, 60).raw(GS, 0x77, narrow ? 1 : 2).raw(GS, 0x48, 2).raw(GS, 0x66, 0);
    this.raw(GS, 0x6b, 73, d.length + 2, 0x7b, 0x42); this.bytesOf(d);
    return this.raw(0x0a).align('left');
  }
  /** Potong kertas (partial cut) setelah mengumpan sedikit. */
  cut() { return this.feed(3).raw(GS, 0x56, 0x42, 0x00); }
  /** Pulsa ke pin 2 konektor laci (RJ11 lewat printer). */
  drawer() { return this.raw(ESC, 0x70, 0x00, 0x19, 0xfa); }
  bytes() { return Uint8Array.from(this.b); }
}

export const nfi = (n: number | null | undefined) => (n == null || isNaN(n as number) ? '-' : Math.round(n).toLocaleString('id-ID'));
const tglJamS = (s?: string) => {
  if (!s) return '-';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export interface EscOptions { cols: number; drawer?: boolean; cut?: boolean; barcode?: boolean }

/** Susun SPK/kwitansi dengan isi yang sama seperti pratinjau di layar (ReceiptBody). */
export function receiptEscPos(d: ReceiptData, shop: ReceiptShop, o: EscOptions): Uint8Array {
  const p = new EscPos(o.cols);
  const narrow = o.cols < 40;
  if (o.drawer) p.drawer();
  p.align('center').bold(true);
  if (narrow) p.text(shop.nama); else p.bigText(shop.nama);
  p.bold(false);
  if (shop.alamat) p.text(shop.alamat);
  if (shop.telp) p.text('Telp/WA ' + shop.telp);
  p.align('left').hr();
  if (d.jenis === 'spk') p.align('center').bold(true).line('NOTA / SPK').bold(false).align('left');
  if (d.jenis === 'kwitansi') p.align('center').bold(true).line('KWITANSI PEMBAYARAN').bold(false).align('left');
  p.bold(true).row(d.nomor, d.ulang ? 'CETAK ULANG' : '').bold(false);
  p.row(tglJamS(d.waktu), 'CS ' + d.cs);
  p.text('Kepada: ' + d.customer);
  if (d.offline) p.bold(true).line('* Dibuat saat offline').bold(false);
  if (d.janji_selesai) p.text('Selesai: ' + tglJamS(d.janji_selesai));
  if (d.jenis === 'spk' && d.desain) p.text('File: ' + d.desain);
  p.hr();
  d.items.forEach((it) => {
    p.bold(true).text(it.nama + (it.sisi === 2 ? ' (BB)' : '') + (it.ukuran != null ? ' - ' + CUT_SIZES[it.ukuran] : '')).bold(false);
    if (it.keterangan) p.lines(wrap(it.keterangan, o.cols - 2).map((l) => '  ' + l));
    p.row(`  ${nfi(it.qty)} x ${nfi(it.harga)}`, nfi(it.subtotal));
  });
  p.hr();
  p.bold(true);
  if (narrow) p.row('TOTAL', nfi(d.total)); else { p.size(1).row('TOTAL', nfi(d.total)).size(0); }
  p.bold(false);
  if (d.sebelumnya != null && d.sebelumnya > 0) p.row('Dibayar sebelumnya', nfi(d.sebelumnya));
  d.payments.forEach((x) => p.row(x.label, nfi(x.nominal)));
  if (d.diterima != null && d.diterima > 0) p.row('Tunai diterima', nfi(d.diterima));
  if (d.kembalian != null && d.kembalian > 0) p.bold(true).row('Kembalian', nfi(d.kembalian)).bold(false);
  if (d.jenis === 'spk') p.align('center').bold(true).text('BELUM DIBAYAR - SILAKAN KE KASIR').bold(false).align('left');
  else p.bold(true).row(d.sisa > 0 ? 'SISA TAGIHAN' : 'STATUS', d.sisa > 0 ? nfi(d.sisa) : 'LUNAS').bold(false);
  if (d.catatan) { p.hr(); p.text('Catatan: ' + d.catatan); }
  p.hr();
  if (o.barcode !== false && d.jenis === 'spk') p.barcode(d.nomor, narrow);
  if (shop.catatan) p.align('center').text(shop.catatan).align('left');
  if (o.cut !== false) p.cut(); else p.feed(4);
  return p.bytes();
}

/** Struk tes dari halaman Printer & Laci. */
export function testEscPos(o: EscOptions & { printer: string; shop: string }): Uint8Array {
  const p = new EscPos(o.cols);
  if (o.drawer) p.drawer();
  p.align('center').bold(true).line('TES PRINTER').bold(false).line(o.shop).align('left').hr();
  p.row('Printer', o.printer).row('Lebar', `${o.cols} karakter`).row('Waktu', tglJamS(new Date().toISOString()));
  p.hr().line('1234567890'.repeat(Math.ceil(o.cols / 10)).slice(0, o.cols)).row('Kiri', 'Kanan').hr();
  p.align('center').text('Kalau baris angka di atas pas satu baris, lebar kertas sudah benar.').align('left');
  p.barcode('FT-K1-TES', o.cols < 40);
  p.cut();
  return p.bytes();
}

/** Hanya buka laci (tanpa mencetak). */
export const drawerOnly = () => Uint8Array.from([ESC, 0x40, ESC, 0x70, 0x00, 0x19, 0xfa]);

/** Ubah byte ESC/POS kembali jadi teks polos (untuk printer virtual di mode simulasi & pengujian). */
export function escposToText(bytes: Uint8Array): { text: string; drawer: boolean; cut: boolean } {
  let text = '', drawer = false, cut = false;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === ESC) {
      const c = bytes[i + 1];
      if (c === 0x40) i += 1; else if (c === 0x70) { drawer = true; i += 4; } else if (c === 0x64) { text += '\n'.repeat(Math.min(3, bytes[i + 2])); i += 2; } else i += 2;
    } else if (b === GS) {
      const c = bytes[i + 1];
      if (c === 0x56) { cut = true; i += 3; } else if (c === 0x6b) { const n = bytes[i + 3]; const s = String.fromCharCode(...bytes.slice(i + 6, i + 4 + n)); text += `|||| ${s} ||||`; i += 3 + n; } else i += 2;
    } else if (b === 0x0a) text += '\n';
    else text += String.fromCharCode(b);
  }
  return { text, drawer, cut };
}

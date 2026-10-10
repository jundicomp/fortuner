/**
 * Bagikan nota ke konsumen: simpan gambar JPEG, salin ke clipboard, dan buka chat WhatsApp ke nomor konsumen.
 *
 * Link WhatsApp (wa.me) hanya bisa membawa teks, tidak bisa melampirkan gambar. Karena itu gambar nota disalin ke
 * clipboard (tinggal Ctrl+V di chat) dan juga disimpan sebagai file JPEG. Di HP, menu Bagikan bawaan dipakai bila
 * tersedia sehingga gambar langsung terkirim ke WhatsApp.
 */
import { invoke, isTauri } from '@/platform/desktop';
import type { ReceiptData, ReceiptShop } from '@/components/Receipt';
import { nf } from './format';

const OPTS = { backgroundColor: '#ffffff', pixelRatio: 2, cacheBust: false } as const;

/** Nomor Indonesia → format internasional tanpa +: 0896… / +62896… / 896… → 62896…  Kosong bila tidak valid. */
export function waNumber(telp?: string | null): string {
  let d = String(telp || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return d.length >= 10 && d.length <= 15 ? d : '';
}

export const DEFAULT_WA = {
  spk: 'Halo {nama}, terima kasih sudah order di {usaha}.\nBerikut nota/SPK {nomor} dengan total Rp {total}. Pembayaran dilakukan di kasir.',
  kwitansi: 'Halo {nama}, terima kasih.\nBerikut kwitansi pembayaran nota {nomor}: dibayar Rp {bayar}, {status}.',
};

/** Isi pesan WhatsApp dari template pengaturan ({nama} {nomor} {total} {bayar} {sisa} {status} {usaha}). */
export function waMessage(d: ReceiptData, shop: ReceiptShop, template?: string) {
  const t = (template && template.trim()) || (d.jenis === 'kwitansi' ? DEFAULT_WA.kwitansi : DEFAULT_WA.spk);
  const bayar = d.payments.reduce((a, p) => a + p.nominal, 0);
  const vars: Record<string, string> = {
    nama: d.customer, nomor: d.nomor, total: nf(d.total), bayar: nf(bayar), sisa: nf(d.sisa), usaha: shop.nama,
    status: d.sisa > 0 ? `sisa tagihan Rp ${nf(d.sisa)}` : 'LUNAS',
  };
  return t.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

async function render(node: HTMLElement) {
  const h = await import('html-to-image');
  const opts = { ...OPTS, width: node.scrollWidth, height: node.scrollHeight };
  const [jpeg, png] = await Promise.all([h.toJpeg(node, { ...opts, quality: 0.95 }), h.toBlob(node, opts)]);
  return { jpeg, png };
}

const dataUrlBytes = (u: string) => Uint8Array.from(atob(u.split(',')[1]), (c) => c.charCodeAt(0));
const fileName = (d: ReceiptData) => `${d.jenis === 'kwitansi' ? 'Kwitansi' : 'Nota'} ${d.nomor}.jpg`;

/** Simpan JPEG: browser = unduhan biasa; aplikasi PC = folder Downloads. Mengembalikan lokasi file (PC) atau nama file. */
async function saveJpeg(jpeg: string, name: string): Promise<string> {
  if (isTauri) return invoke<string>('save_download', { name, data: Array.from(dataUrlBytes(jpeg)) });
  const a = document.createElement('a');
  a.href = jpeg; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  return name;
}

async function copyPng(png: Blob | null) {
  if (!png || typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;
  try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]); return true; } catch { return false; }
}

function openUrl(url: string) {
  if (isTauri) return invoke('open_path', { path: url, reveal: false }).then(() => undefined);
  window.open(url, '_blank', 'noopener');
  return Promise.resolve();
}

/** Tombol "Simpan gambar (JPEG)". */
export async function saveReceiptImage(node: HTMLElement, d: ReceiptData) {
  const { jpeg } = await render(node);
  const path = await saveJpeg(jpeg, fileName(d));
  if (isTauri) { try { await invoke('open_path', { path, reveal: true }); } catch { /* file tetap tersimpan */ } }
  return path;
}

export interface WaResult { mode: 'share' | 'link'; copied: boolean; saved: string }

/**
 * Tombol "Kirim ke WhatsApp".
 * HP: menu Bagikan bawaan (gambar + pesan langsung ke WhatsApp).
 * PC / browser: simpan JPEG + salin gambar ke clipboard, lalu buka chat WhatsApp ke nomor konsumen dengan pesan siap kirim.
 */
export async function shareReceiptWa(node: HTMLElement, d: ReceiptData, shop: ReceiptShop, template?: string): Promise<WaResult> {
  const no = waNumber(d.telp);
  if (!no) throw new Error('Nomor WhatsApp konsumen belum diisi di data konsumen.');
  const text = waMessage(d, shop, template);
  const { jpeg, png } = await render(node);
  const name = fileName(d);
  const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  if (!isTauri && touch && typeof navigator.canShare === 'function') {
    const file = new File([dataUrlBytes(jpeg)], name, { type: 'image/jpeg' });
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text }); return { mode: 'share', copied: false, saved: '' }; }
      catch (e) { if ((e as Error).name === 'AbortError') return { mode: 'share', copied: false, saved: '' }; }
    }
  }
  const copied = await copyPng(png);
  const saved = await saveJpeg(jpeg, name);
  await openUrl(`https://wa.me/${no}?text=${encodeURIComponent(text)}`);
  return { mode: 'link', copied, saved };
}

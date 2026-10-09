/**
 * Pengaturan printer struk & laci per PC (disimpan di PC itu sendiri, bukan di server),
 * dan fungsi cetak langsung ESC/POS untuk aplikasi desktop.
 */
import { drawerOnly, receiptEscPos, testEscPos } from '@/lib/escpos';
import type { ReceiptData, ReceiptShop } from '@/components/Receipt';
import { invoke, isDesktop } from './desktop';

export interface PrinterSettings {
  koneksi: 'usb' | 'lan';
  printer: string;          // nama printer Windows (USB)
  host: string;             // IP printer LAN
  port: number;
  lebar: 58 | 80;
  kolom: number;            // karakter per baris (0 = otomatis: 32 / 48)
  salinan_spk: number;
  salinan_kwitansi: number;
  barcode: boolean;         // barcode nomor nota di SPK
  potong: boolean;          // potong kertas otomatis
  laci: boolean;            // PC ini memakai laci
  laci_tunai: boolean;      // buka otomatis saat pembayaran tunai
  laci_manual: boolean;     // tampilkan tombol "Buka laci"
}
const KEY = 'fortuner-printer';
export const DEFAULT_PRINTER: PrinterSettings = {
  koneksi: 'usb', printer: '', host: '', port: 9100, lebar: 80, kolom: 0, salinan_spk: 1, salinan_kwitansi: 1, barcode: true, potong: true,
  laci: false, laci_tunai: true, laci_manual: false,
};
const listeners = new Set<() => void>();
export const printerSettings = {
  get: (): PrinterSettings => { try { return { ...DEFAULT_PRINTER, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULT_PRINTER }; } },
  set: (s: PrinterSettings) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* abaikan */ } listeners.forEach((f) => f()); },
  subscribe: (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; },
};

export const colsOf = (s: PrinterSettings) => s.kolom > 0 ? s.kolom : s.lebar === 58 ? 32 : 48;
/** Printer sudah diatur dan bisa dipakai untuk cetak langsung. */
export const directReady = (s = printerSettings.get()) => isDesktop() && (s.koneksi === 'usb' ? !!s.printer : !!s.host);
/** Lebar kertas yang dipakai pratinjau: pengaturan PC ini (desktop) atau pengaturan perangkat di server (web). */
export const paperWidth = (serverDefault?: string | null): 58 | 80 => (directReady() ? printerSettings.get().lebar : serverDefault === '58' ? 58 : 80);

async function send(data: Uint8Array, s = printerSettings.get()) {
  const arr = Array.from(data);
  if (s.koneksi === 'lan') await invoke('print_tcp', { host: s.host.trim(), port: Number(s.port) || 9100, data: arr });
  else await invoke('print_raw', { printer: s.printer, data: arr });
}

export interface DirectOpts { drawer?: boolean }
/** Cetak SPK/kwitansi langsung ke printer. Laci dibuka sekali (di salinan pertama). */
export async function printDirect(d: ReceiptData, shop: ReceiptShop, o: DirectOpts = {}) {
  const s = printerSettings.get();
  const copies = Math.max(1, Math.min(3, d.jenis === 'spk' ? s.salinan_spk : s.salinan_kwitansi));
  for (let i = 0; i < copies; i++) {
    await send(receiptEscPos(d, shop, { cols: colsOf(s), drawer: i === 0 && !!o.drawer && s.laci && s.laci_tunai, cut: s.potong, barcode: s.barcode }), s);
  }
}
export async function openDrawer(s = printerSettings.get()) {
  if (!s.laci) throw new Error('Laci belum diaktifkan di PC ini.');
  await send(drawerOnly(), s);
}
export async function testPrint(shop: string, s = printerSettings.get(), drawer = false) {
  await send(testEscPos({ cols: colsOf(s), printer: s.koneksi === 'lan' ? `${s.host}:${s.port}` : s.printer, shop, drawer: drawer && s.laci, cut: s.potong }), s);
}
export const listPrinters = () => invoke<string[]>('list_printers');

/** Buka laci untuk pembayaran tunai tanpa mencetak (kalau cetak otomatis dimatikan). Gagal diam-diam: uang tetap bisa diterima. */
export function drawerForCash() {
  const s = printerSettings.get();
  if (!directReady(s) || !s.laci || !s.laci_tunai) return;
  void openDrawer().catch(() => { /* abaikan */ });
}

import { createPortal } from 'react-dom';
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, Printer, TriangleAlert, X } from 'lucide-react';
import { directReady, printDirect, printerSettings } from '@/platform/printer';
import { nf, tglJam } from '@/lib/format';
import { CUT_SIZES } from '@/lib/pricing';
import { footerOf, KEEP_NOTE, no4, SAH_NOTE, statusOf, terbilang, untukLabel, viaLabel } from '@/lib/receiptText';
import { code128 } from '@/lib/code128';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-800.css';
import '@fontsource/inter/latin-900.css';

export interface ReceiptData {
  nomor: string;
  waktu: string;
  customer: string;
  cs: string;
  items: { nama: string; keterangan?: string; qty: number; sisi?: number; ukuran?: number | null; harga: number; subtotal: number; manual?: boolean }[];
  total: number;
  payments: { label: string; nominal: number }[];
  sisa: number;
  diterima?: number;   // uang tunai diterima (untuk kembalian)
  kembalian?: number;
  offline?: boolean;
  catatan?: string;    // nota: catatan FO · kwitansi: no. referensi transfer
  ulang?: boolean;     // cetak ulang
  jenis?: 'spk' | 'kwitansi' | 'struk'; // spk = Nota/SPK dari FO (rincian); kwitansi = bukti uang diterima kasir
  desain?: string;
  janji_selesai?: string;
  sebelumnya?: number; // sudah dibayar sebelum pembayaran ini (kwitansi)
  tipe?: string;       // tipe harga konsumen: "End user" / "Reseller"
  telp?: string;       // telepon/WA konsumen
  csLabel?: string;    // label petugas; bawaan: Kasir (kwitansi) / FO (nota)
  // kwitansi
  kw_no?: string;      // KW-0038-1
  ke?: number;         // pembayaran ke-berapa untuk nota ini
  metode?: string;     // nama metode bayar (Tunai, BCA Transfer, …)
  metode_jenis?: string;
  item_count?: number;
}
export interface ReceiptShop { nama: string; alamat?: string; telp?: string; catatan?: string; footer_spk?: string; footer_kwitansi?: string }

/** Identitas & footer nota dari pengaturan (Pengaturan → Nota & SPK). */
export function shopOf(s?: Record<string, string> | null): ReceiptShop {
  return { nama: s?.nama_usaha || 'Fortuner', alamat: s?.alamat, telp: s?.telp, catatan: s?.catatan_struk, footer_spk: s?.footer_spk, footer_kwitansi: s?.footer_kwitansi };
}
export { footerOf, no4 };
export const tipeLabel = (t?: string) => (t === 'reseller' ? 'Reseller' : t === 'enduser' || t === 'end user' ? 'End user' : t || '');
/** Nominal pembayaran yang dicatat kwitansi ini. */
export const bayarOf = (d: ReceiptData) => d.payments.reduce((a, p) => a + p.nominal, 0);

/**
 * Isi struk; dipakai untuk pratinjau di layar, cetak lewat jendela print, dan gambar JPEG untuk WhatsApp.
 * Nota/SPK = rincian pekerjaan. Kwitansi = bukti uang diterima (tanpa rincian item, merujuk ke nota).
 * Huruf Inter tebal & hitam pekat (tanpa abu-abu) supaya tidak kabur di printer thermal.
 */
export function ReceiptBody({ d, shop, width = 80 }: { d: ReceiptData; shop: ReceiptShop; width?: 58 | 80 }) {
  return (
    <div className={`rc ${width === 58 ? 'rc-58' : ''}`}>
      <div className="rc-top">
        <div className="min-w-0">
          <div className="rc-shop">{shop.nama}</div>
          {shop.alamat && <div className="rc-small">{shop.alamat}</div>}
          {shop.telp && <div className="rc-small">Telp/WA {shop.telp}</div>}
        </div>
        <div className="rc-no receipt-no">{no4(d.nomor)}</div>
      </div>
      <div className="rc-hr2" />
      {d.jenis === 'kwitansi' ? <KwitansiPart d={d} /> : <NotaPart d={d} />}
      <div className="rc-keep">{KEEP_NOTE}</div>
      {footerOf(d, shop) && <><div className="rc-hr" /><div className="rc-foot">{footerOf(d, shop)}</div></>}
    </div>
  );
}

function Kv({ rows }: { rows: [string, ReactNode][] }) {
  return <div className="rc-kv">{rows.map(([k, v]) => <Fragment key={k}><span>{k}</span><span>:</span><b>{v}</b></Fragment>)}</div>;
}
const R = ({ l, r, b }: { l: ReactNode; r: ReactNode; b?: boolean }) => <div className={`rc-row ${b ? 'rc-b' : ''}`}><span>{l}</span><span>{r}</span></div>;

function NotaPart({ d }: { d: ReceiptData }) {
  const terbayar = bayarOf(d);
  const st = statusOf(d.sisa, terbayar);
  const rows: [string, ReactNode][] = [['Nama pelanggan', <>{d.customer}{d.tipe ? ` (${d.tipe})` : ''}</>]];
  if (d.telp && d.telp !== '-') rows.push(['No WA', d.telp]);
  if (d.janji_selesai) rows.push(['Target selesai', tglJam(d.janji_selesai)]);
  if (d.desain) rows.push(['Sumber', d.desain]);
  if (d.catatan) rows.push(['Catatan', d.catatan]);
  return (
    <>
      <div className="rc-title">NOTA / SPK</div>
      <div className="rc-sub">{d.nomor} · {tglJam(d.waktu)}{d.cs ? ` · ${d.csLabel || 'FO'} ${d.cs}` : ''}</div>
      {d.ulang && <div className="rc-sub rc-b">CETAK ULANG</div>}
      {d.offline && <div className="rc-sub rc-b">* Dibuat saat offline</div>}
      <div className="rc-hr" />
      <Kv rows={rows} />
      <div className="rc-dbl" />
      {d.items.map((it, i) => (
        <div key={i} className="rc-item">
          <div className="rc-b">{it.nama}{it.sisi === 2 ? ' (BB)' : ''}{it.ukuran != null ? ` · ${CUT_SIZES[it.ukuran]}` : ''}</div>
          <R l={`${nf(it.qty)} × ${nf(it.harga)}${it.keterangan ? ` · ${it.keterangan}` : ''}`} r={nf(it.subtotal)} />
        </div>
      ))}
      <div className="rc-hr" />
      <div className="rc-total"><span>TOTAL</span><span>Rp {nf(d.total)}</span></div>
      {terbayar > 0 && <><R l="Sudah dibayar" r={nf(terbayar)} />{d.sisa > 0 && <R l="Sisa tagihan" r={nf(d.sisa)} b />}</>}
      <div className="rc-center">
        <span className="rc-stamp">{st}</span>
        {st !== 'LUNAS' && <div className="rc-note">{SAH_NOTE}</div>}
        {st === 'BELUM DIBAYAR' && <div className="rc-small">Silakan lakukan pembayaran di kasir</div>}
        {st === 'DP' && <div className="rc-small">Sisa Rp {nf(d.sisa)} dibayar di kasir</div>}
      </div>
      {d.jenis === 'spk' && <Barcode text={d.nomor} />}
    </>
  );
}

function KwitansiPart({ d }: { d: ReceiptData }) {
  const bayar = bayarOf(d);
  const sebelumnya = d.sebelumnya || 0;
  const st = statusOf(d.sisa, sebelumnya + bayar);
  const rows: [string, ReactNode][] = [['Telah terima dari', d.customer]];
  if (d.telp && d.telp !== '-') rows.push(['No WA', d.telp]);
  rows.push(['Untuk pembayaran', <>{untukLabel(d.ke || 1, d.sisa, sebelumnya)}<br /><span className="whitespace-nowrap">{d.nomor}</span></>]);
  return (
    <>
      <div className="rc-title">KWITANSI</div>
      <div className="rc-sub">{d.kw_no || d.nomor} · {tglJam(d.waktu)}{d.cs ? ` · ${d.csLabel || 'Kasir'} ${d.cs}` : ''}</div>
      {d.ulang && <div className="rc-sub rc-b">CETAK ULANG</div>}
      <div className="rc-hr" />
      <Kv rows={rows} />
      <div className="rc-dbl" />
      <div className="rc-box">
        <div className="rc-small">Uang sejumlah</div>
        <div className="rc-big">Rp {nf(bayar)}</div>
        <div className="rc-terbilang"># {terbilang(bayar)} #</div>
      </div>
      <R l="Total nota" r={nf(d.total)} />
      {sebelumnya > 0 && <R l="Dibayar sebelumnya" r={nf(sebelumnya)} />}
      <R l="Dibayar s/d kwitansi ini" r={nf(sebelumnya + bayar)} />
      {d.diterima != null && d.diterima > 0 && <R l="Tunai diterima" r={nf(d.diterima)} />}
      {d.kembalian != null && d.kembalian > 0 && <R l="Kembalian" r={nf(d.kembalian)} b />}
      <div className="rc-center">
        <span className="rc-stamp">{st === 'BELUM DIBAYAR' ? 'DP' : st}</span>
        <div className="rc-via">{viaLabel(d.metode, d.metode_jenis)}</div>
        {d.catatan && <div className="rc-small">Ref: {d.catatan}</div>}
        {d.sisa > 0 && <div className="rc-via">Sisa tagihan Rp {nf(d.sisa)}</div>}
      </div>
      <div className="rc-sign">
        <div>Penyetor<div className="rc-line">{d.customer}</div></div>
        <div>Kasir<div className="rc-line">{d.cs || '\u00a0'}</div></div>
      </div>
    </>
  );
}

/** Barcode CODE128-B sebagai SVG (sama dengan barcode printer thermal), bisa discan kasir dari kertas atau layar HP. */
function Barcode({ text }: { text: string }) {
  const bars = code128(text);
  const w = bars.reduce((a, n) => a + n, 0);
  let x = 0;
  return (
    <div className="rc-center">
      <svg viewBox={`0 0 ${w} 40`} preserveAspectRatio="none" className="rc-bar" aria-label={`Barcode ${text}`}>
        {bars.map((n, i) => { const r = i % 2 === 0 ? <rect key={i} x={x} y={0} width={n} height={40} /> : null; x += n; return r; })}
      </svg>
      <div className="rc-small">{text}</div>
    </div>
  );
}

/**
 * Cetak struk. Aplikasi desktop dengan printer yang sudah diatur: langsung ke printer thermal (ESC/POS) + buka laci bila tunai.
 * Selain itu: lewat dialog print browser.
 */
type Job = { d: ReceiptData; shop: ReceiptShop; width: 58 | 80 };
let pushPrint: ((p: Job | null) => void) | null = null;
type Status = { state: 'ok' | 'err'; text: string; job: Job; drawer?: boolean } | null;
let pushStatus: ((s: Status) => void) | null = null;

export interface PrintOpts { drawer?: boolean }
export function printReceipt(d: ReceiptData, shop: ReceiptShop, width: 58 | 80 = 80, opts: PrintOpts = {}) {
  if (directReady()) { void runDirect({ d, shop, width }, opts); return; }
  pushPrint?.({ d, shop, width });
}
async function runDirect(job: Job, opts: PrintOpts) {
  const s = printerSettings.get();
  const nama = d2(job.d.jenis);
  try {
    await printDirect(job.d, job.shop, opts);
    const n = job.d.jenis === 'spk' ? s.salinan_spk : s.salinan_kwitansi;
    pushStatus?.({ state: 'ok', job, text: `${nama} dicetak${n > 1 ? ` ${n} lembar` : ''} ke ${s.koneksi === 'lan' ? s.host : s.printer}${opts.drawer && s.laci ? ' · laci dibuka' : ''}` });
  } catch (e) {
    pushStatus?.({ state: 'err', job, drawer: opts.drawer, text: `${nama} gagal dicetak: ${String((e as Error).message || e).replace(/\.+$/, '')}. Data tetap tersimpan.` });
  }
}
const d2 = (j?: string) => (j === 'spk' ? 'Nota/SPK' : j === 'kwitansi' ? 'Kwitansi' : 'Struk');

export function PrintHost() {
  const [job, setJob] = useState<Job | null>(null);
  const [status, setStatus] = useState<Status>(null);
  useEffect(() => { pushPrint = setJob; pushStatus = setStatus; return () => { pushPrint = null; pushStatus = null; }; }, []);
  useEffect(() => { if (status?.state !== 'ok') return; const t = setTimeout(() => setStatus(null), 4000); return () => clearTimeout(t); }, [status]);
  useEffect(() => {
    if (!job) return;
    const style = document.createElement('style');
    style.textContent = `@page { size: ${job.width}mm auto; margin: 3mm; }`;
    document.head.appendChild(style);
    const t = setTimeout(() => {
      try { window.print(); } catch { /* sebagian pratinjau memblokir print */ }
      setTimeout(() => { style.remove(); setJob(null); }, 500);
    }, 60);
    return () => clearTimeout(t);
  }, [job]);
  const statusBox = status && createPortal(
    <div role="status" id="print-status" className={`no-print fixed bottom-4 right-4 z-[80] flex max-w-sm items-start gap-3 rounded-xl px-4 py-3 text-sm shadow-xl ${status.state === 'ok' ? 'bg-ink text-canvas' : 'bg-bad text-white'}`}>
      {status.state === 'ok' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-ok" /> : <TriangleAlert size={18} className="mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{status.text}</div>
        {status.state === 'err' && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="rounded-md bg-white/20 px-2.5 py-1 text-xs font-bold hover:bg-white/30" onClick={() => { const j = status.job; setStatus(null); void runDirect(j, { drawer: status.drawer }); }}><Printer size={12} className="mr-1 inline" />Coba lagi</button>
            <button className="rounded-md bg-white/20 px-2.5 py-1 text-xs font-bold hover:bg-white/30" onClick={() => { const j = status.job; setStatus(null); setJob(j); }}>Cetak lewat jendela print</button>
          </div>
        )}
      </div>
      <button aria-label="Tutup" className="opacity-70 hover:opacity-100" onClick={() => setStatus(null)}><X size={16} /></button>
    </div>, document.body);
  if (!job) return statusBox || null;
  return <>{statusBox}{createPortal(
    <div id="print-root" style={{ width: `${job.width - 6}mm` }}>
      <ReceiptBody d={job.d} shop={job.shop} width={job.width} />
    </div>,
    document.body,
  )}</>;
}

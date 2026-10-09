import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { CheckCircle2, Printer, TriangleAlert, X } from 'lucide-react';
import { directReady, printDirect, printerSettings } from '@/platform/printer';
import { nf, tglJam } from '@/lib/format';
import { CUT_SIZES } from '@/lib/pricing';

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
  catatan?: string;
  ulang?: boolean;     // cetak ulang
  jenis?: 'spk' | 'kwitansi' | 'struk'; // spk = dari FO (belum bayar); kwitansi = bukti pembayaran kasir
  desain?: string;
  janji_selesai?: string;
  sebelumnya?: number; // sudah dibayar sebelum pembayaran ini (kwitansi)
}
export interface ReceiptShop { nama: string; alamat?: string; telp?: string; catatan?: string }

/** Isi struk; dipakai untuk pratinjau di layar dan untuk cetak. */
export function ReceiptBody({ d, shop, width = 80 }: { d: ReceiptData; shop: ReceiptShop; width?: 58 | 80 }) {
  const sm = width === 58;
  return (
    <div className={`receipt font-mono text-black ${sm ? 'text-[10.5px]' : 'text-[12px]'} leading-[1.35]`}>
      <div className="text-center">
        <div className={`font-bold ${sm ? 'text-[12px]' : 'text-[14px]'}`}>{shop.nama}</div>
        {shop.alamat && <div>{shop.alamat}</div>}
        {shop.telp && <div>Telp/WA {shop.telp}</div>}
      </div>
      <Hr />
      {d.jenis === 'spk' && <div className="text-center font-bold">NOTA / SPK</div>}
      {d.jenis === 'kwitansi' && <div className="text-center font-bold">KWITANSI PEMBAYARAN</div>}
      <Row l={d.nomor} r={d.ulang ? 'CETAK ULANG' : ''} bold />
      <Row l={tglJam(d.waktu)} r={`CS ${d.cs}`} />
      <div>Kepada: {d.customer}</div>
      {d.offline && <div className="font-bold">* Dibuat saat offline</div>}
      {d.janji_selesai && <div>Selesai: {tglJam(d.janji_selesai)}</div>}
      {d.jenis === 'spk' && d.desain && <div>File: {d.desain}</div>}
      <Hr />
      {d.items.map((it, i) => (
        <div key={i} className="mb-1">
          <div className="font-bold">{it.nama}{it.sisi === 2 ? ' (BB)' : ''}{it.ukuran != null ? ` · ${CUT_SIZES[it.ukuran]}` : ''}</div>
          {it.keterangan && <div>  {it.keterangan}</div>}
          <Row l={`  ${nf(it.qty)} x ${nf(it.harga)}`} r={nf(it.subtotal)} />
        </div>
      ))}
      <Hr />
      <Row l="TOTAL" r={nf(d.total)} bold big={!sm} />
      {d.sebelumnya != null && d.sebelumnya > 0 && <Row l="Dibayar sebelumnya" r={nf(d.sebelumnya)} />}
      {d.payments.map((p, i) => <Row key={i} l={p.label} r={nf(p.nominal)} />)}
      {d.diterima != null && d.diterima > 0 && <Row l="Tunai diterima" r={nf(d.diterima)} />}
      {d.kembalian != null && d.kembalian > 0 && <Row l="Kembalian" r={nf(d.kembalian)} bold />}
      {d.jenis === 'spk' ? (
        <div className="mt-1 text-center font-bold">BELUM DIBAYAR · SILAKAN KE KASIR</div>
      ) : (
        <Row l={d.sisa > 0 ? 'SISA TAGIHAN' : 'STATUS'} r={d.sisa > 0 ? nf(d.sisa) : 'LUNAS'} bold />
      )}
      {d.catatan && <><Hr /><div>Catatan: {d.catatan}</div></>}
      <Hr />
      {shop.catatan && <div className="text-center">{shop.catatan}</div>}
    </div>
  );
}
const Hr = () => <div className="my-1 border-t border-dashed border-black" />;
function Row({ l, r, bold, big }: { l: string; r: string; bold?: boolean; big?: boolean }) {
  return <div className={`flex justify-between gap-2 ${bold ? 'font-bold' : ''} ${big ? 'text-[14px]' : ''}`}><span className="min-w-0">{l}</span><span className="shrink-0 text-right">{r}</span></div>;
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

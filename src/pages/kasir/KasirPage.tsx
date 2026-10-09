import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Banknote, CheckCircle2, CloudOff, HandCoins, Printer, RefreshCw, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ErrorBox, Field } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { printReceipt, ReceiptBody, type ReceiptData, type ReceiptShop } from '@/components/Receipt';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { loadPos, newClientId, sync, useSync, type OutboxOp } from '@/lib/offline';
import { CUT_SIZES } from '@/lib/pricing';
import { nf, rp, tglJam, ymd } from '@/lib/format';
import { BAYAR } from '@/pages/order/OrderDetailModal';
import { directReady, drawerForCash, openDrawer, paperWidth, printerSettings } from '@/platform/printer';
import type { Order, OrderDetail } from '@/types';

/**
 * Kasir: menerima pembayaran berdasarkan nota/SPK yang diterbitkan Front Office.
 * Tidak bisa membuat atau mengubah isi order.
 */
type PayMode = 'lunas' | 'dp' | 'nominal';
interface QueueRow { id: string; nomor: string; tanggal: string; created_at: string; customer: string; cs: string; total: number; terbayar: number; sisa: number; status: string; ringkas: string; pending?: boolean; offline?: boolean }
interface Done { receipt: ReceiptData; offline: boolean; lunas: boolean; tunai?: boolean }

const QKEY = 'fortuner-kasir-queue';
const AUTO_PRINT = 'fortuner-autoprint-kwitansi';
const numIn = (s: string) => Number(String(s).replace(/[^\d]/g, '')) || 0;
const readQ = (): Order[] => { try { return JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch { return []; } };

export function KasirPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const s = useSync();
  const pos = useQuery({ queryKey: ['pos'], queryFn: loadPos, staleTime: 60e3, retry: 0 });
  // antrian: nota belum lunas, diperbarui tiap 20 detik supaya nota baru dari FO cepat muncul
  const q = useQuery({
    queryKey: ['orders', 'kasir-queue'],
    queryFn: async () => {
      try { const rows = await api<Order[]>('orders.list', { piutang: true }); try { localStorage.setItem(QKEY, JSON.stringify(rows)); } catch { /* abaikan */ } return { rows, cached: false }; }
      catch (e) { if ((e as ApiError).code === 'NETWORK') { sync.markOffline(); return { rows: readQ(), cached: true }; } throw e; }
    },
    refetchInterval: 20_000, retry: 0,
  });
  useEffect(() => { const off = sync.onSynced(() => qc.invalidateQueries({ queryKey: ['orders'] })); return () => { off(); }; }, [qc]);

  const [scope, setScope] = useState<'hari_ini' | 'semua'>('hari_ini');
  const [search, setSearch] = useState('');
  const [selId, setSelId] = useState('');
  const [done, setDone] = useState<Done | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const today = ymd();

  // nota dari perangkat ini yang belum terkirim ikut tampil supaya bisa langsung dibayar
  const pendingOrders: QueueRow[] = s.outbox.filter((o) => o.kind === 'orders.create').map((o: OutboxOp) => {
    const paid = s.outbox.filter((x) => x.kind === 'orders.pay' && x.payload.order_id === o.id).reduce((a, x) => a + Number(x.payload.nominal || 0), 0);
    return {
      id: o.id, nomor: o.label.split(' · ')[0], tanggal: String(o.payload.tanggal || today), created_at: o.created_at, customer: o.view?.customer || '', cs: '',
      total: o.total || 0, terbayar: paid, sisa: (o.total || 0) - paid, status: paid ? 'dp' : 'belum', ringkas: (o.view?.items || []).map((i) => i.nama).join(', '), pending: true, offline: true,
    };
  }).filter((r) => r.sisa > 0);
  const pendingPays = s.outbox.filter((o) => o.kind === 'orders.pay');
  const serverRows: QueueRow[] = (q.data?.rows || []).map((o) => {
    const extra = pendingPays.filter((x) => x.payload.order_id === o.id).reduce((a, x) => a + Number(x.payload.nominal || 0), 0);
    return { id: o.id, nomor: o.nomor, tanggal: o.tanggal, created_at: o.created_at, customer: o.customer_nama || '', cs: o.cs_nama || '', total: o.total, terbayar: o.terbayar + extra, sisa: o.sisa - extra, status: o.status_bayar, ringkas: o.ringkas || '', offline: o.dibuat_offline };
  }).filter((r) => r.sisa > 0);
  const all = [...pendingOrders, ...serverRows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const term = search.trim().toLowerCase();
  const rows = all.filter((r) => (scope === 'semua' || r.tanggal === today || term) && (!term || `${r.nomor} ${r.customer}`.toLowerCase().includes(term)));
  const sel = all.find((r) => r.id === selId) || null;

  // Enter di kotak cari: bila cocok tepat satu nota (mis. ketik nomor), langsung pilih
  const onSearchEnter = () => { if (rows.length === 1) setSelId(rows[0].id); };

  const shop: ReceiptShop = { nama: pos.data?.settings.nama_usaha || 'Fortuner', alamat: pos.data?.settings.alamat, telp: pos.data?.settings.telp, catatan: pos.data?.settings.catatan_struk };
  const width = paperWidth(pos.data?.device?.lebar_kertas);

  if (done) {
    return (
      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-[1fr_320px]">
        <section className="card p-6">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${done.offline ? 'bg-warn/10 text-warn' : 'bg-ok/10 text-ok'}`}>{done.offline ? <CloudOff size={24} /> : <CheckCircle2 size={24} />}</div>
          <h1 className="mt-4 text-2xl font-extrabold">{done.lunas ? 'Lunas' : 'Pembayaran diterima'}</h1>
          <div className="num mt-2 font-mono text-2xl font-bold text-brand">{done.receipt.nomor}</div>
          <p className="mt-2 text-sm text-muted">{done.receipt.customer} · dibayar {rp(done.receipt.payments[0]?.nominal)}{done.receipt.sisa > 0 ? ` · sisa ${rp(done.receipt.sisa)} jadi piutang` : ''}{done.offline ? ' · tersimpan di perangkat, dikirim otomatis saat online' : ''}</p>
          {done.receipt.kembalian ? <div className="mt-4 rounded-xl bg-ink p-4 text-canvas"><div className="text-xs uppercase tracking-wider opacity-70">Kembalian</div><div className="num text-4xl font-extrabold">{rp(done.receipt.kembalian)}</div></div> : null}
          <div className="mt-6 flex flex-wrap gap-2">
            <button className="btn btn-primary" autoFocus onClick={() => { setDone(null); setSelId(''); setSearch(''); setTimeout(() => searchRef.current?.focus(), 0); }}><ArrowLeft size={16} />Kembali ke antrian</button>
            <button className="btn" onClick={() => printReceipt(done.receipt, shop, width)}><Printer size={16} />Cetak kwitansi</button>
          </div>
        </section>
        <section className="card overflow-hidden">
          <div className="border-b border-line px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted">Pratinjau kwitansi · {width} mm</div>
          <div className="max-h-[70vh] overflow-y-auto bg-white p-4"><ReceiptBody d={done.receipt} shop={shop} width={width} /></div>
        </section>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
      {/* antrian */}
      <section className={`card flex min-w-0 flex-col overflow-hidden ${sel ? 'max-lg:hidden' : ''}`}>
        <div className="flex flex-col gap-3 border-b border-line p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold">Menunggu pembayaran <span className="num font-normal text-muted">({rows.length})</span></h2>
            <div className="flex items-center gap-1">
              <DrawerButton />
              <button className="btn btn-ghost btn-sm" onClick={() => q.refetch()} disabled={q.isFetching} title="Muat ulang"><RefreshCw size={14} className={q.isFetching ? 'animate-spin' : ''} /></button>
            </div>
          </div>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input ref={searchRef} id="kasir-cari" autoFocus className="input pl-9 font-mono" placeholder="Ketik / scan nomor nota, atau nama konsumen" value={search}
              onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSearchEnter()} />
          </div>
          <div className="flex gap-2">
            {([['hari_ini', 'Hari ini'], ['semua', 'Semua belum lunas']] as const).map(([k, l]) => (
              <button key={k} className={`chip ${scope === k ? 'border-ink bg-ink text-canvas' : 'hover:border-muted'}`} onClick={() => setScope(k)}>{l}</button>
            ))}
          </div>
          {q.data?.cached && <div className="flex gap-2 rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn"><CloudOff size={14} className="shrink-0" />Offline: daftar dari data terakhir. Nota baru dari PC lain belum terlihat.</div>}
        </div>
        <ul className="max-h-[calc(100vh-300px)] min-h-[200px] divide-y divide-line overflow-y-auto">
          {q.isLoading && <li className="p-6 text-center text-sm text-muted">Memuat…</li>}
          <ErrorBox error={q.error} />
          {!q.isLoading && !rows.length && <li className="p-8 text-center text-sm text-muted">{term ? 'Tidak ada nota yang cocok.' : scope === 'hari_ini' ? 'Tidak ada nota hari ini yang menunggu dibayar.' : 'Semua nota sudah lunas.'}</li>}
          {rows.map((r) => (
            <li key={r.id}>
              <button className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-sunk ${selId === r.id ? 'bg-brand/10' : ''}`} onClick={() => setSelId(r.id)}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold">{r.nomor}</span>
                    <span className={`pill ${BAYAR[r.status]?.[1] || 'pill-mute'}`}>{BAYAR[r.status]?.[0]}</span>
                    {r.pending && <span className="pill pill-warn"><CloudOff size={11} />Belum terkirim</span>}
                  </div>
                  <div className="mt-0.5 truncate text-sm font-semibold">{r.customer}</div>
                  <div className="truncate text-xs text-muted">{tglJam(r.created_at)}{r.cs ? ` · FO ${r.cs}` : ''}{r.ringkas ? ` · ${r.ringkas}` : ''}</div>
                </div>
                <div className="text-right">
                  <div className="num text-base font-extrabold">{nf(r.sisa)}</div>
                  {r.terbayar > 0 && <div className="num text-[11px] text-muted">dari {nf(r.total)}</div>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* pembayaran */}
      <section className={`lg:sticky lg:top-20 lg:self-start ${sel ? '' : 'max-lg:hidden'}`}>
        {!sel ? (
          <div className="card flex flex-col items-center gap-2 p-8 text-center text-sm text-muted">
            <HandCoins size={28} className="text-brand" />Pilih nota dari antrian, atau ketik nomor nota lalu tekan Enter.
          </div>
        ) : (
          <PayPanel key={sel.id} row={sel} methods={pos.data?.payment_methods || []} onBack={() => setSelId('')} kasirNama={user?.nama || ''}
            onDone={(d) => { setDone(d); if (autoPrintOn()) printReceipt(d.receipt, shop, width, { drawer: d.tunai }); else if (d.tunai) drawerForCash(); qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); if (d.offline) toast('Pembayaran disimpan di perangkat dan dikirim otomatis saat online.'); }} />
        )}
      </section>
    </div>
  );
}

/** Tombol buka laci manual (aplikasi desktop, bila diaktifkan di Printer & Laci). Tercatat di log aktivitas. */
function DrawerButton() {
  const toast = useToast();
  const s = printerSettings.get();
  if (!directReady(s) || !s.laci || !s.laci_manual) return null;
  return (
    <button id="kasir-buka-laci" className="btn btn-sm" onClick={async () => {
      try { await openDrawer(); toast('Laci dibuka'); api('drawer.open', {}).catch(() => { /* offline: abaikan */ }); }
      catch (e) { toast((e as Error).message, 'err'); }
    }}><Banknote size={14} />Buka laci</button>
  );
}

const autoPrintOn = () => { try { return localStorage.getItem(AUTO_PRINT) !== '0'; } catch { return true; } };

function PayPanel({ row, methods, onBack, onDone, kasirNama }: { row: QueueRow; methods: { id: string; nama: string; jenis: string }[]; onBack: () => void; onDone: (d: Done) => void; kasirNama: string }) {
  const s = useSync();
  const detail = useQuery({ queryKey: ['order', row.id], queryFn: () => api<OrderDetail>('orders.get', { order_id: row.id }), enabled: !row.pending && s.online, retry: 0 });
  const op = s.outbox.find((o) => o.id === row.id);
  const items = detail.data?.items.map((i) => ({ nama: i.nama_produk + (i.sisi === 2 ? ' · BB' : '') + (i.jenis_harga === 'cutting' ? ` · ${CUT_SIZES[i.ukuran_cutting]}` : ''), keterangan: i.keterangan, qty: i.qty, harga: i.harga_satuan }))
    || op?.view?.items || [];
  const methodList = methods.length ? methods : detail.data?.payment_methods || [];
  const [mode, setMode] = useState<PayMode>('lunas');
  const [methodId, setMethodId] = useState(methodList.find((m) => m.jenis === 'tunai')?.id || methodList[0]?.id || '');
  const [nominalIn, setNominalIn] = useState('');
  const [diterimaIn, setDiterimaIn] = useState('');
  const [catatan, setCatatan] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [autoPrint, setAutoPrint] = useState(autoPrintOn());
  const [payId] = useState(() => newClientId('pmt'));
  useEffect(() => { if (!methodId && methodList.length) setMethodId(methodList.find((m) => m.jenis === 'tunai')?.id || methodList[0].id); }, [methodList, methodId]);

  const sisa = row.sisa;
  const nominal = mode === 'lunas' ? sisa : mode === 'dp' ? Math.min(sisa, Math.max(1000, Math.round(sisa / 2 / 1000) * 1000)) : Math.min(numIn(nominalIn), sisa);
  const isTunai = methodList.find((m) => m.id === methodId)?.jenis === 'tunai';
  const diterima = numIn(diterimaIn);
  const kembalian = isTunai && diterima > nominal ? diterima - nominal : 0;
  const kurang = isTunai && diterimaIn !== '' && diterima < nominal;
  const metode = methodList.find((m) => m.id === methodId)?.nama || '';

  const submit = async () => {
    setErr(null);
    if (nominal <= 0) { setErr(new Error('Isi nominal pembayaran.')); return; }
    if (!methodId) { setErr(new Error('Pilih metode pembayaran.')); return; }
    if (kurang) { setErr(new Error('Uang diterima kurang dari nominal yang dibayar.')); return; }
    setBusy(true);
    const payload = { order_id: row.id, payment_id: payId, nominal, method_id: methodId, catatan: catatan.trim(), tanggal: ymd() };
    const receipt = (): ReceiptData => ({
      jenis: 'kwitansi', nomor: row.nomor, waktu: new Date().toISOString(), customer: row.customer, cs: kasirNama.split(' ')[0], catatan: catatan.trim(),
      items: items.map((i) => ({ nama: i.nama, keterangan: i.keterangan, qty: i.qty, harga: i.harga, subtotal: i.harga * i.qty })),
      total: row.total, sebelumnya: row.terbayar, payments: [{ label: `Bayar ${metode}`, nominal }], sisa: sisa - nominal, diterima: isTunai ? diterima : undefined, kembalian,
    });
    const offline = () => {
      sync.enqueue({ id: payId, kind: 'orders.pay', payload: { ...payload, dibuat_offline: true }, label: `${row.nomor} · ${row.customer}`, total: nominal });
      onDone({ receipt: receipt(), offline: true, lunas: nominal >= sisa, tunai: isTunai });
    };
    try {
      if (row.pending || !s.online) offline();
      else {
        try { await api<OrderDetail>('orders.pay', payload); onDone({ receipt: receipt(), offline: false, lunas: nominal >= sisa, tunai: isTunai }); }
        catch (e) { if ((e as ApiError).code === 'NETWORK') { sync.markOffline(); offline(); } else throw e; }
      }
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  return (
    <div className="card flex flex-col">
      <div className="flex items-start gap-3 border-b border-line p-4">
        <button className="btn btn-ghost btn-sm -ml-2 px-2 lg:hidden" onClick={onBack} aria-label="Kembali ke antrian"><ArrowLeft size={16} /></button>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-lg font-bold">{row.nomor}</div>
          <div className="text-sm font-semibold">{row.customer}</div>
          <div className="text-xs text-muted">{tglJam(row.created_at)}{row.cs ? ` · FO ${row.cs}` : ''}</div>
          {detail.data?.order.desain && <div className="mt-1 text-xs text-muted">File: {detail.data.order.desain}</div>}
          {detail.data?.order.catatan && <div className="mt-1 rounded-md bg-sunk px-2 py-1 text-xs">Catatan FO: {detail.data.order.catatan}</div>}
        </div>
      </div>
      <ul className="max-h-48 divide-y divide-line overflow-y-auto text-sm">
        {detail.isLoading && <li className="px-4 py-3 text-muted">Memuat isi nota…</li>}
        {items.map((i, k) => (
          <li key={k} className="flex gap-3 px-4 py-2">
            <div className="min-w-0 flex-1"><div className="truncate font-semibold">{i.nama}</div>{i.keterangan && <div className="truncate text-xs text-muted">{i.keterangan}</div>}</div>
            <div className="num text-right text-xs text-muted">{nf(i.qty)} × {nf(i.harga)}</div>
            <div className="num w-24 text-right font-semibold">{nf(i.qty * i.harga)}</div>
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-2 gap-y-1 border-t border-line px-4 py-3 text-sm">
        <dt className="text-muted">Total nota</dt><dd className="num text-right">{rp(row.total)}</dd>
        {row.terbayar > 0 && <><dt className="text-muted">Sudah dibayar</dt><dd className="num text-right">{rp(row.terbayar)}</dd></>}
        <dt className="font-bold">Harus dibayar</dt><dd className="num text-right text-2xl font-extrabold">{rp(sisa)}</dd>
      </dl>
      <div className="flex flex-col gap-3 border-t border-line p-4">
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Jumlah bayar">
          {([['lunas', 'Lunas'], ['dp', 'DP 50%'], ['nominal', 'Nominal']] as [PayMode, string][]).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setMode(k)} className={`rounded-lg border px-2 py-2 text-sm font-semibold transition ${mode === k ? 'border-brand bg-brand text-brand-ink' : 'border-line hover:border-muted'}`}>{l}</button>
          ))}
        </div>
        {mode === 'nominal' && <Field label="Nominal dibayar"><input id="kasir-nominal" autoFocus className="input num text-right text-lg" inputMode="numeric" value={nominalIn ? nf(numIn(nominalIn)) : ''} onChange={(e) => setNominalIn(e.target.value)} placeholder="0" /></Field>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Metode"><select id="kasir-metode" className="input" value={methodId} onChange={(e) => setMethodId(e.target.value)}>{methodList.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}</select></Field>
          {isTunai ? (
            <Field label="Uang diterima"><input id="kasir-diterima" className="input num text-right" inputMode="numeric" value={diterimaIn ? nf(numIn(diterimaIn)) : ''} onChange={(e) => setDiterimaIn(e.target.value)} placeholder={nf(nominal)} onKeyDown={(e) => e.key === 'Enter' && submit()} /></Field>
          ) : (
            <Field label="Catatan / no. referensi"><input id="kasir-ref" className="input" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="mis. 4 digit akhir rek." /></Field>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-muted">Dibayar sekarang</dt><dd className="num text-right font-semibold">{rp(nominal)}</dd>
          <dt className="text-muted">Sisa setelah ini</dt><dd className={`num text-right font-bold ${sisa - nominal > 0 ? 'text-bad' : 'text-ok'}`}>{sisa - nominal > 0 ? rp(sisa - nominal) : 'Lunas'}</dd>
          {kembalian > 0 && <><dt className="font-bold">Kembalian</dt><dd className="num text-right text-xl font-extrabold">{rp(kembalian)}</dd></>}
        </dl>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" checked={autoPrint} onChange={(e) => { setAutoPrint(e.target.checked); try { localStorage.setItem(AUTO_PRINT, e.target.checked ? '1' : '0'); } catch { /* abaikan */ } }} />
          Cetak kwitansi setelah bayar
        </label>
        <ErrorBox error={err} />
        <button className="btn btn-primary py-3 text-base" disabled={busy || nominal <= 0} onClick={submit}><HandCoins size={18} />{busy ? 'Menyimpan…' : `Terima ${rp(nominal)}`}</button>
      </div>
    </div>
  );
}

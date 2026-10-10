import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Banknote, CheckCircle2, CloudOff, CreditCard, FileText, HandCoins, Landmark, MessageCircle, RefreshCw, ScanLine, StickyNote } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ErrorBox } from '@/components/ui/Field';
import { Money } from '@/components/ui/Money';
import { useToast } from '@/components/ui/Toast';
import { no4, printReceipt, shopOf, tipeLabel, type ReceiptData } from '@/components/Receipt';
import { ReceiptModal } from '@/components/ReceiptModal';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { loadPos, newClientId, sync, useSync, type OutboxOp } from '@/lib/offline';
import { CUT_SIZES } from '@/lib/pricing';
import { jam, nf, rp, ymd } from '@/lib/format';
import { directReady, drawerForCash, openDrawer, paperWidth, printerSettings } from '@/platform/printer';
import type { Order, OrderDetail } from '@/types';

/**
 * Kasir: menerima pembayaran berdasarkan nota/SPK yang diterbitkan Front Office.
 * Tidak bisa membuat atau mengubah isi order. Setelah bayar, kwitansi tampil sebagai pratinjau akhir
 * dengan tombol cetak, kirim WhatsApp, dan simpan JPEG.
 */
interface QueueRow {
  id: string; nomor: string; tanggal: string; created_at: string; customer: string; telp: string; tipe: string; cs: string;
  total: number; terbayar: number; sisa: number; status: string; ringkas: string; selesai?: boolean; pending?: boolean; offline?: boolean;
}
interface Done { receipt: ReceiptData; offline: boolean; lunas: boolean; tunai?: boolean }
type Method = { id: string; nama: string; jenis: string };

const QKEY = 'fortuner-kasir-queue';
const numIn = (s: string) => Number(String(s).replace(/[^\d]/g, '')) || 0;
const readQ = (): Order[] => { try { return JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch { return []; } };
/** 1.320.000 → 1,32jt · 61.000 → 61rb · 17.400 → 17,4rb */
const singkat = (v: number) => v >= 1e6 ? `${(v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 })}jt` : v >= 1e3 ? `${(v / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 1 })}rb` : nf(v);
const METHOD_ICON = { tunai: Banknote, transfer: Landmark, edc: CreditCard } as Record<string, typeof Banknote>;

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
      id: o.id, nomor: o.label.split(' · ')[0], tanggal: String(o.payload.tanggal || today), created_at: o.created_at, customer: o.view?.customer || '', telp: o.view?.telp || '', tipe: o.view?.tipe || '', cs: '',
      total: o.total || 0, terbayar: paid, sisa: (o.total || 0) - paid, status: paid ? 'dp' : 'belum', ringkas: (o.view?.items || []).map((i) => i.nama).join(', '), pending: true, offline: true,
    };
  }).filter((r) => r.sisa > 0);
  const pendingPays = s.outbox.filter((o) => o.kind === 'orders.pay');
  const serverRows: QueueRow[] = (q.data?.rows || []).map((o) => {
    const extra = pendingPays.filter((x) => x.payload.order_id === o.id).reduce((a, x) => a + Number(x.payload.nominal || 0), 0);
    return {
      id: o.id, nomor: o.nomor, tanggal: o.tanggal, created_at: o.created_at, customer: o.customer_nama || '', telp: o.customer_telp || '', tipe: o.customer_tipe || '', cs: o.cs_nama || '',
      total: o.total, terbayar: o.terbayar + extra, sisa: o.sisa - extra, status: extra && o.status_bayar === 'belum' ? 'dp' : o.status_bayar, ringkas: o.ringkas || '', selesai: o.produksi_selesai, offline: o.dibuat_offline,
    };
  }).filter((r) => r.sisa > 0);
  const all = [...pendingOrders, ...serverRows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const term = search.trim().toLowerCase();
  const rows = all.filter((r) => (scope === 'semua' || r.tanggal === today || term) && (!term || `${r.nomor} ${r.customer}`.toLowerCase().includes(term)));
  const sel = all.find((r) => r.id === selId) || null;

  // Enter / scan di kotak cari: nomor persis atau satu-satunya hasil langsung dipilih
  const onSearchEnter = () => {
    const exact = rows.find((r) => r.nomor.toLowerCase() === term) || (rows.length === 1 ? rows[0] : null);
    if (exact) { setSelId(exact.id); setSearch(''); }
  };

  const shop = shopOf(pos.data?.settings);
  const width = paperWidth(pos.data?.device?.lebar_kertas);
  const finish = () => { setDone(null); setSelId(''); setSearch(''); setTimeout(() => searchRef.current?.focus(), 0); };

  return (
    <>
      <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-line bg-surface lg:h-[calc(100vh-8rem)] lg:min-h-[560px] lg:grid-cols-[272px_minmax(0,1fr)]">
        {/* antrian */}
        <aside className={`queue-pane flex min-h-0 flex-col border-line lg:border-r ${sel ? 'max-lg:hidden' : ''}`}>
          <div className="flex flex-col gap-2.5 p-3.5 pb-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold">Kasir <span className="num text-xs font-normal text-muted">· {rows.length} menunggu</span></h2>
              <div className="flex items-center">
                <DrawerButton />
                <button className="btn btn-ghost btn-sm px-2" onClick={() => q.refetch()} disabled={q.isFetching} title="Muat ulang" aria-label="Muat ulang antrian"><RefreshCw size={14} className={q.isFetching ? 'animate-spin' : ''} /></button>
              </div>
            </div>
            <div className="relative">
              <ScanLine size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input ref={searchRef} id="kasir-cari" autoFocus className="input pl-9 font-mono text-[13px]" placeholder="Scan / ketik nota atau nama" value={search}
                onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSearchEnter()} />
            </div>
            <div className="flex gap-1.5">
              {([['hari_ini', 'Hari ini'], ['semua', 'Semua belum lunas']] as const).map(([k, l]) => (
                <button key={k} className={`chip ${scope === k ? 'border-ink bg-ink text-canvas' : 'hover:border-muted'}`} onClick={() => setScope(k)}>{l}</button>
              ))}
            </div>
            {q.data?.cached && <div className="flex gap-2 rounded-lg bg-warn/10 px-2.5 py-1.5 text-[11px] text-warn"><CloudOff size={13} className="shrink-0" />Offline: daftar dari data terakhir.</div>}
          </div>
          <ul className="min-h-[160px] flex-1 overflow-y-auto border-t border-black/5 dark:border-white/5 max-lg:max-h-[60vh]">
            {q.isLoading && <li className="p-6 text-center text-sm text-muted">Memuat…</li>}
            <ErrorBox error={q.error} />
            {!q.isLoading && !rows.length && <li className="p-6 text-center text-xs text-muted">{term ? 'Tidak ada nota yang cocok.' : scope === 'hari_ini' ? 'Tidak ada nota hari ini yang menunggu dibayar.' : 'Semua nota sudah lunas.'}</li>}
            {rows.map((r) => {
              const on = selId === r.id;
              return (
                <li key={r.id}>
                  <button className={`queue-row flex w-full items-center gap-2.5 border-b border-black/5 px-3.5 py-2.5 text-left transition dark:border-white/5 ${on ? '!bg-surface shadow-[inset_3px_0_0_rgb(var(--brand))]' : ''}`}
                    onClick={() => setSelId(r.id)} title={`${r.nomor}${r.ringkas ? ` · ${r.ringkas}` : ''}`}>
                    <span className="num w-11 shrink-0 font-mono text-[15px] font-bold">{no4(r.nomor)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{r.customer}</span>
                      <span className="flex items-center gap-1 text-[11px] text-muted">{r.pending && <CloudOff size={11} className="text-warn" />}{jam(r.created_at)}{r.status === 'dp' ? ' · DP' : ''}</span>
                    </span>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${r.status === 'dp' ? 'bg-warn' : 'bg-bad'}`} aria-label={r.status === 'dp' ? 'DP' : 'Belum bayar'} />
                    <span className="num w-14 shrink-0 text-right text-sm font-bold">{singkat(r.sisa)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* pembayaran */}
        <main className={`min-h-0 overflow-y-auto ${sel ? '' : 'max-lg:hidden'}`}>
          {!sel ? (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted">
              <HandCoins size={30} className="text-brand" />Pilih nota dari antrian, atau scan / ketik nomor nota lalu tekan Enter.
            </div>
          ) : (
            <PayPanel key={sel.id} row={sel} methods={pos.data?.payment_methods || []} onBack={() => setSelId('')} kasirNama={user?.nama || ''} active={!done}
              onDone={(d) => {
                setDone(d);
                if (d.tunai) drawerForCash();
                qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['dashboard'] });
                if (d.offline) toast('Pembayaran disimpan di perangkat dan dikirim otomatis saat online.');
              }} />
          )}
        </main>
      </div>

      {done && (
        <ReceiptModal d={done.receipt} shop={shop} width={width} waTemplate={pos.data?.settings.wa_pesan_kwitansi}
          title={<span className="inline-flex items-center gap-2">{done.offline ? <CloudOff size={18} className="text-warn" /> : <CheckCircle2 size={18} className="text-ok" />}{done.lunas ? `Nota ${no4(done.receipt.nomor)} lunas` : 'Pembayaran diterima'}</span>}
          subtitle={`${done.receipt.customer} · dibayar ${rp(done.receipt.payments[0]?.nominal)}${done.receipt.sisa > 0 ? ` · sisa ${rp(done.receipt.sisa)} jadi piutang` : ''}`}
          printLabel="Cetak kwitansi" onPrint={() => printReceipt(done.receipt, shop, width)}
          closeLabel="Selesai" onClose={finish}>
          {done.receipt.kembalian ? (
            <div className="rounded-xl bg-ink p-4 text-canvas"><div className="text-xs uppercase tracking-wider opacity-70">Kembalian</div><div className="num text-4xl font-extrabold">{rp(done.receipt.kembalian)}</div></div>
          ) : (
            <div className={`rounded-xl p-4 ${done.lunas ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn'}`}><div className="text-xs font-bold uppercase tracking-wider">{done.lunas ? 'Status' : 'Sisa tagihan'}</div><div className="num text-3xl font-extrabold">{done.lunas ? 'LUNAS' : rp(done.receipt.sisa)}</div></div>
          )}
          {done.offline && <p className="text-xs text-warn">Tersimpan di perangkat, dikirim otomatis saat online.</p>}
        </ReceiptModal>
      )}
    </>
  );
}

/** Tombol buka laci manual (aplikasi desktop, bila diaktifkan di Printer & Laci). Tercatat di log aktivitas. */
function DrawerButton() {
  const toast = useToast();
  const s = printerSettings.get();
  if (!directReady(s) || !s.laci || !s.laci_manual) return null;
  return (
    <button id="kasir-buka-laci" className="btn btn-ghost btn-sm px-2" title="Buka laci" onClick={async () => {
      try { await openDrawer(); toast('Laci dibuka'); api('drawer.open', {}).catch(() => { /* offline: abaikan */ }); }
      catch (e) { toast((e as Error).message, 'err'); }
    }}><Banknote size={15} /><span className="sr-only">Buka laci</span></button>
  );
}

function PayPanel({ row, methods, onBack, onDone, kasirNama, active }: { row: QueueRow; methods: Method[]; onBack: () => void; onDone: (d: Done) => void; kasirNama: string; active: boolean }) {
  const s = useSync();
  const detail = useQuery({ queryKey: ['order', row.id], queryFn: () => api<OrderDetail>('orders.get', { order_id: row.id }), enabled: !row.pending && s.online, retry: 0 });
  const op = s.outbox.find((o) => o.id === row.id);
  const items = detail.data?.items.map((i) => ({ nama: i.nama_produk + (i.sisi === 2 ? ' · BB' : '') + (i.jenis_harga === 'cutting' ? ` · ${CUT_SIZES[i.ukuran_cutting]}` : ''), keterangan: i.keterangan, qty: i.qty, harga: i.harga_satuan }))
    || op?.view?.items || [];
  const methodList: Method[] = methods.length ? methods : detail.data?.payment_methods || [];
  const sisa = row.sisa;
  const [methodId, setMethodId] = useState(methodList.find((m) => m.jenis === 'tunai')?.id || methodList[0]?.id || '');
  const [amountIn, setAmountIn] = useState(String(sisa));
  const [catatan, setCatatan] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [payId] = useState(() => newClientId('pmt'));
  const amountRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!methodId && methodList.length) setMethodId(methodList.find((m) => m.jenis === 'tunai')?.id || methodList[0].id); }, [methodList, methodId]);
  useEffect(() => { setTimeout(() => amountRef.current?.select(), 0); }, []);

  const method = methodList.find((m) => m.id === methodId);
  const isTunai = method?.jenis === 'tunai';
  const amount = numIn(amountIn);
  const nominal = Math.min(amount, sisa);
  const kembalian = isTunai && amount > sisa ? amount - sisa : 0;
  const lunas = nominal >= sisa;
  const o = detail.data?.order;
  const selesai = o ? detail.data!.items.length > 0 && detail.data!.items.every((i) => i.status_produksi === 'selesai') : row.selesai;
  const telp = o?.customer_telp || row.telp;
  const tipe = tipeLabel(o?.customer_tipe || row.tipe);

  const submit = async () => {
    if (busy) return;
    setErr(null);
    if (nominal <= 0) { setErr(new Error(isTunai ? 'Isi uang diterima.' : 'Isi nominal pembayaran.')); amountRef.current?.focus(); return; }
    if (!methodId) { setErr(new Error('Pilih metode pembayaran.')); return; }
    setBusy(true);
    const payload = { order_id: row.id, payment_id: payId, nominal, method_id: methodId, catatan: catatan.trim(), tanggal: ymd() };
    const receipt = (): ReceiptData => ({
      jenis: 'kwitansi', nomor: row.nomor, waktu: new Date().toISOString(), customer: row.customer, tipe, telp, cs: kasirNama.split(' ')[0], catatan: catatan.trim(),
      items: items.map((i) => ({ nama: i.nama, keterangan: i.keterangan, qty: i.qty, harga: i.harga, subtotal: i.harga * i.qty })),
      total: row.total, sebelumnya: row.terbayar, payments: [{ label: `Bayar ${method?.nama || ''}`, nominal }], sisa: sisa - nominal, diterima: isTunai ? amount : undefined, kembalian,
    });
    const offline = () => {
      sync.enqueue({ id: payId, kind: 'orders.pay', payload: { ...payload, dibuat_offline: true }, label: `${row.nomor} · ${row.customer}`, total: nominal });
      onDone({ receipt: receipt(), offline: true, lunas, tunai: isTunai });
    };
    try {
      if (row.pending || !s.online) offline();
      else {
        try { await api<OrderDetail>('orders.pay', payload); onDone({ receipt: receipt(), offline: false, lunas, tunai: isTunai }); }
        catch (e) { if ((e as ApiError).code === 'NETWORK') { sync.markOffline(); offline(); } else throw e; }
      }
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  // F9 = bayar
  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    if (!active) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'F9') { e.preventDefault(); void submitRef.current(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [active]);

  const quick: [string, number][] = isTunai
    ? [['Uang pas', sisa], ...([50e3, 100e3, 200e3, 500e3] as number[]).filter((v) => v > sisa * 0.25).slice(0, 4).map((v) => [`${v / 1000}rb`, v] as [string, number])]
    : [['Lunas', sisa], ['DP 50%', Math.min(sisa, Math.max(1000, Math.round(sisa / 2 / 1000) * 1000))]];
  const laci = (() => { const p = printerSettings.get(); return directReady(p) && p.laci && p.laci_tunai; })();

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      {/* identitas nota */}
      <div className="flex items-start gap-3">
        <button className="btn btn-ghost btn-sm -ml-2 px-2 lg:hidden" onClick={onBack} aria-label="Kembali ke antrian"><ArrowLeft size={16} /></button>
        <div className="min-w-0 flex-1">
          <div className="text-xl font-bold leading-tight">{row.customer}{tipe && <span className="text-base font-normal text-muted"> ({tipe})</span>}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span className="font-mono">{row.nomor}</span>
            {row.cs && <span>· FO {row.cs}</span>}
            <span>· {jam(row.created_at)}</span>
            {telp && telp !== '-' && <span className="inline-flex items-center gap-1">· <MessageCircle size={12} className="text-[#1F8F4E]" />{telp}</span>}
            {row.pending ? <span className="pill pill-warn"><CloudOff size={11} />Belum terkirim</span>
              : selesai != null && <span className={`pill ${selesai ? 'pill-ok' : 'pill-warn'}`}>{selesai ? 'Produksi selesai' : 'Masih diproduksi'}</span>}
          </div>
          {(o?.desain || o?.catatan) && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {o?.desain && <span className="inline-flex items-center gap-1 rounded-md bg-sunk px-2 py-1"><FileText size={12} />{o.desain}</span>}
              {o?.catatan && <span className="inline-flex items-center gap-1 rounded-md bg-sunk px-2 py-1"><StickyNote size={12} />{o.catatan}</span>}
            </div>
          )}
        </div>
        <div className="shrink-0 rounded-lg bg-black px-3 py-1 font-mono text-3xl font-bold tracking-wider text-white ring-1 ring-white/10" aria-label={`Nomor nota ${row.nomor}`}>{no4(row.nomor)}</div>
      </div>

      {/* isi nota */}
      <div className="overflow-x-auto">
        <table className="tbl w-full text-sm">
          <thead><tr>
            <th className="px-2 py-2 text-[11px]">ITEM</th>
            <th className="w-20 px-2 py-2 text-[11px]">JUMLAH</th>
            <th className="w-32 px-2 py-2 text-[11px]">HARGA</th>
            <th className="w-36 px-2 py-2 text-[11px]">SUBTOTAL</th>
          </tr></thead>
          <tbody>
            {detail.isLoading && <tr><td colSpan={4} className="px-3 py-3 text-muted">Memuat isi nota…</td></tr>}
            {items.map((i, k) => (
              <tr key={k}>
                <td className="px-2.5 py-2"><span className="font-semibold">{i.nama}</span>{i.keterangan && <span className="text-muted"> · {i.keterangan}</span>}</td>
                <td className="num px-2 py-2 text-right">{nf(i.qty)}</td>
                <td className="px-2 py-2"><Money v={i.harga} /></td>
                <td className="px-2 py-2 font-semibold"><Money v={i.qty * i.harga} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={3} className="px-2.5 py-1.5 text-right text-muted">Total</td><td className="px-2 py-1.5"><Money v={row.total} /></td></tr>
            {row.terbayar > 0 && <tr><td colSpan={3} className="px-2.5 py-1.5 text-right text-muted">Sudah dibayar</td><td className="px-2 py-1.5"><Money v={row.terbayar} /></td></tr>}
            <tr className="bg-brand/10"><td colSpan={3} className="px-2.5 py-2 text-right font-bold">Sisa tagihan</td><td className="px-2 py-2 text-lg font-extrabold"><Money v={sisa} /></td></tr>
          </tfoot>
        </table>
      </div>

      {/* pembayaran */}
      <section aria-label="Pembayaran" className="flex flex-col gap-3 rounded-xl border border-line bg-canvas/60 p-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Metode pembayaran">
          {methodList.map((m) => {
            const Icon = METHOD_ICON[m.jenis] || CreditCard;
            const on = m.id === methodId;
            return (
              <button key={m.id} type="button" onClick={() => { setMethodId(m.id); if (m.jenis !== 'tunai' && amount > sisa) setAmountIn(String(sisa)); setTimeout(() => amountRef.current?.select(), 0); }}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition ${on ? 'border-ink bg-ink text-canvas' : 'border-line bg-surface hover:border-muted'}`}>
                <Icon size={15} />{m.nama}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="label min-w-[200px] flex-1">
            <span>{isTunai ? 'Uang diterima' : 'Nominal dibayar'}</span>
            <input ref={amountRef} id="kasir-diterima" className="input num py-2.5 text-right text-2xl font-bold" inputMode="numeric" value={amountIn ? nf(amount) : ''} placeholder="0"
              onChange={(e) => setAmountIn(e.target.value.replace(/[^\d]/g, ''))} onFocus={(e) => e.target.select()} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </label>
          <div className="min-w-[180px] text-right">
            <div className="text-xs text-muted">{lunas ? (kembalian ? 'Kembalian' : 'Status') : 'Sisa setelah bayar'}</div>
            <div className={`num text-2xl font-extrabold ${lunas ? 'text-ok' : 'text-bad'}`}>{lunas ? (kembalian ? rp(kembalian) : 'Lunas') : rp(sisa - nominal)}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {quick.map(([l, v]) => (
            <button key={l} type="button" className="btn btn-sm flex-1" onClick={() => { setAmountIn(String(v)); amountRef.current?.focus(); }}>{l}</button>
          ))}
        </div>
        {!isTunai && <input id="kasir-ref" className="input" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="No. referensi / catatan (mis. 4 digit akhir rekening)" />}
        <ErrorBox error={err} />
        <button id="kasir-bayar" className="btn btn-primary py-3 text-base" disabled={busy || nominal <= 0} onClick={submit}>
          <HandCoins size={18} />{busy ? 'Menyimpan…' : nominal <= 0 ? 'Isi nominal' : lunas ? `Lunasi ${rp(sisa)}` : `Catat DP ${rp(nominal)}`} <span className="kbd">F9</span>
        </button>
        <p className="text-center text-[11px] text-muted">
          {isTunai ? (laci ? `Laci terbuka otomatis${kembalian ? ` · kembalian ${rp(kembalian)}` : ''}` : 'Pembayaran tunai') : 'Pastikan dana sudah masuk di mutasi rekening.'} · kwitansi tampil setelah bayar
        </p>
      </section>
    </div>
  );
}

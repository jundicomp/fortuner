import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CheckCircle2, CloudOff, FileCheck2, Minus, Pencil, Plus, Printer, RotateCcw, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Combobox, type ComboHandle, type ComboItem } from '@/components/ui/Combobox';
import { ErrorBox, Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { paperWidth as paperWidthOf } from '@/platform/printer';
import { printReceipt, ReceiptBody, type ReceiptData, type ReceiptShop } from '@/components/Receipt';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { loadPos, newClientId, sync, useSync } from '@/lib/offline';
import { commitNo, counterKey, formatNota, peekNo } from '@/lib/nota';
import { CUT_SIZES, hargaBerlaku, hitungHarga } from '@/lib/pricing';
import { nf, rp, tglJam, ymd } from '@/lib/format';
import { priceSummary } from '@/pages/master/PriceGrid';
import type { CustomerLite, JenisHarga, OrderDetail, PriceRow, Product } from '@/types';

interface CartItem {
  key: string; product_id: string; nama: string; jenis: JenisHarga; qty: number; sisi: 1 | 2; ukuran: number; keterangan: string;
  harga: number | null; manual: boolean; tier: string; label: string; warn?: string;
}
interface Done { nomor: string; offline: boolean; receipt: ReceiptData; renomor?: string }

const AUTO_PRINT = 'fortuner-autoprint-spk';
const numIn = (s: string) => Number(String(s).replace(/[^\d]/g, '')) || 0;

/**
 * Front Office: terima desain, rapikan, buat order (nota/SPK). TIDAK menerima pembayaran;
 * pembayaran dilakukan Kasir berdasarkan nomor nota ini.
 */
export function FoPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const syncState = useSync();
  const pos = useQuery({ queryKey: ['pos'], queryFn: loadPos, staleTime: 60e3, retry: 0 });
  const today = ymd();
  const d = pos.data;

  // ---------- data turunan ----------
  const priceOf = useMemo(() => {
    const by: Record<string, PriceRow[]> = {};
    (d?.price_rows || []).forEach((r) => (by[r.product_id] ||= []).push(r));
    return (pid: string) => hargaBerlaku(by[pid] || [], today);
  }, [d, today]);
  const products = useMemo(() => (d?.products || []).map((p) => ({ ...p, harga: priceOf(p.id) })), [d, priceOf]);
  const prodById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const machineName = useMemo(() => Object.fromEntries((d?.machines || []).map((m) => [m.id, m.nama])), [d]);
  const minQty = Number(d?.settings.min_qty_banyak || 26);
  const device = d?.device && d.device.status === 'disetujui' && d.device.kode_pc ? d.device : null;

  // ---------- state ----------
  const [customerId, setCustomerId] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [draft, setDraft] = useState({ product_id: '', qty: '1', sisi: 1 as 1 | 2, ukuran: 0, keterangan: '', harga: '', manual: false });
  const [catatan, setCatatan] = useState('');
  const [desain, setDesain] = useState('');
  const [janji, setJanji] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [autoPrint, setAutoPrint] = useState(() => { try { return localStorage.getItem(AUTO_PRINT) === '1'; } catch { return false; } });
  const [newCust, setNewCust] = useState(false);
  const prodRef = useRef<ComboHandle>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  const customer: CustomerLite | undefined = d?.customers.find((c) => c.id === customerId);
  const tipe: 'reseller' | 'enduser' = customer?.tipe === 'reseller' ? 'reseller' : 'enduser';

  useEffect(() => {
    if (!d) return;
    if (!customerId || !d.customers.some((c) => c.id === customerId)) setCustomerId((d.customers.find((c) => /umum|walk/i.test(c.nama)) || d.customers[0])?.id || '');
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps

  const calc = (p: Product, qty: number, sisi: 1 | 2, ukuran: number, t = tipe) =>
    hitungHarga({ jenis: p.jenis_harga, harga: p.harga, tipe: t, qty, sisi, ukuran, minQtyBanyak: minQty });

  // harga ulang semua item (kecuali manual) saat konsumen berganti
  useEffect(() => {
    setCart((c) => c.map((it) => {
      if (it.manual) return it;
      const p = prodById[it.product_id]; if (!p) return it;
      const r = calc(p, it.qty, it.sisi, it.ukuran);
      return { ...it, harga: r.harga, tier: r.tier || '', label: r.label, warn: r.peringatan };
    }));
  }, [tipe, prodById]); // eslint-disable-line react-hooks/exhaustive-deps

  const dp = prodById[draft.product_id];
  const dQty = numIn(draft.qty);
  const dCalc = dp ? calc(dp, dQty || 1, draft.sisi, draft.ukuran) : null;
  const dManual = !!dp && (dp.jenis_harga === 'manual' || draft.manual);
  const dHarga = dManual ? (draft.harga === '' ? null : numIn(draft.harga)) : dCalc?.harga ?? null;

  const addItem = () => {
    setErr(null);
    if (!dp) { prodRef.current?.focus(); return; }
    if (dQty < 1) { qtyRef.current?.focus(); return; }
    if (dHarga == null) { toast(dp.jenis_harga === 'manual' ? 'Isi harga satuan untuk produk ini.' : `${dp.nama} belum punya harga. Hubungi admin.`, 'err'); return; }
    setCart((c) => [...c, {
      key: Math.random().toString(36).slice(2), product_id: dp.id, nama: dp.nama, jenis: dp.jenis_harga, qty: dQty, sisi: dp.jenis_harga === 'matriks' ? draft.sisi : 1,
      ukuran: draft.ukuran, keterangan: draft.keterangan.trim(), harga: dHarga, manual: dManual, tier: dManual ? 'manual' : dCalc?.tier || '',
      label: dManual ? 'Harga manual' : dCalc?.label || '', warn: dManual ? undefined : dCalc?.peringatan,
    }]);
    setDraft({ product_id: '', qty: '1', sisi: 1, ukuran: 0, keterangan: '', harga: '', manual: false });
    setTimeout(() => prodRef.current?.focus(), 0);
  };

  const setQty = (key: string, qty: number) => setCart((c) => c.map((it) => {
    if (it.key !== key) return it;
    const q = Math.max(1, qty);
    if (it.manual) return { ...it, qty: q };
    const p = prodById[it.product_id]; const r = p ? calc(p, q, it.sisi, it.ukuran) : null;
    return { ...it, qty: q, harga: r?.harga ?? it.harga, tier: r?.tier || it.tier, label: r?.label || it.label, warn: r?.peringatan };
  }));

  const total = cart.reduce((a, i) => a + (i.harga || 0) * i.qty, 0);

  const shop: ReceiptShop = { nama: d?.settings.nama_usaha || 'Fortuner', alamat: d?.settings.alamat, telp: d?.settings.telp, catatan: d?.settings.catatan_struk };
  const paperWidth = paperWidthOf(d?.device?.lebar_kertas);

  const reset = () => { setCart([]); setCatatan(''); setDesain(''); setJanji(''); setErr(null); setDone(null); setTimeout(() => prodRef.current?.focus(), 0); };

  const save = async () => {
    if (!d || !customer || !cart.length || saving) return;
    setSaving(true); setErr(null);
    const id = newClientId('ord');
    const nowIso = new Date().toISOString();
    let key = '', no = 0, nomorLokal = '';
    if (device) {
      key = counterKey(device.kode_pc, today);
      no = peekNo(key, d.counter.key === key ? d.counter.value : 0);
      nomorLokal = formatNota(d.settings.prefix_nota || 'FT', device.kode_pc, today, no);
    }
    const payload = {
      id, customer_id: customer.id, kode_pc: device?.kode_pc || '', no_urut: no, tanggal: today, created_at: nowIso, catatan: catatan.trim(), desain: desain.trim(), janji_selesai: janji,
      items: cart.map((i) => ({ product_id: i.product_id, qty: i.qty, sisi: i.sisi, ukuran: i.ukuran, keterangan: i.keterangan, harga_satuan: i.harga, harga_manual: i.manual })),
    };
    const receipt = (nomor: string, offline: boolean): ReceiptData => ({
      nomor, waktu: nowIso, customer: customer.nama, cs: user?.nama?.split(' ')[0] || '', offline, catatan: catatan.trim(), jenis: 'spk', desain: desain.trim(), janji_selesai: janji,
      items: cart.map((i) => ({ nama: i.nama, keterangan: i.keterangan, qty: i.qty, sisi: i.sisi, ukuran: i.jenis === 'cutting' ? i.ukuran : null, harga: i.harga || 0, subtotal: (i.harga || 0) * i.qty })),
      total, payments: [], sisa: total,
    });
    const finish = (r: Done) => {
      setDone(r);
      if (autoPrint) printReceipt(r.receipt, shop, paperWidth);
      qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['dashboard'] });
    };
    const saveOffline = () => {
      commitNo(key, no);
      sync.enqueue({ id, kind: 'orders.create', payload: { ...payload, dibuat_offline: true }, label: `${nomorLokal} · ${customer.nama}`, total, view: { customer: customer.nama, items: cart.map((i) => ({ nama: i.nama, keterangan: i.keterangan, qty: i.qty, harga: i.harga || 0 })) } });
      finish({ nomor: nomorLokal, offline: true, receipt: receipt(nomorLokal, true) });
    };
    try {
      if (!syncState.online) {
        if (!device) throw new ApiError('OFFLINE_NO_DEVICE', 'Tidak ada internet dan perangkat ini belum terdaftar sebagai PC kantor, jadi nota tidak bisa dibuat offline.');
        saveOffline();
      } else {
        try {
          const res = await api<OrderDetail>('orders.create', payload);
          if (key && res.order.kode_pc === device?.kode_pc) commitNo(key, res.order.no_urut);
          finish({ nomor: res.order.nomor, offline: false, receipt: receipt(res.order.nomor, false), renomor: res.renomor ? res.nomor_awal : undefined });
        } catch (e) {
          if ((e as ApiError).code === 'NETWORK' && device) { sync.markOffline(); saveOffline(); toast('Internet terputus. Nota disimpan di perangkat dan akan dikirim otomatis.', 'err'); }
          else throw e;
        }
      }
    } catch (e) { setErr(e); } finally { setSaving(false); }
  };

  // ---------- pilihan combobox ----------
  const custItems: ComboItem[] = useMemo(() => (d?.customers || []).map((c) => ({
    value: c.id, label: c.nama, hint: [c.kode && `#${c.kode}`, c.telp !== '-' && c.telp].filter(Boolean).join(' · '),
    search: `${c.nama} ${c.kode} ${c.telp}`.toLowerCase(),
    right: <span className={`pill ${c.tipe === 'reseller' ? 'pill-brand' : 'pill-mute'}`}>{c.tipe === 'reseller' ? 'Reseller' : 'End user'}</span>,
  })), [d]);
  const prodItems: ComboItem[] = useMemo(() => products.map((p) => ({
    value: p.id, label: p.nama, hint: `#${p.kode} · ${machineName[p.mesin_id] || '–'}`, search: `${p.nama} ${p.kode} ${p.kategori} ${machineName[p.mesin_id] || ''}`.toLowerCase(),
    right: p.jenis_harga !== 'manual' && !p.harga ? <span className="pill pill-bad">Tanpa harga</span> : <span className="num text-xs text-muted">{priceSummary(p.jenis_harga, p.harga)}</span>,
  })), [products, machineName]);

  // ---------- tampilan ----------
  if (pos.isLoading) return <div className="card p-6 text-sm text-muted">Memuat data front office…</div>;
  if (pos.error) return <div className="card p-6"><ErrorBox error={pos.error} /><button className="btn mt-3" onClick={() => pos.refetch()}><RotateCcw size={15} />Coba lagi</button></div>;
  if (!d) return null;

  if (done) {
    return (
      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-[1fr_320px]">
        <section className="card p-6">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${done.offline ? 'bg-warn/10 text-warn' : 'bg-ok/10 text-ok'}`}>{done.offline ? <CloudOff size={24} /> : <CheckCircle2 size={24} />}</div>
          <h1 className="mt-4 text-2xl font-extrabold">{done.offline ? 'Nota/SPK disimpan di perangkat' : 'Nota/SPK terbit'}</h1>
          <div className="num mt-2 font-mono text-3xl font-bold tracking-tight text-brand">{done.nomor}</div>
          <p className="mt-2 text-sm text-muted">
            {done.receipt.customer} · {rp(done.receipt.total)}. {done.offline ? 'Internet sedang mati: nota ada di antrian kirim dan otomatis terkirim; kasir di PC lain baru melihatnya setelah terkirim.' : 'Nota sudah masuk antrian Kasir.'}
          </p>
          {done.renomor && <div className="mt-3 flex gap-2 rounded-lg bg-warn/10 p-3 text-sm text-warn"><AlertTriangle size={16} className="shrink-0" />Nomor {done.renomor} sudah terpakai, server memberi nomor {done.nomor}.</div>}
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-ink p-4 text-canvas"><ArrowRight size={22} className="shrink-0 text-brand" /><div><div className="font-bold">Arahkan konsumen ke kasir</div><div className="text-sm opacity-70">Sebutkan nomor nota {done.nomor} untuk pembayaran.</div></div></div>
          <div className="mt-6 flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={reset} autoFocus><Plus size={16} />Order baru</button>
            <button className="btn" onClick={() => printReceipt(done.receipt, shop, paperWidth)}><Printer size={16} />Cetak nota/SPK</button>
          </div>
        </section>
        <section className="card overflow-hidden">
          <div className="border-b border-line px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted">Pratinjau nota/SPK · {paperWidth} mm</div>
          <div className="max-h-[70vh] overflow-y-auto bg-white p-4"><ReceiptBody d={done.receipt} shop={shop} width={paperWidth} /></div>
        </section>
      </div>
    );
  }

  return (
    <>
      {(d.fromCache || !device) && (
        <div className="mb-4 flex flex-col gap-2">
          {d.fromCache && <div className="flex gap-2 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn"><CloudOff size={16} className="mt-0.5 shrink-0" />Offline: memakai data kasir tersimpan {d.cached_at ? `(${tglJam(d.cached_at)})` : ''}. Nota disimpan di perangkat lalu dikirim otomatis.</div>}
          {!device && <div className="flex gap-2 rounded-lg border border-line bg-sunk px-3 py-2 text-xs text-muted"><AlertTriangle size={15} className="mt-px shrink-0" />Perangkat ini belum terdaftar sebagai PC kantor: nota dinomori server (kode {d.settings.kode_pc_web || 'W'}) dan tidak bisa dibuat saat offline.</div>}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* konsumen */}
          <section className="card p-4">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Konsumen" className="min-w-[220px] flex-1">
                <Combobox id="fo-customer" items={custItems} value={customerId} onChange={setCustomerId} placeholder="Cari nama, kode, atau telepon…"
                  footer={<button className="btn btn-ghost btn-sm w-full justify-start" disabled={!syncState.online} onClick={() => setNewCust(true)}><UserPlus size={14} />Konsumen baru{!syncState.online ? ' (butuh internet)' : ''}</button>} />
              </Field>
              <div className="flex items-center gap-2 pb-1.5 text-sm">
                <span className="text-muted">Harga</span>
                <span className={`pill ${tipe === 'reseller' ? 'pill-brand' : 'pill-mute'}`}>{tipe === 'reseller' ? 'Reseller' : 'End user'}</span>
              </div>
            </div>
          </section>

          {/* tambah item */}
          <section className="card p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-12">
              <Field label="Produk" className="col-span-2 sm:col-span-6">
                <Combobox ref={prodRef} id="fo-product" items={prodItems} value={draft.product_id} placeholder="Cari kode atau nama produk…"
                  onChange={(v) => setDraft((x) => ({ ...x, product_id: v, sisi: 1, ukuran: 0, harga: '', manual: false }))} autoFocusNext={() => setTimeout(() => qtyRef.current?.select(), 0)} />
              </Field>
              <Field label="Jumlah" className="col-span-1 sm:col-span-2">
                <input ref={qtyRef} id="fo-qty" className="input num text-right" inputMode="numeric" value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: e.target.value.replace(/[^\d]/g, '') })} onKeyDown={(e) => e.key === 'Enter' && addItem()} />
              </Field>
              <div className="col-span-1 sm:col-span-4">
                {dp?.jenis_harga === 'cutting' ? (
                  <Field label="Ukuran stiker">
                    <select id="fo-ukuran" className="input" value={draft.ukuran} onChange={(e) => setDraft({ ...draft, ukuran: Number(e.target.value) })}>{CUT_SIZES.map((s, i) => <option key={s} value={i}>{s}</option>)}</select>
                  </Field>
                ) : (
                  <div className="label"><span>Sisi</span>
                    <div className="flex overflow-hidden rounded-lg border border-line" role="group" aria-label="Sisi">
                      {[1, 2].map((n) => (
                        <button key={n} type="button" disabled={dp?.jenis_harga !== 'matriks'} onClick={() => setDraft({ ...draft, sisi: n as 1 | 2 })}
                          className={`flex-1 px-2 py-2 text-xs font-bold transition disabled:opacity-40 ${draft.sisi === n ? 'bg-brand text-brand-ink' : 'bg-surface text-muted hover:text-ink'}`}>{n === 1 ? '1 sisi' : '2 sisi (BB)'}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Field label="Keterangan" className="col-span-2 sm:col-span-6">
                <input id="fo-ket" className="input" placeholder="mis. brosur A4, cover buku" value={draft.keterangan} onChange={(e) => setDraft({ ...draft, keterangan: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addItem()} />
              </Field>
              <Field label={<span className="flex items-center justify-between">Harga satuan
                {dp && dp.jenis_harga !== 'manual' && d.can_manual && <button type="button" className="font-semibold text-brand" onClick={() => setDraft({ ...draft, manual: !draft.manual, harga: draft.manual ? '' : String(dCalc?.harga ?? '') })}>{draft.manual ? 'Pakai matriks' : <span className="inline-flex items-center gap-1"><Pencil size={11} />Ubah</span>}</button>}
              </span>} className="col-span-1 sm:col-span-3">
                <input id="fo-harga" className={`input num text-right ${dManual ? '' : 'bg-sunk'}`} inputMode="numeric" readOnly={!dManual} placeholder={dManual ? 'isi harga' : ''}
                  value={dManual ? draft.harga : dHarga == null ? '' : nf(dHarga)} onChange={(e) => setDraft({ ...draft, harga: e.target.value.replace(/[^\d]/g, '') })} onKeyDown={(e) => e.key === 'Enter' && addItem()} />
              </Field>
              <div className="col-span-1 flex items-end sm:col-span-3">
                <button className="btn btn-primary w-full" onClick={addItem} disabled={!dp}><Plus size={16} />Tambah</button>
              </div>
            </div>
            {dp && (
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-sunk px-3 py-2 text-xs">
                <span className="pill pill-brand">{dManual ? 'Harga manual' : dCalc?.label}</span>
                <span className="text-muted">{machineName[dp.mesin_id] || '–'}{dp.jenis_harga === 'matriks' ? ` · klik ${nf((dQty || 1) * draft.sisi)}` : ''}</span>
                {!dManual && dCalc?.peringatan && <span className="text-warn">{dCalc.peringatan}</span>}
                <span className="num ml-auto text-sm">{nf(dQty || 0)} × {dHarga == null ? '–' : nf(dHarga)} = <b>{dHarga == null ? '–' : rp(dHarga * (dQty || 0))}</b></span>
              </div>
            )}
          </section>

          {/* keranjang */}
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <h2 className="text-sm font-bold">Isi nota <span className="font-normal text-muted">({cart.length} item)</span></h2>
              {cart.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setCart([])}><Trash2 size={14} />Kosongkan</button>}
            </div>
            {!cart.length ? <div className="px-4 py-10 text-center text-sm text-muted">Pilih produk di atas lalu tekan Enter atau Tambah.</div> : (
              <ul className="divide-y divide-line">
                {cart.map((it) => (
                  <li key={it.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                    <div className="min-w-[180px] flex-1">
                      <div className="font-semibold">{it.nama}{it.sisi === 2 ? <span className="text-muted"> · BB</span> : ''}{it.jenis === 'cutting' ? <span className="text-muted"> · {CUT_SIZES[it.ukuran]}</span> : ''}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        <span className={`pill ${it.manual ? 'pill-warn' : 'pill-mute'}`}>{it.label}</span>{it.keterangan && <span>{it.keterangan}</span>}{it.warn && <span className="text-warn">{it.warn}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button className="btn btn-sm px-1.5" onClick={() => setQty(it.key, it.qty - 1)} aria-label="Kurangi"><Minus size={13} /></button>
                      <input aria-label={`Jumlah ${it.nama}`} className="input num w-20 px-2 py-1.5 text-center" inputMode="numeric" value={it.qty} onChange={(e) => setQty(it.key, numIn(e.target.value))} />
                      <button className="btn btn-sm px-1.5" onClick={() => setQty(it.key, it.qty + 1)} aria-label="Tambah"><Plus size={13} /></button>
                    </div>
                    <div className="num w-24 text-right text-xs text-muted">@ {nf(it.harga)}</div>
                    <div className="num w-28 text-right font-bold">{rp((it.harga || 0) * it.qty)}</div>
                    <button className="btn btn-ghost btn-sm px-1.5 text-bad" onClick={() => setCart((c) => c.filter((x) => x.key !== it.key))} aria-label={`Hapus ${it.nama}`}><Trash2 size={15} /></button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* pembayaran */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <section className="card flex flex-col gap-4 p-4">
            <div className="flex items-baseline justify-between border-b-2 border-ink pb-3">
              <span className="text-sm font-bold">Total tagihan</span>
              <span className="num text-3xl font-extrabold">{rp(total)}</span>
            </div>
            <Field label="Sumber / nama file desain" hint="Untuk operator: dari mana file diambil.">
              <input id="fo-desain" className="input" value={desain} onChange={(e) => setDesain(e.target.value)} placeholder="mis. WA 0812…, flashdisk, brosur_final.pdf" />
            </Field>
            <Field label="Janji selesai (opsional)">
              <input id="fo-janji" type="datetime-local" className="input" value={janji} onChange={(e) => setJanji(e.target.value)} />
            </Field>
            <Field label="Catatan untuk produksi / kasir"><textarea id="fo-catatan" className="input min-h-[64px]" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="mis. potong rapi, laminating doff, diambil besok" /></Field>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" checked={autoPrint} onChange={(e) => { setAutoPrint(e.target.checked); try { localStorage.setItem(AUTO_PRINT, e.target.checked ? '1' : '0'); } catch { /* abaikan */ } }} />
              Cetak nota/SPK setelah terbit
            </label>
            <ErrorBox error={err} />
            <button className="btn btn-primary py-3 text-base" onClick={save} disabled={!cart.length || !customer || saving}>
              <FileCheck2 size={18} />{saving ? 'Menyimpan…' : syncState.online ? 'Terbitkan nota / SPK' : 'Terbitkan (offline)'}
            </button>
            <p className="text-center text-[11px] text-muted">Pembayaran diterima di menu Kasir.{device ? ` PC ${device.kode_pc} · nota berikutnya ${formatNota(d.settings.prefix_nota || 'FT', device.kode_pc, today, peekNo(counterKey(device.kode_pc, today), d.counter.key === counterKey(device.kode_pc, today) ? d.counter.value : 0))}` : ''}</p>
          </section>
        </aside>
      </div>
      {newCust && <NewCustomerModal onClose={() => setNewCust(false)} onCreated={async (id) => { await qc.invalidateQueries({ queryKey: ['pos'] }); setCustomerId(id); setNewCust(false); toast('Konsumen ditambahkan'); }} />}
    </>
  );
}

function NewCustomerModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [f, setF] = useState({ nama: '', telp: '', tipe: 'enduser' });
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setErr(null);
    try { const r = await api<{ id: string }>('master.save', { table: 'customers', record: f }); onCreated(r.id); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} size="sm" title="Konsumen baru"
      footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={busy || !f.nama.trim()} onClick={save}>Simpan</button></>}>
      <div className="flex flex-col gap-3">
        <Field label="Nama"><input id="nc-nama" className="input" autoFocus value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value })} /></Field>
        <Field label="Telepon / WA"><input id="nc-telp" className="input" inputMode="tel" value={f.telp} onChange={(e) => setF({ ...f, telp: e.target.value })} /></Field>
        <Field label="Tipe harga">
          <select id="nc-tipe" className="input" value={f.tipe} onChange={(e) => setF({ ...f, tipe: e.target.value })}><option value="enduser">End user</option><option value="reseller">Reseller</option></select>
        </Field>
        <ErrorBox error={err} />
      </div>
    </Modal>
  );
}

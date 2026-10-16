import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, HandCoins, Package, Plus, Receipt, Tags, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/table/DataTable';
import { DateRangeFilter, periodeLabel, rangeFor, type DateRange } from '@/components/table/DateRangeFilter';
import { ErrorBox, Field, PageHeader, StatusPill, Switch } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { addDays, nf, rp, tgl, ymd } from '@/lib/format';
import { SumberKas, useKasSaldo } from '@/components/SumberKas';
import { PurchaseForm, lastBuy, usePurchases } from '@/pages/stok/PembelianPage';
import { useStockMeta } from '@/pages/stok/stokApi';
import { BillModal, billRow, type Bill } from './HutangPage';

export interface ExpenseMeta {
  categories: { id: string; nama: string; jenis: string; aktif: boolean }[];
  suppliers: { id: string; nama: string; bahan: string }[];
  products: { id: string; kode: string; nama: string; satuan: string }[];
  machines: { id: string; nama: string }[];
  payment_methods: { id: string; nama: string; jenis: string }[];
}
interface Expense {
  id: string; tanggal: string; nota: string; supplier_id: string; supplier: string; kategori_id: string; kategori: string; kategori_jenis: string; product_id: string; item: string;
  qty: number; satuan: string; harga: number; total: number; isi_per_satuan: number | null; cara_bayar: 'lunas' | 'hutang'; purchase_id?: string; metode: string; sisa_hutang: number; keterangan: string; oleh: string; created_at: string;
}
const JENIS: Record<string, string> = { bahan: 'Bahan', operasional: 'Operasional', gaji: 'Gaji', aset: 'Aset', klik: 'Klik mesin', lain: 'Lain-lain' };
const numIn = (s: string) => Number(String(s).replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.')) || 0;

export const useExpenseMeta = () => useQuery({ queryKey: ['expense-meta'], queryFn: () => api<ExpenseMeta>('expense.meta'), staleTime: 60e3 });

/** Pengganti sheet "Kredit": semua uang keluar untuk pembelian bahan & operasional. */
export function PengeluaranPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const meta = useExpenseMeta();
  const [range, setRange] = useState<DateRange>(rangeFor('bulan_ini'));
  const q = useQuery({ queryKey: ['expenses', range.from, range.to], queryFn: () => api<Expense[]>('expense.list', { from: range.from, to: range.to }) });
  const [form, setForm] = useState<'' | 'pilih' | 'umum' | 'bahan' | 'bon'>('');
  const [billId, setBillId] = useState('');
  const kas = useKasSaldo();
  const [cats, setCats] = useState(false);
  const [del, setDel] = useState<Expense | null>(null);
  const [alasan, setAlasan] = useState('');
  const remove = useMutation({
    mutationFn: () => api('expense.delete', { id: del!.id, alasan }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['bills'] }); qc.invalidateQueries({ queryKey: ['kas-saldo'] }); toast('Pengeluaran dihapus'); setDel(null); setAlasan(''); },
  });
  const rows = useMemo(() => [...(q.data || [])].sort((a, b) => (b.tanggal + b.created_at).localeCompare(a.tanggal + a.created_at)), [q.data]);
  const total = rows.reduce((a, r) => a + r.total, 0);
  const lunas = rows.filter((r) => r.cara_bayar === 'lunas').reduce((a, r) => a + r.total, 0);
  const perJenis = Object.entries(rows.reduce<Record<string, number>>((m, r) => { m[r.kategori_jenis] = (m[r.kategori_jenis] || 0) + r.total; return m; }, {})).sort((a, b) => b[1] - a[1]);

  const cols: ColumnDef<Expense, any>[] = [
    { accessorKey: 'tanggal', header: 'Tanggal', cell: (c) => <span className="num whitespace-nowrap">{tgl(c.getValue())}</span> },
    { accessorKey: 'item', header: 'Barang / keperluan', cell: (c) => <span className="font-semibold">{c.getValue()}{c.row.original.purchase_id && <span className="pill pill-brand ml-1.5 align-middle">Pembelian bahan</span>}{c.row.original.nota && <span className="block font-mono text-[11px] font-normal text-muted">{c.row.original.nota}</span>}</span>, meta: { hideOnCard: true } },
    { accessorKey: 'kategori', header: 'Kategori', meta: { filter: 'select' } },
    { accessorKey: 'supplier', header: 'Supplier', meta: { filter: 'select' } },
    { id: 'jumlah', accessorFn: (r) => `${nf(r.qty)} ${r.satuan}`, header: 'Jumlah', meta: { align: 'right' } },
    { accessorKey: 'harga', header: 'Harga', meta: { money: true, align: 'right', hideOnCard: true }, cell: (c) => nf(c.getValue()) },
    { accessorKey: 'total', header: 'Total', meta: { align: 'right', total: true, money: true }, cell: (c) => <b>{nf(c.getValue())}</b> },
    { id: 'bayar', accessorFn: (r) => (r.cara_bayar === 'hutang' ? 'Hutang' : r.metode), header: 'Bayar', meta: { filter: 'select' },
      cell: (c) => c.row.original.cara_bayar === 'hutang'
        ? <span className={`pill ${c.row.original.sisa_hutang > 0 ? 'pill-warn' : 'pill-ok'}`}>{c.row.original.sisa_hutang > 0 ? `Hutang · sisa ${nf(c.row.original.sisa_hutang)}` : 'Hutang lunas'}</span>
        : <span className="text-xs">{c.getValue()}</span> },
    { accessorKey: 'oleh', header: 'Dicatat', meta: { filter: 'select', hideOnCard: true } },
    ...(can('pengeluaran', 'hapus') ? [{ id: 'aksi', header: '', enableSorting: false, meta: { noExport: true, hideOnCard: true }, cell: (c: { row: { original: Expense } }) => c.row.original.purchase_id ? null : <button className="btn btn-ghost btn-sm px-1.5 text-bad" aria-label="Hapus" onClick={(e) => { e.stopPropagation(); setDel(c.row.original); }}><Trash2 size={14} /></button> } as ColumnDef<Expense, any>] : []),
  ];

  return (
    <>
      <PageHeader title="Pengeluaran" desc="Semua uang keluar: pembelian bahan, bayar bon supplier, dan pengeluaran umum. Setiap pembayaran dipilih sumber kas/rekeningnya."
        actions={<>
          {can('pengeluaran', 'ubah') && <button className="btn" onClick={() => setCats(true)}><Tags size={16} />Kategori</button>}
          {can('pengeluaran', 'tambah') && <button className="btn btn-primary" onClick={() => setForm('pilih')}><Plus size={16} />Catat pengeluaran</button>}
        </>} />
      {!!kas.data?.length && (
        <section className="mb-3 flex flex-wrap items-center gap-2 text-sm" aria-label="Saldo kas & rekening">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Saldo saat ini</span>
          {kas.data.filter((m) => m.jenis !== 'edc').map((m) => <span key={m.id} className="rounded-lg border border-line bg-surface px-2.5 py-1">{m.nama} <b className={`num ${m.saldo < 0 ? 'text-bad' : ''}`}>{rp(m.saldo)}</b></span>)}
        </section>
      )}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <section className="card tint tint-orange p-4"><div className="text-xs font-bold uppercase tracking-wider text-muted">Total periode</div><div className="num mt-1 text-2xl font-extrabold">{rp(total)}</div><div className="text-xs text-muted">{rows.length} transaksi</div></section>
        <section className="card tint tint-blue p-4"><div className="text-xs font-bold uppercase tracking-wider text-muted">Dibayar lunas / hutang</div><div className="num mt-1 text-lg font-bold">{rp(lunas)} <span className="text-sm font-normal text-muted">/ {rp(total - lunas)}</span></div></section>
        <section className="card tint tint-purple p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted">Per jenis</div>
          <ul className="mt-1.5 flex flex-col gap-1 text-sm">{perJenis.slice(0, 4).map(([j, v]) => <li key={j} className="flex justify-between"><span>{JENIS[j] || j}</span><span className="num font-semibold">{nf(v)}</span></li>)}{!perJenis.length && <li className="text-muted">–</li>}</ul>
        </section>
      </div>
      <DataTable<Expense> data={rows} loading={q.isLoading} columns={cols} title="Pengeluaran" storageKey="pengeluaran" canExport={can('pengeluaran', 'ekspor')}
        exportSubtitle={periodeLabel(range.from, range.to)} toolbar={<DateRangeFilter value={range} onChange={setRange} id="exp-range" />} searchPlaceholder="Cari barang, nota, supplier…"
        cardTitle={(r) => <span className="flex justify-between gap-2"><span>{r.item}</span><span className="num text-sm">{tgl(r.tanggal)}</span></span>} emptyText="Belum ada pengeluaran di periode ini." />
      {form === 'pilih' && <JenisPicker onPick={setForm} onClose={() => setForm('')} />}
      {form === 'umum' && meta.data && <ExpenseForm meta={meta.data} onClose={() => setForm('')} />}
      {form === 'bahan' && <BahanForm onClose={() => setForm('')} />}
      {form === 'bon' && <BonPicker onPick={(id) => { setBillId(id); setForm(''); }} onClose={() => setForm('')} />}
      {billId && <BonPay id={billId} onClose={() => setBillId('')} />}
      {cats && meta.data && <CategoryModal cats={meta.data.categories} onClose={() => setCats(false)} />}
      <Modal open={!!del} onClose={() => setDel(null)} size="sm" title="Hapus pengeluaran?" subtitle={del ? `${del.item} · ${rp(del.total)} · ${tgl(del.tanggal)}` : undefined}
        footer={<><button className="btn" onClick={() => setDel(null)}>Batal</button><button className="btn btn-danger" disabled={!alasan.trim() || remove.isPending} onClick={() => remove.mutate()}>Hapus</button></>}>
        <Field label="Alasan (tercatat di log)"><input id="exp-alasan" className="input" value={alasan} onChange={(e) => setAlasan(e.target.value)} /></Field>
        <div className="mt-3"><ErrorBox error={remove.error} /></div>
      </Modal>
    </>
  );
}

function ExpenseForm({ meta, onClose }: { meta: ExpenseMeta; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  // Pembelian bahan berstok punya form sendiri; di sini hanya pengeluaran umum.
  const cats = meta.categories.filter((c) => c.aktif !== false && c.jenis !== 'bahan');
  const [f, setF] = useState({
    tanggal: ymd(), kategori_id: cats[0]?.id || '', item: '', nota: '', supplier_id: '', product_id: '', isi: '', qty: '1', satuan: '', harga: '', mesin_id: '',
    cara_bayar: 'lunas' as 'lunas' | 'hutang', method_id: meta.payment_methods.find((m) => m.jenis === 'tunai')?.id || '', jatuh_tempo: addDays(ymd(), 30), keterangan: '',
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const jenis = cats.find((c) => c.id === f.kategori_id)?.jenis;
  // bahan & klik: jumlah × harga per satuan. Pengeluaran umum (operasional, gaji, sewa, aset, lain-lain): cukup nominal.
  const [rinciManual, setRinci] = useState<boolean | null>(null);
  const rinci = rinciManual ?? (jenis === 'bahan' || jenis === 'klik');
  const qty = rinci ? numIn(f.qty) : 1, harga = numIn(f.harga), total = Math.round(qty * harga), isi = numIn(f.isi);
  const prod = meta.products.find((p) => p.id === f.product_id);
  const save = useMutation({
    mutationFn: () => api<{ harga_beli_baru: number | null }>('expense.save', { expense: { ...f, qty, harga, satuan: rinci ? f.satuan : '', isi_per_satuan: isi || null, product_id: jenis === 'bahan' ? f.product_id : '' } }),
    onSuccess: (r) => {
      ['expenses', 'bills', 'products', 'dashboard', 'kas-saldo'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast(r.harga_beli_baru != null ? `Tersimpan. Harga beli ${prod?.nama} jadi ${nf(r.harga_beli_baru)}/${prod?.satuan || 'lembar'}` : 'Pengeluaran dicatat');
      onClose();
    },
  });
  return (
    <Modal open onClose={onClose} size="lg" title="Pengeluaran umum" subtitle="Di luar pembelian bahan & bayar bon supplier"
      footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={save.isPending || !f.item || !total || (f.cara_bayar === 'lunas' && !f.method_id)} onClick={() => save.mutate()}>Simpan {total ? rp(total) : ''}</button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
        <Field label="Tanggal" className="sm:col-span-2"><input id="ex-tanggal" type="date" className="input" max={ymd()} value={f.tanggal} onChange={(e) => set('tanggal', e.target.value)} /></Field>
        <Field label="Kategori" className="sm:col-span-4" hint={jenis && !['bahan', 'klik'].includes(jenis) ? 'Pengeluaran umum: cukup isi keperluan dan nominalnya.' : undefined}>
          <select id="ex-kategori" className="input" value={f.kategori_id} onChange={(e) => { set('kategori_id', e.target.value); setRinci(null); }}>
            {Object.entries(JENIS).map(([j, label]) => { const list = cats.filter((c) => c.jenis === j); return list.length ? <optgroup key={j} label={label}>{list.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}</optgroup> : null; })}
            {cats.filter((c) => !JENIS[c.jenis]).map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}
          </select>
        </Field>
        <Field label="Barang / keperluan" className="sm:col-span-4"><input id="ex-item" className="input" autoFocus value={f.item} onChange={(e) => set('item', e.target.value)} placeholder={rinci ? 'mis. Art carton 260 A3+, film DTF' : 'mis. Listrik Oktober, gaji Riska, sewa ruko'} /></Field>
        <Field label={rinci ? 'No. nota supplier' : 'No. bukti (opsional)'} className="sm:col-span-2"><input id="ex-nota" className="input" value={f.nota} onChange={(e) => set('nota', e.target.value)} /></Field>
        <Field label={rinci ? 'Supplier' : 'Dibayar ke (opsional)'} className="sm:col-span-3" hint={!rinci && f.cara_bayar === 'hutang' ? 'Wajib dipilih bila dicatat sebagai hutang.' : undefined}>
          <select id="ex-supplier" className="input" value={f.supplier_id} onChange={(e) => set('supplier_id', e.target.value)}><option value="">{rinci ? '– tanpa supplier –' : '– tidak perlu –'}</option>{meta.suppliers.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}</select>
        </Field>
        {(jenis === 'operasional' || jenis === 'klik' || jenis === 'bahan' || f.mesin_id) ? (
          <Field label="Untuk mesin (opsional)" className="sm:col-span-3">
          <select id="ex-mesin" className="input" value={f.mesin_id} onChange={(e) => set('mesin_id', e.target.value)}><option value="">–</option>{meta.machines.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}</select>
        </Field>
        ) : <div className="hidden sm:col-span-3 sm:block" />}
        {rinci ? (
          <>
            <Field label="Jumlah" className="sm:col-span-2"><input id="ex-qty" className="input num text-right" inputMode="decimal" value={f.qty} onChange={(e) => set('qty', e.target.value)} /></Field>
            <Field label="Satuan" className="sm:col-span-1"><input id="ex-satuan" className="input" value={f.satuan} onChange={(e) => set('satuan', e.target.value)} placeholder="rim" /></Field>
            <Field label="Harga per satuan" className="sm:col-span-3"><input id="ex-harga" className="input num text-right" inputMode="numeric" value={f.harga ? nf(numIn(f.harga)) : ''} onChange={(e) => set('harga', e.target.value)} /></Field>
          </>
        ) : (
          <Field label="Nominal (Rp)" className="sm:col-span-6"><input id="ex-harga" className="input num py-2.5 text-right text-lg font-bold" inputMode="numeric" value={f.harga ? nf(numIn(f.harga)) : ''} onChange={(e) => set('harga', e.target.value)} placeholder="0" /></Field>
        )}
        {jenis !== 'bahan' && jenis !== 'klik' && (
          <button type="button" className="-mt-2 justify-self-start text-xs font-semibold text-brand sm:col-span-6" onClick={() => setRinci(!rinci)}>{rinci ? 'Cukup isi nominal saja' : 'Isi dengan jumlah × harga satuan'}</button>
        )}

        {jenis === 'bahan' && <p className="rounded-lg bg-sunk px-3 py-2 text-xs text-muted sm:col-span-6">Bahan yang dihitung stoknya (kertas, stiker, film) sebaiknya dicatat lewat menu <b className="text-ink">Pembelian Bahan</b> supaya stok dan HPP ikut terhitung. Yang dicatat di sini masuk HPP sebagai "bahan di luar stok".</p>}
        {jenis === 'klik' && <p className="rounded-lg bg-sunk px-3 py-2 text-xs text-muted sm:col-span-6">Tagihan klik/sewa mesin dari vendor. Biaya klik sudah masuk HPP per nota (dari tarif di Master Mesin), jadi tagihan ini melunasi hutang biaya klik, tidak dihitung dua kali.</p>}
        {jenis === 'bahan' && (
          <div className="rounded-xl border border-brand/30 bg-brand/5 p-4 sm:col-span-6">
            <div className="text-sm font-bold">Perbarui harga beli produk (opsional)</div>
            <p className="mt-0.5 text-xs text-muted">Hubungkan ke produk jual dan isi berapa lembar per satuan beli. Harga beli per lembar dipakai menghitung laba nota mulai tanggal ini; nota lama tidak berubah.</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Produk jual" className="sm:col-span-2">
                <select id="ex-produk" className="input" value={f.product_id} onChange={(e) => set('product_id', e.target.value)}><option value="">– tidak dihubungkan –</option>{meta.products.map((p) => <option key={p.id} value={p.id}>{p.nama} (#{p.kode})</option>)}</select>
              </Field>
              <Field label={`Isi per ${f.satuan || 'satuan'} (lembar)`}><input id="ex-isi" className="input num text-right" inputMode="numeric" value={f.isi} onChange={(e) => set('isi', e.target.value)} placeholder="500" disabled={!f.product_id} /></Field>
            </div>
            {prod && isi > 0 && harga > 0 && <div className="mt-2 text-sm">Harga beli baru: <b className="num">{rp(Math.round((harga / isi) * 100) / 100)}</b> per {prod.satuan || 'lembar'}</div>}
          </div>
        )}

        <div className="flex gap-2 sm:col-span-6" role="group" aria-label="Cara bayar">
          {(['lunas', 'hutang'] as const).map((k) => (
            <button key={k} type="button" onClick={() => set('cara_bayar', k)} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${f.cara_bayar === k ? 'border-brand bg-brand text-brand-ink' : 'border-line hover:border-muted'}`}>{k === 'lunas' ? 'Dibayar lunas' : 'Hutang / tempo'}</button>
          ))}
        </div>
        {f.cara_bayar === 'lunas' ? (
          <div className="sm:col-span-6"><SumberKas id="ex-metode" value={f.method_id} onChange={(v) => set('method_id', v)} nominal={total} /></div>
        ) : (
          <Field label="Jatuh tempo" className="sm:col-span-3" hint={!f.supplier_id ? 'Pilih supplier dulu.' : undefined}><input id="ex-jt" type="date" className="input" value={f.jatuh_tempo} onChange={(e) => set('jatuh_tempo', e.target.value)} /></Field>
        )}
        <Field label="Catatan" className={f.cara_bayar === 'lunas' ? 'sm:col-span-6' : 'sm:col-span-3'}><input id="ex-ket" className="input" value={f.keterangan} onChange={(e) => set('keterangan', e.target.value)} /></Field>
        <div className="flex items-baseline justify-between rounded-lg bg-sunk px-4 py-3 sm:col-span-6"><span className="text-sm font-semibold">Total</span><span className="num text-2xl font-extrabold">{rp(total)}</span></div>
        <div className="sm:col-span-6"><ErrorBox error={save.error} /></div>
      </div>
    </Modal>
  );
}

type Jenis = 'umum' | 'bahan' | 'bon';
/** Langkah 1: pilih sifat pengeluaran. */
function JenisPicker({ onPick, onClose }: { onPick: (j: Jenis) => void; onClose: () => void }) {
  const { can } = useAuth();
  const opts: { k: Jenis; icon: typeof Package; title: string; desc: string; ok: boolean }[] = [
    { k: 'bahan', icon: Package, title: 'Pembelian bahan', desc: 'Kertas, stiker, film, tinta… stok bertambah & HPP ikut terhitung. Bisa lunas atau bon.', ok: can('pembelian', 'tambah') },
    { k: 'bon', icon: HandCoins, title: 'Bayar tagihan / bon supplier', desc: 'Melunasi atau mencicil nota bahan yang dulu dicatat sebagai hutang.', ok: can('hutang', 'ubah') },
    { k: 'umum', icon: Receipt, title: 'Pengeluaran umum', desc: 'Listrik, gaji, sewa, konsumsi, servis, ATK, tagihan klik… di luar pembelian bahan & bon.', ok: can('pengeluaran', 'tambah') },
  ];
  return (
    <Modal open onClose={onClose} title="Catat pengeluaran" subtitle="Pilih jenis pengeluaran">
      <div className="flex flex-col gap-2">
        {opts.filter((o) => o.ok).map((o) => (
          <button key={o.k} id={`exp-jenis-${o.k}`} type="button" onClick={() => onPick(o.k)} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left hover:border-brand hover:bg-brand/5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand"><o.icon size={20} /></span>
            <span className="flex-1"><b className="block text-sm">{o.title}</b><span className="text-xs text-muted">{o.desc}</span></span>
            <ChevronRight size={18} className="text-muted" />
          </button>
        ))}
      </div>
    </Modal>
  );
}

function BahanForm({ onClose }: { onClose: () => void }) {
  const meta = useStockMeta();
  const all = usePurchases();
  if (!meta.data) return null;
  return <PurchaseForm meta={meta.data} last={lastBuy(all.data)} onClose={onClose} />;
}

const useOpenBills = () => useQuery({ queryKey: ['bills', false], queryFn: () => api<Bill[]>('bills.list', { semua: false }) });

/** Langkah 2 (bon): pilih nota supplier yang masih ada sisa. */
function BonPicker({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const q = useOpenBills();
  const rows = (q.data || []).map((b) => billRow(b)).filter((b) => b.sisa > 0).sort((a, b) => a.jatuh_tempo.localeCompare(b.jatuh_tempo));
  return (
    <Modal open onClose={onClose} title="Bayar tagihan / bon supplier" subtitle={rows.length ? `${rows.length} bon belum lunas · total ${rp(rows.reduce((a, r) => a + r.sisa, 0))}` : undefined}>
      {q.isLoading ? <p className="text-sm text-muted">Memuat…</p> : !rows.length ? <p className="text-sm text-muted">Tidak ada bon supplier yang belum lunas.</p> : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {rows.map((b) => (
            <li key={b.id}><button type="button" id={`bon-${b.id}`} onClick={() => onPick(b.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-sunk">
              <span className="flex-1 text-sm"><b>{b.supplier}</b> <span className="text-muted">· {b.keterangan}</span>{b.nota && <span className="block font-mono text-[11px] text-muted">{b.nota}</span>}
                <span className={`block text-[11px] ${b.hari < 0 ? 'font-bold text-bad' : 'text-muted'}`}>Jatuh tempo {tgl(b.jatuh_tempo)}{b.hari < 0 ? ` · lewat ${-b.hari} hari` : ''}</span></span>
              <span className="text-right"><span className="block text-[11px] text-muted">Sisa</span><b className="num text-sm text-bad">{rp(b.sisa)}</b></span>
              <ChevronRight size={16} className="text-muted" />
            </button></li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function BonPay({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useOpenBills();
  const b = (q.data || []).find((x) => x.id === id);
  return b ? <BillModal bill={billRow(b)} onClose={onClose} /> : null;
}

function CategoryModal({ cats, onClose }: { cats: ExpenseMeta['categories']; onClose: () => void }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<{ id?: string; nama: string; jenis: string; aktif: boolean } | null>(null);
  const save = useMutation({
    mutationFn: () => api('expense.category.save', { category: edit }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expense-meta'] }); setEdit(null); },
  });
  return (
    <Modal open onClose={onClose} title="Kategori pengeluaran" subtitle="Jenis menentukan cara laporan: bahan masuk HPP, operasional & gaji jadi beban, klik mesin melunasi hutang biaya klik, aset tidak mengurangi laba.">
      <ul className="divide-y divide-line rounded-xl border border-line">
        {cats.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="flex-1 font-semibold">{c.nama}</span><span className="pill pill-mute">{JENIS[c.jenis] || c.jenis}</span><StatusPill aktif={c.aktif !== false} />
            <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...c, aktif: c.aktif !== false })}>Ubah</button>
          </li>
        ))}
      </ul>
      {!edit && <button className="btn mt-3" onClick={() => setEdit({ nama: '', jenis: 'operasional', aktif: true })}><Plus size={15} />Tambah kategori</button>}
      {edit && (
        <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-line p-4 sm:grid-cols-2">
          <Field label="Nama"><input id="cat-nama" className="input" value={edit.nama} onChange={(e) => setEdit({ ...edit, nama: e.target.value })} /></Field>
          <Field label="Jenis"><select id="cat-jenis" className="input" value={edit.jenis} onChange={(e) => setEdit({ ...edit, jenis: e.target.value })}>{Object.entries(JENIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <div className="sm:col-span-2"><Switch id="cat-aktif" checked={edit.aktif} onChange={(v) => setEdit({ ...edit, aktif: v })} label="Aktif" /></div>
          <div className="sm:col-span-2"><ErrorBox error={save.error} /></div>
          <div className="flex justify-end gap-2 sm:col-span-2"><button className="btn" onClick={() => setEdit(null)}>Batal</button><button className="btn btn-primary" disabled={!edit.nama.trim() || save.isPending} onClick={() => save.mutate()}>Simpan</button></div>
        </div>
      )}
    </Modal>
  );
}

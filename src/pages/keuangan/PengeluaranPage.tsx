import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Tags, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/table/DataTable';
import { DateRangeFilter, rangeFor, type DateRange } from '@/components/table/DateRangeFilter';
import { ErrorBox, Field, PageHeader, StatusPill, Switch } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { addDays, nf, rp, tgl, ymd } from '@/lib/format';

export interface ExpenseMeta {
  categories: { id: string; nama: string; jenis: string; aktif: boolean }[];
  suppliers: { id: string; nama: string; bahan: string }[];
  products: { id: string; kode: string; nama: string; satuan: string }[];
  machines: { id: string; nama: string }[];
  payment_methods: { id: string; nama: string; jenis: string }[];
}
interface Expense {
  id: string; tanggal: string; nota: string; supplier_id: string; supplier: string; kategori_id: string; kategori: string; kategori_jenis: string; product_id: string; item: string;
  qty: number; satuan: string; harga: number; total: number; isi_per_satuan: number | null; cara_bayar: 'lunas' | 'hutang'; metode: string; sisa_hutang: number; keterangan: string; oleh: string; created_at: string;
}
const JENIS: Record<string, string> = { bahan: 'Bahan', operasional: 'Operasional', gaji: 'Gaji', aset: 'Aset', lain: 'Lain-lain' };
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
  const [form, setForm] = useState(false);
  const [cats, setCats] = useState(false);
  const [del, setDel] = useState<Expense | null>(null);
  const [alasan, setAlasan] = useState('');
  const remove = useMutation({
    mutationFn: () => api('expense.delete', { id: del!.id, alasan }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['bills'] }); toast('Pengeluaran dihapus'); setDel(null); setAlasan(''); },
  });
  const rows = useMemo(() => [...(q.data || [])].sort((a, b) => (b.tanggal + b.created_at).localeCompare(a.tanggal + a.created_at)), [q.data]);
  const total = rows.reduce((a, r) => a + r.total, 0);
  const lunas = rows.filter((r) => r.cara_bayar === 'lunas').reduce((a, r) => a + r.total, 0);
  const perJenis = Object.entries(rows.reduce<Record<string, number>>((m, r) => { m[r.kategori_jenis] = (m[r.kategori_jenis] || 0) + r.total; return m; }, {})).sort((a, b) => b[1] - a[1]);

  const cols: ColumnDef<Expense, any>[] = [
    { accessorKey: 'tanggal', header: 'Tanggal', cell: (c) => <span className="num whitespace-nowrap">{tgl(c.getValue())}</span> },
    { accessorKey: 'item', header: 'Barang / keperluan', cell: (c) => <span className="font-semibold">{c.getValue()}{c.row.original.nota && <span className="block font-mono text-[11px] font-normal text-muted">{c.row.original.nota}</span>}</span>, meta: { hideOnCard: true } },
    { accessorKey: 'kategori', header: 'Kategori', meta: { filter: 'select' } },
    { accessorKey: 'supplier', header: 'Supplier', meta: { filter: 'select' } },
    { id: 'jumlah', accessorFn: (r) => `${nf(r.qty)} ${r.satuan}`, header: 'Jumlah', meta: { align: 'right' } },
    { accessorKey: 'harga', header: 'Harga', meta: { align: 'right', hideOnCard: true }, cell: (c) => nf(c.getValue()) },
    { accessorKey: 'total', header: 'Total', meta: { align: 'right', total: true, money: true }, cell: (c) => <b>{nf(c.getValue())}</b> },
    { id: 'bayar', accessorFn: (r) => (r.cara_bayar === 'hutang' ? 'Hutang' : r.metode), header: 'Bayar', meta: { filter: 'select' },
      cell: (c) => c.row.original.cara_bayar === 'hutang'
        ? <span className={`pill ${c.row.original.sisa_hutang > 0 ? 'pill-warn' : 'pill-ok'}`}>{c.row.original.sisa_hutang > 0 ? `Hutang · sisa ${nf(c.row.original.sisa_hutang)}` : 'Hutang lunas'}</span>
        : <span className="text-xs">{c.getValue()}</span> },
    { accessorKey: 'oleh', header: 'Dicatat', meta: { filter: 'select', hideOnCard: true } },
    ...(can('pengeluaran', 'hapus') ? [{ id: 'aksi', header: '', enableSorting: false, meta: { noExport: true, hideOnCard: true }, cell: (c: { row: { original: Expense } }) => <button className="btn btn-ghost btn-sm px-1.5 text-bad" aria-label="Hapus" onClick={(e) => { e.stopPropagation(); setDel(c.row.original); }}><Trash2 size={14} /></button> } as ColumnDef<Expense, any>] : []),
  ];

  return (
    <>
      <PageHeader title="Pengeluaran" desc="Pembelian bahan dan biaya operasional. Pembelian bahan yang dihubungkan ke produk otomatis memperbarui harga beli per lembar, jadi laba per nota ikut terhitung."
        actions={<>
          {can('pengeluaran', 'ubah') && <button className="btn" onClick={() => setCats(true)}><Tags size={16} />Kategori</button>}
          {can('pengeluaran', 'tambah') && <button className="btn btn-primary" onClick={() => setForm(true)}><Plus size={16} />Catat pengeluaran</button>}
        </>} />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <section className="card p-4"><div className="text-xs font-bold uppercase tracking-wider text-muted">Total periode</div><div className="num mt-1 text-2xl font-extrabold">{rp(total)}</div><div className="text-xs text-muted">{rows.length} transaksi</div></section>
        <section className="card p-4"><div className="text-xs font-bold uppercase tracking-wider text-muted">Dibayar lunas / hutang</div><div className="num mt-1 text-lg font-bold">{rp(lunas)} <span className="text-sm font-normal text-muted">/ {rp(total - lunas)}</span></div></section>
        <section className="card p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted">Per jenis</div>
          <ul className="mt-1.5 flex flex-col gap-1 text-sm">{perJenis.slice(0, 4).map(([j, v]) => <li key={j} className="flex justify-between"><span>{JENIS[j] || j}</span><span className="num font-semibold">{nf(v)}</span></li>)}{!perJenis.length && <li className="text-muted">–</li>}</ul>
        </section>
      </div>
      <DataTable<Expense> data={rows} loading={q.isLoading} columns={cols} title="Pengeluaran" storageKey="pengeluaran" canExport={can('pengeluaran', 'ekspor')}
        toolbar={<DateRangeFilter value={range} onChange={setRange} id="exp-range" />} searchPlaceholder="Cari barang, nota, supplier…"
        cardTitle={(r) => <span className="flex justify-between gap-2"><span>{r.item}</span><span className="num text-sm">{tgl(r.tanggal)}</span></span>} emptyText="Belum ada pengeluaran di periode ini." />
      {form && meta.data && <ExpenseForm meta={meta.data} onClose={() => setForm(false)} />}
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
  const cats = meta.categories.filter((c) => c.aktif !== false);
  const [f, setF] = useState({
    tanggal: ymd(), kategori_id: cats[0]?.id || '', item: '', nota: '', supplier_id: '', product_id: '', isi: '', qty: '1', satuan: '', harga: '', mesin_id: '',
    cara_bayar: 'lunas' as 'lunas' | 'hutang', method_id: meta.payment_methods.find((m) => m.jenis === 'tunai')?.id || '', jatuh_tempo: addDays(ymd(), 30), keterangan: '',
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const jenis = cats.find((c) => c.id === f.kategori_id)?.jenis;
  const qty = numIn(f.qty), harga = numIn(f.harga), total = Math.round(qty * harga), isi = numIn(f.isi);
  const prod = meta.products.find((p) => p.id === f.product_id);
  const save = useMutation({
    mutationFn: () => api<{ harga_beli_baru: number | null }>('expense.save', { expense: { ...f, qty, harga, isi_per_satuan: isi || null, product_id: jenis === 'bahan' ? f.product_id : '' } }),
    onSuccess: (r) => {
      ['expenses', 'bills', 'products', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast(r.harga_beli_baru != null ? `Tersimpan. Harga beli ${prod?.nama} jadi ${nf(r.harga_beli_baru)}/${prod?.satuan || 'lembar'}` : 'Pengeluaran dicatat');
      onClose();
    },
  });
  return (
    <Modal open onClose={onClose} size="lg" title="Catat pengeluaran"
      footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={save.isPending || !f.item || !total} onClick={() => save.mutate()}>Simpan {total ? rp(total) : ''}</button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
        <Field label="Tanggal" className="sm:col-span-2"><input id="ex-tanggal" type="date" className="input" max={ymd()} value={f.tanggal} onChange={(e) => set('tanggal', e.target.value)} /></Field>
        <Field label="Kategori" className="sm:col-span-4">
          <select id="ex-kategori" className="input" value={f.kategori_id} onChange={(e) => set('kategori_id', e.target.value)}>{cats.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}</select>
        </Field>
        <Field label="Barang / keperluan" className="sm:col-span-4"><input id="ex-item" className="input" autoFocus value={f.item} onChange={(e) => set('item', e.target.value)} placeholder="mis. Art carton 260 A3+, listrik Oktober" /></Field>
        <Field label="No. nota supplier" className="sm:col-span-2"><input id="ex-nota" className="input" value={f.nota} onChange={(e) => set('nota', e.target.value)} /></Field>
        <Field label="Supplier" className="sm:col-span-3">
          <select id="ex-supplier" className="input" value={f.supplier_id} onChange={(e) => set('supplier_id', e.target.value)}><option value="">– tanpa supplier –</option>{meta.suppliers.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}</select>
        </Field>
        <Field label="Untuk mesin (opsional)" className="sm:col-span-3">
          <select id="ex-mesin" className="input" value={f.mesin_id} onChange={(e) => set('mesin_id', e.target.value)}><option value="">–</option>{meta.machines.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}</select>
        </Field>
        <Field label="Jumlah" className="sm:col-span-2"><input id="ex-qty" className="input num text-right" inputMode="decimal" value={f.qty} onChange={(e) => set('qty', e.target.value)} /></Field>
        <Field label="Satuan" className="sm:col-span-1"><input id="ex-satuan" className="input" value={f.satuan} onChange={(e) => set('satuan', e.target.value)} placeholder="rim" /></Field>
        <Field label="Harga per satuan" className="sm:col-span-3"><input id="ex-harga" className="input num text-right" inputMode="numeric" value={f.harga ? nf(numIn(f.harga)) : ''} onChange={(e) => set('harga', e.target.value)} /></Field>

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
          <Field label="Dibayar dengan" className="sm:col-span-3"><select id="ex-metode" className="input" value={f.method_id} onChange={(e) => set('method_id', e.target.value)}>{meta.payment_methods.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}</select></Field>
        ) : (
          <Field label="Jatuh tempo" className="sm:col-span-3" hint={!f.supplier_id ? 'Pilih supplier dulu.' : undefined}><input id="ex-jt" type="date" className="input" value={f.jatuh_tempo} onChange={(e) => set('jatuh_tempo', e.target.value)} /></Field>
        )}
        <Field label="Catatan" className="sm:col-span-3"><input id="ex-ket" className="input" value={f.keterangan} onChange={(e) => set('keterangan', e.target.value)} /></Field>
        <div className="flex items-baseline justify-between rounded-lg bg-sunk px-4 py-3 sm:col-span-6"><span className="text-sm font-semibold">Total</span><span className="num text-2xl font-extrabold">{rp(total)}</span></div>
        <div className="sm:col-span-6"><ErrorBox error={save.error} /></div>
      </div>
    </Modal>
  );
}

function CategoryModal({ cats, onClose }: { cats: ExpenseMeta['categories']; onClose: () => void }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<{ id?: string; nama: string; jenis: string; aktif: boolean } | null>(null);
  const save = useMutation({
    mutationFn: () => api('expense.category.save', { category: edit }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expense-meta'] }); setEdit(null); },
  });
  return (
    <Modal open onClose={onClose} title="Kategori pengeluaran" subtitle="Jenis menentukan cara laporan: bahan masuk HPP, operasional & gaji jadi biaya, aset tidak mengurangi laba.">
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

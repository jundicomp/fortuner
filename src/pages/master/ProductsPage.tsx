import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, FileSpreadsheet, Plus, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/table/DataTable';
import { exportXlsx, readXlsx } from '@/components/table/exportXlsx';
import { Modal } from '@/components/ui/Modal';
import { ErrorBox, Field, PageHeader, StatusPill, Switch } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { useMachines, useSettings } from '@/lib/queries';
import { CUT_SIZES, JENIS_HARGA, TIERS, hitungHarga, type TierKey } from '@/lib/pricing';
import { nf, rp, tgl, tglJam, ymd } from '@/lib/format';
import { PriceGrid, priceSummary } from './PriceGrid';
import { RecipeTab } from './RecipeTab';
import type { JenisHarga, PriceRow, Product } from '@/types';

type Tiers = Partial<Record<TierKey, number | null>>;
const pickTiers = (h?: PriceRow | null): Tiers => { const o: Tiers = {}; TIERS.forEach((t) => (o[t.key] = h?.[t.key] ?? null)); return o; };

export function ProductsPage() {
  const { can } = useAuth();
  const q = useQuery({ queryKey: ['products'], queryFn: () => api<Product[]>('products.list') });
  const machines = useMachines();
  const settings = useSettings();
  const minQty = Number(settings.data?.min_qty_banyak || 26);
  const mName = useMemo(() => Object.fromEntries((machines.data || []).map((m) => [m.id, m.nama])), [machines.data]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const open = q.data?.find((p) => p.id === openId) || null;

  const columns: ColumnDef<Product, any>[] = [
    { accessorKey: 'kode', header: 'Kode', meta: { className: 'font-mono text-xs', hideOnCard: true } },
    { accessorKey: 'nama', header: 'Nama produk', cell: (c) => <span className="font-semibold">{c.getValue()}{c.row.original.kertas_sendiri && <span className="pill pill-mute ml-1.5 align-middle">Kertas sendiri</span>}</span>, meta: { hideOnCard: true } },
    { accessorKey: 'kategori', header: 'Kategori', meta: { filter: 'select' } },
    { id: 'mesin', accessorFn: (r) => mName[r.mesin_id] || '', header: 'Mesin', meta: { filter: 'select' } },
    { id: 'jenis', accessorFn: (r) => JENIS_HARGA.find((j) => j.value === r.jenis_harga)?.label || r.jenis_harga, header: 'Jenis harga', meta: { filter: 'select' } },
    {
      id: 'harga', accessorFn: (r) => priceSummary(r.jenis_harga, r.harga), header: 'Harga berlaku', enableSorting: false,
      meta: { exportValue: (r: Product) => r.harga?.rb ?? '' , label: 'Harga berlaku' },
      cell: (c) => {
        const r = c.row.original;
        if (r.jenis_harga !== 'manual' && !r.harga) return <span className="pill pill-bad">Belum ada harga</span>;
        return <span className="num">{c.getValue()}</span>;
      },
    },
    { id: 'sejak', accessorFn: (r) => r.harga?.berlaku_mulai || '', header: 'Berlaku sejak', cell: (c) => <span className="num">{c.getValue() ? tgl(c.getValue()) : '–'}</span> },
    {
      id: 'jadwal', accessorFn: (r) => r.harga_berikutnya?.berlaku_mulai || '', header: 'Harga terjadwal', meta: { label: 'Harga terjadwal' },
      cell: (c) => c.getValue() ? <span className="pill pill-warn"><CalendarClock size={12} />{tgl(c.getValue())}</span> : <span className="text-muted/60">–</span>,
    },
    { id: 'aktif', accessorFn: (r) => (r.aktif ? 'Aktif' : 'Nonaktif'), header: 'Status', meta: { filter: 'select' }, cell: (c) => <StatusPill aktif={c.row.original.aktif} /> },
  ];

  return (
    <>
      <PageHeader title="Produk & Harga"
        desc={`Harga tidak pernah ditimpa: setiap perubahan menambah riwayat dengan tanggal berlaku, jadi nota lama tidak berubah. Harga "banyak" mulai qty ${minQty}.`}
        actions={can('master.produk', 'tambah') && <button className="btn" onClick={() => setImporting(true)}><Upload size={16} />Import Excel</button>} />
      <DataTable<Product>
        data={q.data || []} loading={q.isLoading} columns={columns} title="Produk" storageKey="master-products"
        initialSort={[{ id: 'nama', desc: false }]} canExport={can('master.produk', 'ekspor')} searchPlaceholder="Cari kode atau nama produk…"
        onRowClick={(r) => setOpenId(r.id)}
        cardTitle={(r) => <span>{r.nama} <span className="font-mono text-xs font-normal text-muted">#{r.kode}</span></span>}
        toolbar={can('master.produk', 'tambah') && <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} />Tambah</button>}
        emptyText="Belum ada produk. Tambah satu per satu atau import dari Excel."
      />
      {open && <ProductModal product={open} onClose={() => setOpenId(null)} minQty={minQty} />}
      {creating && <ProductForm onClose={() => setCreating(false)} minQty={minQty} />}
      {importing && <ImportModal onClose={() => setImporting(false)} products={q.data || []} mName={mName} />}
    </>
  );
}

// ---------------- detail produk ----------------
function ProductModal({ product, onClose, minQty }: { product: Product; onClose: () => void; minQty: number }) {
  const { can } = useAuth();
  const [tab, setTab] = useState<'harga' | 'riwayat' | 'simulasi' | 'resep' | 'data'>('harga');
  const hist = useQuery({ queryKey: ['price-history', product.id], queryFn: () => api<PriceRow[]>('price.history', { product_id: product.id }) });
  const tabs = [['harga', 'Harga'], ['riwayat', 'Riwayat'], ['simulasi', 'Simulasi'], ...(product.jenis_harga !== 'manual' ? [['resep', 'Resep & HPP']] : []), ...(can('master.produk', 'ubah') ? [['data', 'Data produk']] : [])] as const;

  return (
    <Modal open onClose={onClose} size="lg" title={product.nama} subtitle={<>Kode <span className="font-mono">{product.kode}</span> · {JENIS_HARGA.find((j) => j.value === product.jenis_harga)?.label}</>}>
      <div className="-mt-1 mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as typeof tab)} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${tab === k ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}>{l}</button>
        ))}
      </div>
      {tab === 'harga' && <PriceTab product={product} minQty={minQty} />}
      {tab === 'riwayat' && <HistoryTab rows={hist.data || []} loading={hist.isLoading} product={product} minQty={minQty} />}
      {tab === 'simulasi' && <SimTab product={product} minQty={minQty} />}
      {tab === 'resep' && <RecipeTab product={product} />}
      {tab === 'data' && <ProductForm product={product} onClose={onClose} minQty={minQty} embedded />}
    </Modal>
  );
}

function PriceTab({ product, minQty }: { product: Product; minQty: number }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<{ mulai: string; tiers: Tiers; catatan: string } | null>(null);
  const add = useMutation({
    mutationFn: () => api('price.add', { product_id: product.id, berlaku_mulai: form!.mulai, catatan: form!.catatan, ...form!.tiers }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['price-history', product.id] });
      toast(form!.mulai > ymd() ? `Harga baru dijadwalkan mulai ${tgl(form!.mulai)}` : 'Harga baru berlaku');
      setForm(null);
    },
  });

  if (product.jenis_harga === 'manual') return <p className="text-sm text-muted">Produk ini memakai harga manual yang diisi CS saat transaksi.</p>;
  const base = product.harga_berikutnya || product.harga;

  return (
    <div className="flex flex-col gap-5">
      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold">Berlaku hari ini</h3>
          {product.harga && <span className="text-xs text-muted">sejak {tgl(product.harga.berlaku_mulai)}{product.harga.catatan ? ` · ${product.harga.catatan}` : ''}</span>}
        </div>
        {product.harga ? <PriceGrid jenis={product.jenis_harga} vals={product.harga} minQty={minQty} /> : <p className="text-sm text-bad">Belum ada harga yang berlaku.</p>}
      </section>
      {product.harga_berikutnya && (
        <section className="rounded-xl border border-warn/30 bg-warn/5 p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-bold text-warn"><CalendarClock size={16} />Terjadwal mulai {tgl(product.harga_berikutnya.berlaku_mulai)}</div>
          <PriceGrid jenis={product.jenis_harga} vals={product.harga_berikutnya} before={product.harga} minQty={minQty} />
        </section>
      )}
      {can('master.produk', 'ubah') && !form && (
        <button className="btn btn-primary self-start" onClick={() => { add.reset(); setForm({ mulai: product.harga_berikutnya?.berlaku_mulai || ymd(), tiers: pickTiers(base), catatan: '' }); }}><Plus size={16} />Harga baru / kenaikan harga</button>
      )}
      {form && (
        <section className="rounded-xl border border-brand/40 bg-brand/5 p-4">
          <h3 className="mb-3 text-sm font-bold">Harga baru</h3>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Berlaku mulai" hint={product.harga_berikutnya
              ? `Sudah ada harga terjadwal ${tgl(product.harga_berikutnya.berlaku_mulai)}. Tanggal yang sama = mengoreksi harga terjadwal itu; tanggal sesudahnya = harga baru lagi.`
              : 'Hari ini = langsung berlaku. Tanggal ke depan = kenaikan terjadwal. Tanggal yang sama dengan harga terakhir = koreksi.'}>
              <input id="price-mulai" type="date" className="input" value={form.mulai} min={product.harga_berikutnya?.berlaku_mulai || product.harga?.berlaku_mulai} onChange={(e) => setForm({ ...form, mulai: e.target.value })} />
            </Field>
            <Field label="Catatan / alasan"><input id="price-catatan" className="input" value={form.catatan} placeholder="mis. kenaikan harga kertas" onChange={(e) => setForm({ ...form, catatan: e.target.value })} /></Field>
          </div>
          <PriceGrid jenis={product.jenis_harga} vals={form.tiers} before={base} minQty={minQty} idPrefix="new" onChange={(k, v) => setForm({ ...form, tiers: { ...form.tiers, [k]: v } })} />
          <p className="mt-3 text-xs text-muted">Persentase dibanding harga {product.harga_berikutnya ? 'terjadwal' : 'saat ini'}. Kosongkan sel bila tier itu tidak dipakai.</p>
          <div className="mt-3"><ErrorBox error={add.error} /></div>
          <div className="mt-3 flex justify-end gap-2">
            <button className="btn" onClick={() => setForm(null)}>Batal</button>
            <button className="btn btn-primary" disabled={add.isPending || !form.mulai} onClick={() => add.mutate()}>{add.isPending ? 'Menyimpan…' : 'Simpan harga'}</button>
          </div>
        </section>
      )}
    </div>
  );
}

function HistoryTab({ rows, loading, product, minQty }: { rows: PriceRow[]; loading: boolean; product: Product; minQty: number }) {
  const today = ymd();
  if (loading) return <p className="text-sm text-muted">Memuat riwayat…</p>;
  if (!rows.length) return <p className="text-sm text-muted">Belum ada riwayat harga.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {rows.map((r, i) => {
        const status = r.berlaku_mulai > today ? ['Terjadwal', 'pill-warn'] : !r.berlaku_sampai || r.berlaku_sampai >= today ? ['Berlaku', 'pill-ok'] : ['Selesai', 'pill-mute'];
        return (
          <li key={r.id} className="rounded-xl border border-line p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={`pill ${status[1]}`}>{status[0]}</span>
              <span className="text-sm font-bold">{tgl(r.berlaku_mulai)} – {r.berlaku_sampai ? tgl(r.berlaku_sampai) : 'sekarang'}</span>
              {r.catatan && <span className="text-xs text-muted">· {r.catatan}</span>}
              <span className="ml-auto text-[11px] text-muted">dibuat {tglJam(r.created_at)}</span>
            </div>
            <PriceGrid jenis={product.jenis_harga} vals={r} before={rows[i + 1]} minQty={minQty} />
          </li>
        );
      })}
    </ol>
  );
}

function SimTab({ product, minQty }: { product: Product; minQty: number }) {
  const [tipe, setTipe] = useState<'reseller' | 'enduser'>('enduser');
  const [qty, setQty] = useState(10);
  const [sisi, setSisi] = useState<1 | 2>(1);
  const [ukuran, setUkuran] = useState(0);
  const r = hitungHarga({ jenis: product.jenis_harga, harga: product.harga, tipe, qty, sisi, ukuran, minQtyBanyak: minQty });
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">Coba hitung harga persis seperti nanti di kasir.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Tipe konsumen">
          <select id="sim-tipe" className="input" value={tipe} onChange={(e) => setTipe(e.target.value as typeof tipe)}><option value="enduser">End user</option><option value="reseller">Reseller</option></select>
        </Field>
        <Field label="Jumlah"><input id="sim-qty" className="input num" inputMode="numeric" value={qty} onChange={(e) => setQty(Number(e.target.value.replace(/\D/g, '')) || 0)} /></Field>
        {product.jenis_harga === 'cutting' ? (
          <Field label="Ukuran stiker"><select id="sim-ukuran" className="input" value={ukuran} onChange={(e) => setUkuran(Number(e.target.value))}>{CUT_SIZES.map((s, i) => <option key={s} value={i}>{s}</option>)}</select></Field>
        ) : (
          <Field label="Sisi"><select id="sim-sisi" className="input" value={sisi} onChange={(e) => setSisi(Number(e.target.value) as 1 | 2)}><option value={1}>1 sisi</option><option value={2}>2 sisi (BB)</option></select></Field>
        )}
      </div>
      <div className="rounded-xl bg-sunk p-4">
        <div className="flex flex-wrap items-center gap-2"><span className="pill pill-brand">{r.label}</span>{r.peringatan && <span className="text-xs text-warn">{r.peringatan}</span>}</div>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm text-muted">{nf(qty)} × {rp(r.harga)}</span>
          <span className="num text-2xl font-extrabold">{r.harga == null ? '–' : rp(r.harga * qty)}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------- form produk ----------------
function ProductForm({ product, onClose, minQty, embedded }: { product?: Product; onClose: () => void; minQty: number; embedded?: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const machines = useMachines();
  const [p, setP] = useState<Partial<Product>>(product || { jenis_harga: 'matriks', satuan: 'lembar', aktif: true, kode: '', nama: '', kategori: '', mesin_id: '' });
  const [tiers, setTiers] = useState<Tiers>({});
  const save = useMutation({
    mutationFn: () => api<Product>('products.save', { product: p, harga: product ? undefined : { ...tiers, berlaku_mulai: ymd() } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast(product ? 'Produk diperbarui' : 'Produk ditambahkan'); onClose(); },
  });
  const set = (k: keyof Product, v: unknown) => setP((x) => ({ ...x, [k]: v }));
  const activeMachines = (machines.data || []).filter((m) => m.aktif || m.id === p.mesin_id);

  const body = (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={<>Kode <span className="text-bad">*</span></>}><input id="prd-kode" className="input font-mono" value={p.kode || ''} onChange={(e) => set('kode', e.target.value)} required /></Field>
        <Field label={<>Nama produk <span className="text-bad">*</span></>} className="sm:col-span-2"><input id="prd-nama" className="input" value={p.nama || ''} onChange={(e) => set('nama', e.target.value)} required /></Field>
        <Field label="Kategori"><input id="prd-kategori" className="input" value={p.kategori || ''} placeholder="mis. Kertas, Stiker" onChange={(e) => set('kategori', e.target.value)} /></Field>
        <Field label="Mesin">
          <select id="prd-mesin" className="input" value={p.mesin_id || ''} onChange={(e) => set('mesin_id', e.target.value)}>
            <option value="">– pilih –</option>
            {activeMachines.map((m) => <option key={m.id} value={m.id}>{m.nama}{!m.aktif ? ' (nonaktif)' : ''}</option>)}
          </select>
        </Field>
        <Field label="Satuan"><input id="prd-satuan" className="input" value={p.satuan || ''} onChange={(e) => set('satuan', e.target.value)} /></Field>
        <Field label="Jenis harga" className="sm:col-span-3" hint={JENIS_HARGA.find((j) => j.value === p.jenis_harga)?.hint}>
          <select id="prd-jenis" className="input" value={p.jenis_harga} onChange={(e) => set('jenis_harga', e.target.value as JenisHarga)} disabled={!!product?.harga && !!product}>
            {JENIS_HARGA.map((j) => <option key={j.value} value={j.value}>{j.label}</option>)}
          </select>
        </Field>
      </div>
      {!product && p.jenis_harga !== 'manual' && (
        <div className="rounded-xl border border-line p-4">
          <h3 className="mb-3 text-sm font-bold">Harga awal <span className="font-normal text-muted">(berlaku hari ini)</span></h3>
          <PriceGrid jenis={p.jenis_harga as JenisHarga} vals={tiers} minQty={minQty} idPrefix="init" onChange={(k, v) => setTiers((t) => ({ ...t, [k]: v }))} />
        </div>
      )}
      <Switch id="prd-ks" checked={!!p.kertas_sendiri} onChange={(v) => setP((x) => ({ ...x, kertas_sendiri: v, kategori: v && !x.kategori ? 'Kertas sendiri' : x.kategori }))}
        label={<>Kertas sendiri / upah print <span className="block text-xs text-muted">Konsumen membawa kertas. Stok bahan tidak dipotong, HPP hanya biaya klik mesin.</span></>} />
      <Switch id="prd-aktif" checked={p.aktif !== false} onChange={(v) => set('aktif', v)} label="Aktif (nonaktif = tidak muncul di kasir)" />
      <ErrorBox error={save.error} />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={onClose}>Batal</button>
        <button className="btn btn-primary" disabled={save.isPending}>{save.isPending ? 'Menyimpan…' : 'Simpan'}</button>
      </div>
    </form>
  );
  if (embedded) return body;
  return <Modal open onClose={onClose} size="lg" title="Tambah produk">{body}</Modal>;
}

// ---------------- import excel ----------------
const IMPORT_COLS = ['kode', 'nama', 'kategori', 'mesin', 'jenis_harga', 'satuan', 'aktif', 'kertas_sendiri', ...TIERS.map((t) => t.key)];

function ImportModal({ onClose, products, mName }: { onClose: () => void; products: Product[]; mName: Record<string, string> }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [mulai, setMulai] = useState(ymd());
  const [readErr, setReadErr] = useState('');
  const imp = useMutation({
    mutationFn: () => api<{ dibuat: number; diperbarui: number; harga: number; dilewati: string[] }>('products.import', { rows, berlaku_mulai: mulai }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['master', 'machines'] }); toast(`Import selesai: ${r.dibuat} baru, ${r.diperbarui} diperbarui, ${r.harga} harga baru`); },
  });

  const template = () => {
    const data = products.length
      ? products.map((p) => { const o: Record<string, unknown> = { kode: p.kode, nama: p.nama, kategori: p.kategori, mesin: mName[p.mesin_id] || '', jenis_harga: p.jenis_harga, satuan: p.satuan, aktif: p.aktif ? 'ya' : 'tidak', kertas_sendiri: p.kertas_sendiri ? 'ya' : 'tidak' }; TIERS.forEach((t) => (o[t.key] = p.harga?.[t.key] ?? '')); return o; })
      : [Object.fromEntries(IMPORT_COLS.map((c) => [c, '']))];
    exportXlsx(data, `Template_Produk_${ymd()}.xlsx`, 'Produk');
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    setReadErr(''); imp.reset(); setFileName(f.name);
    try {
      const raw = await readXlsx(f);
      const norm = raw.map((r) => { const o: Record<string, unknown> = {}; Object.entries(r).forEach(([k, v]) => (o[k.trim().toLowerCase().replace(/\s+/g, '_')] = v)); return o; }).filter((r) => r.kode || r.nama);
      if (!norm.length || !('kode' in norm[0]) || !('nama' in norm[0])) { setReadErr('Kolom "kode" dan "nama" tidak ditemukan. Pakai template dari tombol di atas.'); setRows(null); return; }
      setRows(norm);
    } catch { setReadErr('File tidak bisa dibaca. Pastikan formatnya .xlsx atau .csv.'); setRows(null); }
  };

  return (
    <Modal open onClose={onClose} size="lg" title="Import produk dari Excel"
      subtitle="Produk dicocokkan berdasarkan kode: yang sudah ada diperbarui, yang belum ada ditambahkan."
      footer={<><button className="btn" onClick={onClose}>{imp.isSuccess ? 'Tutup' : 'Batal'}</button>{!imp.isSuccess && <button className="btn btn-primary" disabled={!rows?.length || imp.isPending} onClick={() => imp.mutate()}>{imp.isPending ? 'Mengimpor…' : `Import ${rows?.length || 0} baris`}</button>}</>}>
      <div className="flex flex-col gap-4">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Unduh template. Isinya produk dan harga yang sekarang, jadi bisa langsung diedit.</li>
          <li>Kolom harga: <span className="font-mono text-xs">rb, rb_bb, rs, rs_bb</span> (reseller banyak/BB/sedikit/BB) dan <span className="font-mono text-xs">eb … es_bb</span> (end user). Cutting memakai rb–rs_bb untuk 4 ukuran; harga tetap cukup di rb.</li>
          <li>Harga yang berubah dicatat sebagai harga baru mulai tanggal di bawah; harga lama tetap tersimpan.</li>
        </ol>
        <button className="btn self-start" onClick={template}><FileSpreadsheet size={16} />Unduh template</button>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="File Excel (.xlsx / .csv)">
            <input id="import-file" type="file" accept=".xlsx,.xls,.csv" className="input file:mr-3 file:rounded-md file:border-0 file:bg-sunk file:px-3 file:py-1 file:text-xs file:font-semibold" onChange={(e) => onFile(e.target.files?.[0])} />
          </Field>
          <Field label="Harga baru berlaku mulai"><input id="import-mulai" type="date" className="input" value={mulai} onChange={(e) => setMulai(e.target.value)} /></Field>
        </div>
        {readErr && <ErrorBox error={new Error(readErr)} />}
        {rows && !imp.isSuccess && (
          <div className="rounded-xl border border-line">
            <div className="border-b border-line px-3 py-2 text-xs font-semibold text-muted">{fileName}: {rows.length} baris · contoh 5 baris pertama</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr>{['kode', 'nama', 'mesin', 'jenis_harga', 'rb', 'eb'].map((c) => <th key={c} className="px-3 py-1.5 text-left font-bold text-muted">{c}</th>)}</tr></thead>
                <tbody>{rows.slice(0, 5).map((r, i) => <tr key={i} className="border-t border-line">{['kode', 'nama', 'mesin', 'jenis_harga', 'rb', 'eb'].map((c) => <td key={c} className="px-3 py-1.5">{String(r[c] ?? '')}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        )}
        <ErrorBox error={imp.error} />
        {imp.data && (
          <div className="rounded-xl border border-ok/30 bg-ok/5 p-4 text-sm">
            <div className="font-bold text-ok">Import selesai</div>
            <div className="mt-1">{imp.data.dibuat} produk baru, {imp.data.diperbarui} diperbarui, {imp.data.harga} harga baru mulai {tgl(mulai)}.</div>
            {imp.data.dilewati.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-warn">{imp.data.dilewati.slice(0, 20).map((d) => <li key={d}>{d}</li>)}</ul>}
          </div>
        )}
      </div>
    </Modal>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, FileSpreadsheet, Plus, Split, Upload, X } from 'lucide-react';
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
import { CUT_SIZES, JENIS_HARGA, TIERS, hitungHarga, sisiLabel, type TierKey } from '@/lib/pricing';
import { nf, rp, tgl, tglJam, ymd } from '@/lib/format';
import { PriceGrid, priceSummary } from './PriceGrid';
import { RecipeTab, type Cost } from './RecipeTab';
import { useStockMeta } from '@/pages/stok/stokApi';
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
    { id: 'sisi', accessorFn: (r) => (r.jenis_harga === 'matriks' ? sisiLabel(r.sisi) : '–'), header: 'Sisi', meta: { filter: 'select' },
      cell: (c) => c.row.original.jenis_harga === 'matriks' ? <span className={`pill ${Number(c.row.original.sisi) === 2 ? 'pill-brand' : 'pill-mute'}`}>{c.getValue()}</span> : <span className="text-muted/60">–</span> },
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
      {can('master.produk', 'tambah') && <SplitBBBanner products={q.data || []} />}
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

/** Produk lama yang masih menyimpan harga BB di kolomnya: tawarkan pecah jadi produk 2 sisi tersendiri. */
function SplitBBBanner({ products }: { products: Product[] }) {
  const qc = useQueryClient();
  const toast = useToast();
  const lama = products.filter((p) => p.jenis_harga === 'matriks' && Number(p.sisi) !== 2 && p.harga && (['rb_bb', 'rs_bb', 'eb_bb', 'es_bb'] as TierKey[]).some((k) => p.harga![k] != null));
  const run = useMutation({
    mutationFn: () => api<{ dibuat: number; diperbarui: number }>('products.split_bb'),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['pos'] }); toast(`${r.dibuat} produk 2 sisi (BB) dibuat${r.diperbarui ? `, ${r.diperbarui} diperbarui` : ''}`); },
  });
  if (!lama.length) return null;
  return (
    <div className="card mb-4 flex flex-wrap items-center gap-3 border-brand/40 bg-brand/5 p-4">
      <Split size={20} className="shrink-0 text-brand" />
      <div className="min-w-0 flex-1 text-sm">
        <b>{lama.length} produk masih menyimpan harga BB (2 sisi) di dalam produk 1 sisi.</b>
        <div className="text-xs text-muted">Sekarang 1 sisi dan 2 sisi adalah produk terpisah. Klik untuk membuat produk 2 sisi otomatis: kode "<span className="font-mono">kodeBB</span>", nama "… BB", harga dari kolom BB, mesin & resep sama.</div>
      </div>
      <ErrorBox error={run.error} />
      <button className="btn btn-primary" disabled={run.isPending} onClick={() => run.mutate()}><Split size={16} />{run.isPending ? 'Memproses…' : 'Jadikan produk 2 sisi'}</button>
    </div>
  );
}

// ---------------- detail produk ----------------
function ProductModal({ product, onClose, minQty }: { product: Product; onClose: () => void; minQty: number }) {
  const { can } = useAuth();
  const [tab, setTab] = useState<'harga' | 'riwayat' | 'simulasi' | 'resep' | 'data'>('harga');
  const hist = useQuery({ queryKey: ['price-history', product.id], queryFn: () => api<PriceRow[]>('price.history', { product_id: product.id }) });
  const tabs = [['harga', 'Harga'], ['riwayat', 'Riwayat'], ['simulasi', 'Simulasi'], ...(product.jenis_harga !== 'manual' ? [['resep', 'Resep & HPP']] : []), ...(can('master.produk', 'ubah') ? [['data', 'Data produk']] : [])] as const;

  return (
    <Modal open onClose={onClose} size="lg" title={product.nama} subtitle={<>Kode <span className="font-mono">{product.kode}</span> · {JENIS_HARGA.find((j) => j.value === product.jenis_harga)?.label}{product.jenis_harga === 'matriks' ? ` · ${sisiLabel(product.sisi)}` : ''}</>}>
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

  const settings = useSettings();
  const marginMin = Number(settings.data?.margin_min || 20);
  const cost = useQuery({ queryKey: ['recipe', product.id], queryFn: () => api<{ satu_sisi: Cost; bolak_balik: Cost; lihat_harga?: boolean }>('recipe.get', { product_id: product.id }), enabled: product.jenis_harga !== 'manual', retry: 0 });
  const modal = cost.data?.lihat_harga ? (product.jenis_harga === 'matriks' && Number(product.sisi) === 2 ? cost.data.bolak_balik : cost.data.satu_sisi).total : null;

  if (product.jenis_harga === 'manual') return <p className="text-sm text-muted">Produk ini memakai harga manual yang diisi CS saat transaksi.</p>;
  const base = product.harga_berikutnya || product.harga;

  return (
    <div className="flex flex-col gap-5">
      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold">Berlaku hari ini</h3>
          {product.harga && <span className="text-xs text-muted">sejak {tgl(product.harga.berlaku_mulai)}{product.harga.catatan ? ` · ${product.harga.catatan}` : ''}</span>}
        </div>
        {modal != null && modal > 0 && <div className="mb-2 flex items-center justify-between rounded-xl bg-ink px-4 py-2 text-canvas"><span className="text-xs opacity-75">Modal per {product.satuan || 'lembar'} (bahan + klik + jasa)</span><b className="num">Rp {nf(modal)}</b></div>}
        {product.harga ? <PriceGrid jenis={product.jenis_harga} vals={product.harga} minQty={minQty} sisi={product.jenis_harga === "matriks" ? product.sisi || 1 : undefined} modal={modal} marginMin={marginMin} /> : <p className="text-sm text-bad">Belum ada harga yang berlaku.</p>}
      </section>
      {product.harga_berikutnya && (
        <section className="rounded-xl border border-warn/30 bg-warn/5 p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-bold text-warn"><CalendarClock size={16} />Terjadwal mulai {tgl(product.harga_berikutnya.berlaku_mulai)}</div>
          <PriceGrid jenis={product.jenis_harga} vals={product.harga_berikutnya} before={product.harga} minQty={minQty} modal={modal} marginMin={marginMin} />
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
          <PriceGrid jenis={product.jenis_harga} vals={form.tiers} before={base} minQty={minQty} idPrefix="new" sisi={product.jenis_harga === "matriks" ? product.sisi || 1 : undefined} modal={modal} marginMin={marginMin} onChange={(k, v) => setForm({ ...form, tiers: { ...form.tiers, [k]: v } })} />
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
  const [ukuran, setUkuran] = useState(0);
  const r = hitungHarga({ jenis: product.jenis_harga, harga: product.harga, tipe, qty, ukuran, minQtyBanyak: minQty });
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
          <Field label="Sisi"><div className="input bg-sunk">{product.jenis_harga === 'matriks' ? sisiLabel(product.sisi) : '–'}</div></Field>
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
type Line = { material_id: string; qty: string };

/** Pilihan kategori produk (seragam) + tambah kategori baru. */
function KategoriSelect({ value, onChange, extra }: { value: string; onChange: (v: string) => void; extra: string[] }) {
  const qc = useQueryClient();
  const { can } = useAuth();
  const cats = useQuery({ queryKey: ['master', 'product_categories'], queryFn: () => api<{ id: string; nama: string; aktif: boolean }[]>('master.list', { table: 'product_categories' }), staleTime: 60e3 });
  const [adding, setAdding] = useState(false);
  const [nama, setNama] = useState('');
  const add = useMutation({
    mutationFn: () => api('master.save', { table: 'product_categories', record: { nama: nama.trim(), aktif: true } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['master', 'product_categories'] }); onChange(nama.trim()); setAdding(false); setNama(''); },
  });
  const list = [...new Set([...(cats.data || []).filter((c) => c.aktif !== false).map((c) => c.nama), ...extra.filter((k) => k && k !== 'Kertas sendiri'), ...(value ? [value] : [])])].sort((x, y) => x.localeCompare(y, 'id'));
  if (adding) return (
    <div className="flex gap-1">
      <input id="prd-kat-baru" className="input" autoFocus value={nama} placeholder="Nama kategori baru" onChange={(e) => setNama(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (nama.trim()) add.mutate(); } if (e.key === 'Escape') setAdding(false); }} />
      <button type="button" className="btn btn-primary px-2.5" disabled={!nama.trim() || add.isPending} onClick={() => add.mutate()}>OK</button>
      <button type="button" className="btn px-2.5" onClick={() => setAdding(false)} aria-label="Batal"><X size={14} /></button>
    </div>
  );
  return (
    <select id="prd-kategori" className="input" value={value} onChange={(e) => { if (e.target.value === '__add__') setAdding(true); else onChange(e.target.value); }}>
      <option value="">– pilih –</option>
      {list.map((k) => <option key={k} value={k}>{k}</option>)}
      {can('master.produk', 'tambah') && <option value="__add__">+ Tambah kategori…</option>}
    </select>
  );
}

function ProductForm({ product, onClose, minQty, embedded }: { product?: Product; onClose: () => void; minQty: number; embedded?: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const machines = useMachines();
  const settings = useSettings();
  const all = useQuery({ queryKey: ['products'], queryFn: () => api<Product[]>('products.list'), staleTime: 60e3 });
  const meta = useStockMeta(!product);
  const [p, setP] = useState<Partial<Product>>(product || { jenis_harga: 'matriks', satuan: 'lembar', aktif: true, kode: '', nama: '', kategori: '', mesin_id: '', sisi: 1, biaya_jasa: 0 });
  const [tiers, setTiers] = useState<Tiers>({});
  const [lines, setLines] = useState<Line[]>([{ material_id: '', qty: '1' }]);
  const set = (k: keyof Product, v: unknown) => setP((x) => ({ ...x, [k]: v }));
  const activeMachines = (machines.data || []).filter((m) => m.aktif || m.id === p.mesin_id);
  const mesin = (machines.data || []).find((m) => m.id === p.mesin_id);
  const ks = !!p.kertas_sendiri;
  const sisi = p.jenis_harga === 'matriks' && Number(p.sisi) === 2 ? 2 : 1;
  const mats = (meta.data?.materials || []).filter((m) => m.status !== 'nonaktif');
  const lihat = !!meta.data?.lihat_harga;
  const marginMin = Number(settings.data?.margin_min || 20);
  const usedLines = ks ? [] : lines.filter((l) => l.material_id && Number(l.qty.replace(',', '.')) > 0);
  const bahan = usedLines.reduce((a, l) => a + Number(l.qty.replace(',', '.')) * Number(mats.find((m) => m.id === l.material_id)?.harga_rata || 0), 0);
  const klik = sisi * Number(mesin?.biaya_klik || 0);
  const jasa = Number(p.biaya_jasa || 0);
  const modal = Math.round((bahan + klik + jasa) * 100) / 100;
  const hargaMin = modal > 0 ? Math.ceil(modal / (1 - marginMin / 100) / 100) * 100 : 0;

  const save = useMutation({
    mutationFn: async () => {
      const row = await api<Product>('products.save', { product: p, harga: product ? undefined : { ...tiers, berlaku_mulai: ymd() } });
      if (!product && usedLines.length) await api('recipe.save', { product_id: row.id, lines: usedLines.map((l) => ({ material_id: l.material_id, qty: Number(l.qty.replace(',', '.')), per: 'unit' })) });
      return row;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['pos'] }); toast(product ? 'Produk diperbarui' : 'Produk ditambahkan'); onClose(); },
  });

  const fields = (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
        <Field label={<>Kode <span className="text-bad">*</span></>}><input id="prd-kode" className="input font-mono" value={p.kode || ''} onChange={(e) => set('kode', e.target.value)} required /></Field>
        <Field label={<>Nama produk <span className="text-bad">*</span></>}><input id="prd-nama" className="input" value={p.nama || ''} onChange={(e) => set('nama', e.target.value)} required /></Field>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_88px] gap-2">
        <Field label="Kategori"><KategoriSelect value={p.kategori || ''} onChange={(v) => set('kategori', v)} extra={(all.data || []).map((x) => x.kategori)} /></Field>
        <Field label={<>Mesin {mesin?.biaya_klik ? <span className="font-normal">· {nf(mesin.biaya_klik)}/klik</span> : null}</>}>
          <select id="prd-mesin" className="input" value={p.mesin_id || ''} onChange={(e) => set('mesin_id', e.target.value)}>
            <option value="">– pilih –</option>
            {activeMachines.map((m) => <option key={m.id} value={m.id}>{m.nama}{!m.aktif ? ' (nonaktif)' : ''}</option>)}
          </select>
        </Field>
        <Field label="Satuan"><input id="prd-satuan" className="input" value={p.satuan || ''} onChange={(e) => set('satuan', e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Jenis harga">
          <select id="prd-jenis" className="input" value={p.jenis_harga} onChange={(e) => set('jenis_harga', e.target.value as JenisHarga)} disabled={!!product?.harga && !!product} title={JENIS_HARGA.find((j) => j.value === p.jenis_harga)?.hint}>
            {JENIS_HARGA.map((j) => <option key={j.value} value={j.value}>{j.label}</option>)}
          </select>
        </Field>
        <div className="label"><span>Sisi cetak</span>
          <div className={`flex overflow-hidden rounded-lg border border-line ${p.jenis_harga !== 'matriks' ? 'opacity-40' : ''}`} role="group" aria-label="Sisi cetak">
            {[1, 2].map((n) => (
              <button key={n} type="button" id={`prd-sisi-${n}`} disabled={p.jenis_harga !== 'matriks'} onClick={() => set('sisi', n)}
                className={`flex-1 px-2 py-2 text-xs font-bold transition ${sisi === n && p.jenis_harga === 'matriks' ? 'bg-ink text-canvas' : 'bg-surface text-muted hover:text-ink'}`}>{n === 1 ? '1 sisi' : '2 sisi (BB)'}</button>
            ))}
          </div>
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input id="prd-ks" type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" checked={ks} onChange={(e) => set('kertas_sendiri', e.target.checked)} />
        <b>Kertas sendiri</b><span className="text-xs text-muted">· jasa cetak saja, bahan kertas tidak dihitung</span>
      </label>
      {embedded && (
        <Field label="Jasa / ongkos lain per unit (Rp)" hint="Ikut dihitung di modal (HPP taksiran) dan margin produk.">
          <input id="prd-jasa" className="input num text-right" inputMode="numeric" value={p.biaya_jasa ? nf(p.biaya_jasa) : ''} placeholder="0" onChange={(e) => set('biaya_jasa', Number(e.target.value.replace(/\D/g, '')) || 0)} />
        </Field>
      )}
    </div>
  );

  if (embedded) return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      {fields}
      <Switch id="prd-aktif" checked={p.aktif !== false} onChange={(v) => set('aktif', v)} label="Aktif (nonaktif = tidak muncul di kasir)" />
      <ErrorBox error={save.error} />
      <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={save.isPending}>{save.isPending ? 'Menyimpan…' : 'Simpan'}</button></div>
    </form>
  );

  const satuan = p.satuan || 'lembar';
  return (
    <Modal open onClose={onClose} size="xl" title="Tambah produk"
      footer={<div className="flex w-full items-center justify-between gap-3">
        <Switch id="prd-aktif" checked={p.aktif !== false} onChange={(v) => set('aktif', v)} label={<span className="text-sm"><b>Aktif</b> <span className="text-muted">di kasir</span></span>} />
        <div className="flex gap-2"><button type="button" className="btn" onClick={onClose}>Batal</button><button id="prd-simpan" className="btn btn-primary" disabled={save.isPending || !p.kode || !p.nama} onClick={() => save.mutate()}>{save.isPending ? 'Menyimpan…' : 'Simpan'}</button></div>
      </div>}>
      <div className="-mx-5 -my-4 grid grid-cols-1 md:grid-cols-2">
        <div className="flex flex-col gap-3 px-5 py-4">
          {fields}
          {p.jenis_harga !== 'manual' && lihat && (
            <section aria-label="Modal per unit" className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between text-xs font-bold uppercase tracking-wider text-muted"><span>Modal per {satuan}</span><span className="font-normal normal-case tracking-normal">{ks ? 'kertas dari konsumen' : 'bahan jadi resep produk'}</span></div>
              {!ks && lines.map((l, i) => {
                const m = mats.find((x) => x.id === l.material_id);
                const nilai = m ? Number(l.qty.replace(',', '.')) * m.harga_rata : 0;
                return (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_56px_76px_24px] items-center gap-1.5">
                    <select id={`prd-bahan-${i}`} className="input py-1.5 text-sm" value={l.material_id} onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, material_id: e.target.value } : y)))}>
                      <option value="">{i === 0 ? '– pilih bahan –' : '– bahan lain –'}</option>
                      {mats.map((x) => <option key={x.id} value={x.id}>{x.nama} · {nf(x.harga_rata)}/{x.satuan}</option>)}
                    </select>
                    <input aria-label="Pemakaian" className="input num px-2 py-1.5 text-right text-sm" inputMode="decimal" value={l.qty} onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, qty: e.target.value.replace(/[^\d.,]/g, '') } : y)))} />
                    <span className="num text-right font-semibold">{m ? nf(nilai) : '–'}</span>
                    {i > 0 ? <button type="button" className="text-muted hover:text-bad" aria-label="Hapus bahan" onClick={() => setLines((x) => x.filter((_, j) => j !== i))}><X size={15} /></button> : <span />}
                  </div>
                );
              })}
              {!ks && <button type="button" className="self-start text-xs font-bold text-brand" onClick={() => setLines((x) => [...x, { material_id: '', qty: '1' }])}>+ bahan lain</button>}
              <div className="grid grid-cols-[minmax(0,1fr)_76px_24px] items-center gap-1.5 text-sm">
                <span>Klik {mesin?.nama || 'mesin'} · {nf(mesin?.biaya_klik || 0)} × {sisi}</span><span className="num text-right font-semibold">{nf(klik)}</span><span />
              </div>
              {!mesin?.biaya_klik && p.mesin_id && <span className="text-[11px] text-warn">Biaya klik mesin ini belum diisi (Master Data → Mesin).</span>}
              <div className="grid grid-cols-[minmax(0,1fr)_76px_24px] items-center gap-1.5">
                <span className="text-sm">Jasa / ongkos lain <span className="text-xs text-muted">(potong, operator…)</span></span>
                <input id="prd-jasa" className="input num px-2 py-1.5 text-right text-sm" inputMode="numeric" value={p.biaya_jasa ? nf(p.biaya_jasa) : ''} placeholder="0" onChange={(e) => set('biaya_jasa', Number(e.target.value.replace(/\D/g, '')) || 0)} />
                <span />
              </div>
              <div className="mt-1 flex items-baseline justify-between border-t-2 border-ink pt-1.5 font-extrabold"><span>Total modal</span><span className="num">Rp {nf(modal)}</span></div>
            </section>
          )}
        </div>
        <div className="flex flex-col gap-3 border-line bg-sunk/50 px-5 py-4 md:border-l">
          <div className="flex items-baseline justify-between text-xs font-bold uppercase tracking-wider text-muted">
            <span>Harga awal{p.jenis_harga === 'matriks' ? ` · ${sisiLabel(sisi)}` : ''}</span><span className="font-normal normal-case tracking-normal">berlaku hari ini</span>
          </div>
          {p.jenis_harga !== 'manual' && lihat && (
            <div className="flex items-center justify-between rounded-xl bg-ink px-4 py-2.5 text-canvas"><span className="text-xs opacity-75">Modal per {satuan}</span><b className="num text-lg">Rp {nf(modal)}</b></div>
          )}
          <PriceGrid jenis={p.jenis_harga as JenisHarga} vals={tiers} minQty={minQty} idPrefix="init" modal={lihat ? modal : null} marginMin={marginMin} onChange={(k, v) => setTiers((t) => ({ ...t, [k]: v }))} />
          {p.jenis_harga !== 'manual' && lihat && modal > 0 && (
            <>
              <p className="text-[11px] text-muted">Angka kecil = laba kotor per {satuan} & % dari harga jual · <b className="text-ok">aman</b> · <b className="text-warn">tipis &lt; {marginMin}%</b> · <b className="text-bad">rugi</b></p>
              <div className="mt-auto flex items-center justify-between rounded-xl border border-dashed border-line px-3 py-2 text-sm"><span className="text-muted">Patokan margin {marginMin}%</span><span>harga minimal <b className="num">Rp {nf(hargaMin)}</b></span></div>
            </>
          )}
          {!lihat && meta.isSuccess && <p className="text-xs text-muted">Modal & laba hanya tampil untuk peran yang boleh melihat harga beli.</p>}
          <ErrorBox error={save.error} />
        </div>
      </div>
    </Modal>
  );
}

// ---------------- import excel ----------------
// rb_bb & rs_bb hanya dipakai produk cutting (ukuran ke-2 dan ke-4)
const PRICE_COLS: TierKey[] = ['rb', 'rs', 'eb', 'es', 'rb_bb', 'rs_bb'];
const IMPORT_COLS = ['kode', 'nama', 'kategori', 'mesin', 'jenis_harga', 'sisi', 'satuan', 'aktif', 'kertas_sendiri', ...PRICE_COLS];

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
      ? products.map((p) => { const o: Record<string, unknown> = { kode: p.kode, nama: p.nama, kategori: p.kategori, mesin: mName[p.mesin_id] || '', jenis_harga: p.jenis_harga, sisi: p.jenis_harga === 'matriks' ? (Number(p.sisi) === 2 ? 2 : 1) : '', satuan: p.satuan, aktif: p.aktif ? 'ya' : 'tidak', kertas_sendiri: p.kertas_sendiri ? 'ya' : 'tidak' }; PRICE_COLS.forEach((k) => (o[k] = p.harga?.[k] ?? '')); return o; })
      : [Object.fromEntries(IMPORT_COLS.map((c) => [c, '']))];
    exportXlsx(data, `Template_Produk_${ymd()}.xlsx`, 'Produk', { title: '' }); // tanpa judul: file ini dibaca ulang saat import
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
          <li>Kolom harga matriks: <span className="font-mono text-xs">rb, rs</span> (reseller banyak/sedikit) dan <span className="font-mono text-xs">eb, es</span> (end user). Kolom <span className="font-mono text-xs">sisi</span> diisi 1 atau 2 (BB); produk 2 sisi dibuat sebagai baris tersendiri. Cutting memakai rb, rb_bb, rs, rs_bb untuk 4 ukuran (urut dari besar ke kecil); harga tetap cukup di rb.</li>
          <li>File format lama yang masih punya kolom <span className="font-mono text-xs">rb_bb … es_bb</span> tetap bisa dipakai: harga BB otomatis dibuat menjadi produk 2 sisi (kode + "BB").</li>
          <li>Harga yang berubah dicatat sebagai harga baru mulai tanggal di bawah; harga lama tetap tersimpan.</li>
        </ol>
        <button className="btn btn-excel self-start" onClick={template}><FileSpreadsheet size={16} />Unduh template</button>
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
              <table className="tbl w-full text-xs">
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

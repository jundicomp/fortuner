import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ClipboardCheck, PackagePlus, Plus, ShoppingBag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/table/DataTable';
import { DateRangeFilter, rangeFor, type DateRange } from '@/components/table/DateRangeFilter';
import { ErrorBox, Field, PageHeader, Switch } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { nf, rp, tgl, tglJam } from '@/lib/format';
import { dec, JENIS_MOVE, numIn, saranBeli, STATUS_STOK, useStockMeta, type Material, type Opname, type StockMove } from './stokApi';
import { lastBuy, PurchaseForm, usePurchases } from './PembelianPage';

type Tab = 'bahan' | 'kartu' | 'opname' | 'belanja';

/** Stok bahan baku: daftar bahan, kartu stok, stok opname berkala, dan daftar belanja dari stok minimum. */
export function StokPage() {
  const meta = useStockMeta();
  const [tab, setTab] = useState<Tab>('bahan');
  const [cardId, setCardId] = useState('');
  const mats = meta.data?.materials || [];
  const low = mats.filter((m) => m.status === 'menipis' || m.status === 'habis');
  const nilai = mats.reduce((a, m) => a + (m.aktif ? m.nilai : 0), 0);
  const seeCost = !!meta.data?.lihat_harga;

  const tabs: [Tab, string, number | undefined][] = [['bahan', 'Bahan', mats.length], ['kartu', 'Kartu stok', undefined], ['opname', 'Stok opname', undefined], ['belanja', 'Daftar belanja', low.length]];
  return (
    <>
      <PageHeader title="Stok Bahan" desc={<>Stok bertambah dari Pembelian Bahan dan berkurang otomatis sesuai resep produk saat item {meta.data?.mode === 'bayar' ? <b>dibayar</b> : <b>selesai diproduksi</b>} (atau saat diserahkan). Cek fisik berkala lewat Stok Opname.</>} />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <section className="card tint tint-blue p-4"><div className="text-xs font-bold uppercase tracking-wider text-muted">Bahan aktif</div><div className="num mt-1 text-2xl font-extrabold">{mats.filter((m) => m.aktif).length}</div><div className="text-xs text-muted">{meta.data?.mode === 'bayar' ? 'Stok dipotong saat pembayaran' : 'Stok dipotong saat produksi selesai'}</div></section>
        <section className={`card tint ${low.length ? 'tint-rose' : 'tint-green'} p-4`}><div className="text-xs font-bold uppercase tracking-wider text-muted">Perlu dibeli</div><div className="num mt-1 text-2xl font-extrabold">{low.length}</div><div className="text-xs text-muted">{low.length ? low.slice(0, 3).map((m) => m.nama).join(', ') : 'Semua di atas batas minimum'}</div></section>
        {seeCost && <section className="card tint tint-orange p-4"><div className="text-xs font-bold uppercase tracking-wider text-muted">Nilai persediaan</div><div className="num mt-1 text-2xl font-extrabold">{rp(nilai)}</div><div className="text-xs text-muted">stok × harga rata-rata</div></section>}
      </div>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map(([k, l, n]) => (
          <button key={k} id={`stok-tab-${k}`} onClick={() => setTab(k)} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${tab === k ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}>
            {l}{n != null && <span className={`ml-1.5 text-xs font-normal ${k === 'belanja' && n ? 'rounded-full bg-bad px-1.5 text-white' : 'text-muted'}`}>{n}</span>}
          </button>
        ))}
      </div>
      <ErrorBox error={meta.error} />
      {tab === 'bahan' && <BahanTab mats={mats} loading={meta.isLoading} seeCost={seeCost} onCard={(id) => { setCardId(id); setTab('kartu'); }} />}
      {tab === 'kartu' && <KartuTab mats={mats} id={cardId || mats[0]?.id || ''} onPick={setCardId} seeCost={seeCost} />}
      {tab === 'opname' && <OpnameTab mats={mats} />}
      {tab === 'belanja' && <BelanjaTab low={low} />}
    </>
  );
}

function BahanTab({ mats, loading, seeCost, onCard }: { mats: Material[]; loading: boolean; seeCost: boolean; onCard: (id: string) => void }) {
  const { can } = useAuth();
  const [edit, setEdit] = useState<Partial<Material> & { stok_awal?: string; harga_awal?: string } | null>(null);
  const cols: ColumnDef<Material, any>[] = [
    { accessorKey: 'kode', header: 'Kode', meta: { className: 'font-mono text-xs', hideOnCard: true } },
    { accessorKey: 'nama', header: 'Bahan', cell: (c) => <span className="font-semibold">{c.getValue()}</span>, meta: { hideOnCard: true } },
    { accessorKey: 'kategori', header: 'Kategori', meta: { filter: 'select' } },
    { accessorKey: 'stok', header: 'Stok', meta: { align: 'right' }, cell: (c) => <span className={`num font-bold ${c.row.original.status === 'habis' ? 'text-bad' : c.row.original.status === 'menipis' ? 'text-warn' : ''}`}>{dec(c.getValue())} <span className="text-xs font-normal text-muted">{c.row.original.satuan}</span></span> },
    { accessorKey: 'stok_min', header: 'Minimum', meta: { align: 'right' }, cell: (c) => <span className="num text-muted">{dec(c.getValue())}</span> },
    { id: 'status', accessorFn: (r) => STATUS_STOK[r.status][0], header: 'Status', meta: { filter: 'select' }, cell: (c) => <span className={`pill ${STATUS_STOK[c.row.original.status][1]}`}>{c.getValue()}</span> },
    ...(seeCost ? [
      { accessorKey: 'harga_rata', header: 'Harga rata-rata', meta: { align: 'right' }, cell: (c: any) => <span className="num">{dec(c.getValue())}</span> },
      { accessorKey: 'nilai', header: 'Nilai stok', meta: { align: 'right', total: true, money: true }, cell: (c: any) => <span className="num">{nf(c.getValue())}</span> },
    ] as ColumnDef<Material, any>[] : []),
    { id: 'aksi', header: '', enableSorting: false, meta: { noExport: true, hideOnCard: true }, cell: (c) => <span className="flex justify-end gap-1">
      <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onCard(c.row.original.id); }}>Kartu</button>
      {can('stok', 'ubah') && <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setEdit(c.row.original); }}>Ubah</button>}
    </span> },
  ];
  return (
    <>
      <DataTable<Material> data={mats} loading={loading} columns={cols} title="Stok bahan" storageKey="stok-bahan" canExport={can('stok', 'ekspor')} onRowClick={(r) => onCard(r.id)}
        initialSort={[{ id: 'nama', desc: false }]} searchPlaceholder="Cari bahan…"
        toolbar={can('stok', 'ubah') && <button id="mat-new" className="btn btn-primary" onClick={() => setEdit({ satuan: 'lembar', aktif: true, stok_awal: '', harga_awal: '' })}><Plus size={16} />Tambah bahan</button>}
        cardTitle={(r) => <span className="flex justify-between gap-2"><span>{r.nama}</span><span className={`pill ${STATUS_STOK[r.status][1]}`}>{STATUS_STOK[r.status][0]}</span></span>}
        emptyText="Belum ada bahan. Tambahkan kertas, stiker, film, dan bahan lain yang ingin dihitung stoknya." />
      {edit && <MaterialForm m={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function MaterialForm({ m, onClose }: { m: Partial<Material> & { stok_awal?: string; harga_awal?: string }; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ ...m, stok_min: m.stok_min != null ? String(m.stok_min) : '', aktif: m.aktif !== false });
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const save = useMutation({
    mutationFn: () => api('material.save', { material: { ...f, stok_min: numIn(f.stok_min), stok_awal: numIn(f.stok_awal || ''), harga_awal: numIn(f.harga_awal || '') } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stock-meta'] }); toast(m.id ? 'Bahan diperbarui' : 'Bahan ditambahkan'); onClose(); },
  });
  return (
    <Modal open onClose={onClose} title={m.id ? `Ubah ${m.nama}` : 'Tambah bahan'}
      footer={<><button className="btn" onClick={onClose}>Batal</button><button id="mat-save" className="btn btn-primary" disabled={!f.nama?.trim() || save.isPending} onClick={() => save.mutate()}>Simpan</button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nama bahan *" className="sm:col-span-2"><input id="mat-nama" className="input" autoFocus value={f.nama || ''} onChange={(e) => set('nama', e.target.value)} placeholder="mis. Art carton 260 A3+" /></Field>
        <Field label="Kode"><input id="mat-kode" className="input font-mono" value={f.kode || ''} onChange={(e) => set('kode', e.target.value)} placeholder="AC260" /></Field>
        <Field label="Kategori"><input id="mat-kategori" className="input" value={f.kategori || ''} onChange={(e) => set('kategori', e.target.value)} placeholder="Kertas, Stiker, Film…" /></Field>
        <Field label="Satuan stok" hint="Satuan terkecil yang dipakai produksi."><input id="mat-satuan" className="input" value={f.satuan || ''} onChange={(e) => set('satuan', e.target.value)} placeholder="lembar" /></Field>
        <Field label="Stok minimum" hint="Di bawah angka ini muncul peringatan."><input id="mat-min" className="input num text-right" inputMode="decimal" value={f.stok_min} onChange={(e) => set('stok_min', e.target.value)} /></Field>
        {!m.id && (
          <div className="rounded-xl border border-line bg-sunk/50 p-3 sm:col-span-2">
            <div className="text-sm font-bold">Stok awal (opsional)</div>
            <p className="text-xs text-muted">Isi bila bahan ini sudah ada di gudang. Masuk sebagai stok awal di kartu stok dan buku besar (modal).</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Field label={`Jumlah (${f.satuan || 'satuan'})`}><input id="mat-awal" className="input num text-right" inputMode="decimal" value={f.stok_awal || ''} onChange={(e) => set('stok_awal', e.target.value)} /></Field>
              <Field label={`Harga per ${f.satuan || 'satuan'}`}><input id="mat-harga-awal" className="input num text-right" inputMode="decimal" value={f.harga_awal || ''} onChange={(e) => set('harga_awal', e.target.value)} /></Field>
            </div>
          </div>
        )}
        <Field label="Catatan" className="sm:col-span-2"><input id="mat-catatan" className="input" value={f.catatan || ''} onChange={(e) => set('catatan', e.target.value)} /></Field>
        {m.id && <div className="sm:col-span-2"><Switch id="mat-aktif" checked={f.aktif} onChange={(v) => set('aktif', v)} label="Aktif" /></div>}
        <div className="sm:col-span-2"><ErrorBox error={save.error} /></div>
      </div>
    </Modal>
  );
}

interface Card { material: Material; saldo_awal: number; rows: StockMove[]; masuk: number; keluar: number; saldo_akhir: number }

function KartuTab({ mats, id, onPick, seeCost }: { mats: Material[]; id: string; onPick: (id: string) => void; seeCost: boolean }) {
  const { can } = useAuth();
  const [range, setRange] = useState<DateRange>(rangeFor('30_hari'));
  const q = useQuery({ queryKey: ['stock-card', id, range.from, range.to], queryFn: () => api<Card>('stock.card', { material_id: id, from: range.from, to: range.to }), enabled: !!id });
  const d = q.data;
  const rows = useMemo(() => [...(d?.rows || [])].reverse(), [d]);
  const cols: ColumnDef<StockMove, any>[] = [
    { accessorKey: 'tanggal', header: 'Tanggal', cell: (c) => <span className="num whitespace-nowrap">{tgl(c.getValue())}</span> },
    { id: 'jenis', accessorFn: (r) => JENIS_MOVE[r.jenis] || r.jenis, header: 'Jenis', meta: { filter: 'select' }, cell: (c) => <span className={`pill ${c.row.original.qty > 0 ? 'pill-ok' : c.row.original.jenis === 'opname' ? 'pill-warn' : 'pill-mute'}`}>{c.getValue()}</span> },
    { accessorKey: 'keterangan', header: 'Keterangan', cell: (c) => <span className="text-xs">{c.getValue()}</span> },
    { id: 'masuk', accessorFn: (r) => (r.qty > 0 ? r.qty : 0), header: 'Masuk', meta: { align: 'right', total: true }, cell: (c) => (c.getValue() ? <span className="num text-ok">{dec(c.getValue())}</span> : '') },
    { id: 'keluar', accessorFn: (r) => (r.qty < 0 ? -r.qty : 0), header: 'Keluar', meta: { align: 'right', total: true }, cell: (c) => (c.getValue() ? <span className="num text-bad">{dec(c.getValue())}</span> : '') },
    { accessorKey: 'saldo_berjalan', header: 'Saldo', meta: { align: 'right' }, cell: (c) => <b className="num">{dec(c.getValue())}</b> },
    ...(seeCost ? [{ accessorKey: 'harga', header: 'Harga', meta: { align: 'right' }, cell: (c: any) => <span className="num text-xs">{dec(c.getValue())}</span> } as ColumnDef<StockMove, any>] : []),
  ];
  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Saldo awal" v={d ? dec(d.saldo_awal) : '…'} />
        <Stat label="Masuk" v={d ? dec(d.masuk) : '…'} tone="text-ok" />
        <Stat label="Keluar" v={d ? dec(d.keluar) : '…'} tone="text-bad" />
        <Stat label="Saldo akhir" v={d ? `${dec(d.saldo_akhir)} ${d.material.satuan}` : '…'} />
      </div>
      <DataTable<StockMove> data={rows} loading={q.isLoading} columns={cols} title={`Kartu stok ${d?.material.nama || ''}`} storageKey="stok-kartu" canExport={can('stok', 'ekspor')}
        toolbar={<>
          <select id="kartu-bahan" className="input w-auto min-w-[200px]" value={id} onChange={(e) => onPick(e.target.value)}>{mats.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}</select>
          <DateRangeFilter value={range} onChange={setRange} id="kartu-range" />
        </>}
        cardTitle={(r) => <span className="flex justify-between gap-2"><span>{JENIS_MOVE[r.jenis] || r.jenis} {r.qty > 0 ? '+' : ''}{dec(r.qty)}</span><span className="num text-sm">{tgl(r.tanggal)}</span></span>}
        emptyText="Tidak ada mutasi di periode ini." />
    </>
  );
}

function Stat({ label, v, tone = '' }: { label: string; v: string; tone?: string }) {
  return <div className="card p-3"><div className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</div><div className={`num mt-0.5 text-lg font-extrabold ${tone}`}>{v}</div></div>;
}

function OpnameTab({ mats }: { mats: Material[] }) {
  const { can } = useAuth();
  const q = useQuery({ queryKey: ['opnames'], queryFn: () => api<Opname[]>('opname.list') });
  const [form, setForm] = useState(false);
  const [view, setView] = useState<Opname | null>(null);
  const last = q.data?.[0];
  const days = last ? Math.floor((Date.now() - new Date(last.tanggal + 'T00:00:00').getTime()) / 864e5) : null;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className={`flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-sm ${days == null || days > 30 ? 'border-warn/40 bg-warn/5' : 'border-line'}`}>
          <ClipboardCheck size={18} className="shrink-0 text-muted" />
          {last ? <span>Opname terakhir <b>{tgl(last.tanggal)}</b> ({days === 0 ? 'hari ini' : `${days} hari lalu`}) oleh {last.oleh || '–'}. {days! > 30 && 'Sudah lebih dari sebulan, sebaiknya cek fisik lagi.'}</span> : <span>Belum pernah stok opname. Hitung fisik bahan di gudang lalu catat di sini supaya stok sistem sesuai kenyataan.</span>}
        </div>
        {can('stok', 'tambah') && <button id="opn-new" className="btn btn-primary" onClick={() => setForm(true)}><ClipboardCheck size={16} />Mulai stok opname</button>}
      </div>
      <div className="card divide-y divide-line">
        {q.isLoading && <div className="p-4 text-sm text-muted">Memuat…</div>}
        {!q.isLoading && !q.data?.length && <div className="p-6 text-center text-sm text-muted">Belum ada riwayat stok opname.</div>}
        {q.data?.map((o) => (
          <button key={o.id} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-sunk" onClick={() => setView(o)}>
            <span className="num w-28 shrink-0 font-semibold">{tgl(o.tanggal)}</span>
            <span className="min-w-0 flex-1 truncate">{o.keterangan || 'Stok opname'} <span className="text-muted">· {o.jumlah_item} bahan · {o.oleh}</span></span>
            <span className={`num font-bold ${o.nilai_selisih < 0 ? 'text-bad' : o.nilai_selisih > 0 ? 'text-ok' : 'text-muted'}`}>{o.nilai_selisih ? (o.nilai_selisih > 0 ? '+' : '') + nf(o.nilai_selisih) : 'cocok'}</span>
          </button>
        ))}
      </div>
      {form && <OpnameForm mats={mats.filter((m) => m.aktif)} onClose={() => setForm(false)} />}
      {view && (
        <Modal open onClose={() => setView(null)} size="lg" title={`Stok opname ${tgl(view.tanggal)}`} subtitle={`${view.keterangan || ''} · dicatat ${tglJam(view.created_at)} oleh ${view.oleh}`}>
          <table className="tbl w-full text-sm">
            <thead className="text-left text-xs text-muted"><tr><th className="py-1">Bahan</th><th className="text-right">Sistem</th><th className="text-right">Fisik</th><th className="text-right">Selisih</th><th className="text-right">Nilai</th></tr></thead>
            <tbody className="divide-y divide-line">{view.items.map((i) => (
              <tr key={i.id}><td className="py-1.5"><b>{i.nama}</b>{i.keterangan && <span className="block text-xs text-muted">{i.keterangan}</span>}</td><td className="num text-right">{dec(i.stok_sistem)}</td><td className="num text-right">{dec(i.stok_fisik)}</td>
                <td className={`num text-right font-bold ${i.selisih < 0 ? 'text-bad' : i.selisih > 0 ? 'text-ok' : 'text-muted'}`}>{i.selisih > 0 ? '+' : ''}{dec(i.selisih)}</td><td className="num text-right">{nf(i.nilai)}</td></tr>
            ))}</tbody>
          </table>
        </Modal>
      )}
    </>
  );
}

function OpnameForm({ mats, onClose }: { mats: Material[]; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [ket, setKet] = useState('');
  const [fisik, setFisik] = useState<Record<string, string>>({});
  const [catatan, setCatatan] = useState<Record<string, string>>({});
  const [kat, setKat] = useState('');
  const kats = [...new Set(mats.map((m) => m.kategori).filter(Boolean))];
  const shown = mats.filter((m) => !kat || m.kategori === kat);
  const filled = mats.filter((m) => fisik[m.id] != null && fisik[m.id] !== '');
  const save = useMutation({
    mutationFn: () => api<{ jumlah_item: number; nilai_selisih: number }>('opname.save', { keterangan: ket, lines: filled.map((m) => ({ material_id: m.id, stok_fisik: numIn(fisik[m.id]), keterangan: catatan[m.id] || '' })) }),
    onSuccess: (r) => { ['opnames', 'stock-meta', 'stock-card', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast(`Opname ${r.jumlah_item} bahan tersimpan${r.nilai_selisih ? `, selisih ${nf(r.nilai_selisih)}` : ', semua cocok'}`); onClose(); },
  });
  return (
    <Modal open onClose={onClose} size="xl" title="Stok opname" subtitle="Isi jumlah fisik hasil hitung di gudang. Bahan yang dikosongkan tidak ikut dicek. Selisih langsung mengoreksi stok."
      footer={<><span className="mr-auto text-xs text-muted">{filled.length} bahan diisi</span><button className="btn" onClick={onClose}>Batal</button><button id="opn-save" className="btn btn-primary" disabled={!filled.length || save.isPending} onClick={() => save.mutate()}>Simpan opname</button></>}>
      <div className="mb-3 flex flex-wrap gap-3">
        <input id="opn-ket" className="input flex-1" placeholder="Keterangan, mis. Cek akhir bulan gudang kertas" value={ket} onChange={(e) => setKet(e.target.value)} />
        {kats.length > 1 && <select id="opn-kat" className="input w-auto" value={kat} onChange={(e) => setKat(e.target.value)}><option value="">Semua kategori</option>{kats.map((k) => <option key={k}>{k}</option>)}</select>}
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="tbl w-full min-w-[640px] text-sm">
          <thead className="bg-sunk text-left text-xs text-muted"><tr><th className="px-3 py-2">Bahan</th><th className="px-2 text-right">Stok sistem</th><th className="w-32 px-2 text-right">Hitung fisik</th><th className="w-24 px-2 text-right">Selisih</th><th className="px-2">Catatan</th></tr></thead>
          <tbody className="divide-y divide-line">
            {shown.map((m, i) => {
              const has = fisik[m.id] != null && fisik[m.id] !== '';
              const sel = has ? numIn(fisik[m.id]) - m.stok : 0;
              return (
                <tr key={m.id}>
                  <td className="px-3 py-1.5 font-semibold">{m.nama}<span className="block text-[11px] font-normal text-muted">{m.kategori}</span></td>
                  <td className="num px-2 text-right">{dec(m.stok)} <span className="text-xs text-muted">{m.satuan}</span></td>
                  <td className="px-2"><input id={`opn-fisik-${i}`} className="input num text-right" inputMode="decimal" value={fisik[m.id] ?? ''} onChange={(e) => setFisik((x) => ({ ...x, [m.id]: e.target.value }))} /></td>
                  <td className={`num px-2 text-right font-bold ${!has ? 'text-muted' : sel < 0 ? 'text-bad' : sel > 0 ? 'text-ok' : 'text-muted'}`}>{has ? (sel ? (sel > 0 ? '+' : '') + dec(sel) : 'cocok') : '–'}</td>
                  <td className="px-2"><input className="input" value={catatan[m.id] || ''} onChange={(e) => setCatatan((x) => ({ ...x, [m.id]: e.target.value }))} placeholder={has && sel ? 'alasan selisih' : ''} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3"><ErrorBox error={save.error} /></div>
    </Modal>
  );
}

function BelanjaTab({ low }: { low: Material[] }) {
  const { can } = useAuth();
  const meta = useStockMeta();
  const purchases = usePurchases('', '', can('pembelian'));
  const [pick, setPick] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState(false);
  useEffect(() => { setPick(Object.fromEntries(low.map((m) => [m.id, true]))); }, [low.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const last = lastBuy(purchases.data);
  const chosen = low.filter((m) => pick[m.id]);
  const est = chosen.reduce((a, m) => { const l = last[m.id]; return a + (l ? Math.ceil(saranBeli(m) / (l.isi || 1)) * l.harga_beli : saranBeli(m) * m.harga_terakhir); }, 0);
  if (!low.length) return <div className="card flex items-center gap-3 p-6 text-sm text-muted"><PackagePlus size={18} />Semua bahan masih di atas stok minimum. Tidak ada yang perlu dibeli sekarang.</div>;
  return (
    <>
      <div className="mb-3 flex items-start gap-3 rounded-xl border border-warn/40 bg-warn/5 px-4 py-3 text-sm"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-warn" /><span>Bahan di bawah ini sudah menyentuh atau di bawah stok minimum. Usulan jumlah = isi kembali sampai 3× batas minimum.</span></div>
      <div className="card divide-y divide-line">
        {low.map((m) => {
          const l = last[m.id];
          const s = saranBeli(m);
          return (
            <label key={m.id} className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[var(--brand,#F26B1D)]" checked={!!pick[m.id]} onChange={(e) => setPick((x) => ({ ...x, [m.id]: e.target.checked }))} />
              <span className="min-w-0 flex-1"><b>{m.nama}</b><span className="block text-xs text-muted">Stok {dec(m.stok)} / min {dec(m.stok_min)} {m.satuan}</span></span>
              <span className="text-right"><span className="num font-bold">{dec(s)} {m.satuan}</span>{l && <span className="block text-xs text-muted">≈ {Math.ceil(s / (l.isi || 1))} {l.satuan_beli} @ {nf(l.harga_beli)}</span>}</span>
              <span className={`pill ${STATUS_STOK[m.status][1]}`}>{STATUS_STOK[m.status][0]}</span>
            </label>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted">Perkiraan belanja: <b className="num text-ink">{rp(est)}</b></span>
        {can('pembelian', 'tambah') && <button id="belanja-buat" className="btn btn-primary" disabled={!chosen.length || !meta.data} onClick={() => setForm(true)}><ShoppingBag size={16} />Buat pembelian ({chosen.length})</button>}
      </div>
      {form && meta.data && <PurchaseForm meta={meta.data} last={last} initial={chosen.map((m) => ({ material_id: m.id, qty_stok: saranBeli(m) }))} onClose={() => setForm(false)} />}
    </>
  );
}

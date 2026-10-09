import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, Info, Lock } from 'lucide-react';
import { DataTable } from '@/components/table/DataTable';
import { DateRangeFilter, rangeFor, type DateRange } from '@/components/table/DateRangeFilter';
import { exportBook } from '@/components/table/exportXlsx';
import { TrendBars } from '@/components/TrendBars';
import { ErrorBox, PageHeader } from '@/components/ui/Field';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { addDays, nf, rp, tgl, ymd } from '@/lib/format';

interface Ringkas {
  omzet: number; nota: number; rata_nota: number; klik: number; piutang_periode: number;
  masuk: number; keluar_lunas: number; keluar_hutang: number; kas_kecil: number; arus_kas: number; pengeluaran_total: number;
  hpp?: number; laba_kotor?: number; omzet_ber_hpp?: number; cakupan_hpp?: number; biaya_operasional?: number;
}
interface Produk { product_id: string; nama: string; qty: number; klik: number; omzet: number; nota: number; hpp?: number; hpp_lengkap?: boolean; laba?: number }
interface Cs { id: string; nama: string; omzet: number; nota: number; klik: number }
interface Mesin { id: string; nama: string; omzet: number; item: number; klik: number }
interface Metode { id: string; nama: string; jenis: string; masuk: number; transaksi: number }
interface Konsumen { id: string; nama: string; tipe: string; omzet: number; nota: number; sisa: number }
interface Kategori { id: string; nama: string; jenis: string; total: number; transaksi: number }
interface Report {
  from: string; to: string; can_laba: boolean; ringkas: Ringkas;
  harian: { tanggal: string; omzet: number; masuk: number; nota: number }[];
  per_produk: Produk[]; per_cs: Cs[]; per_mesin: Mesin[]; per_metode: Metode[]; per_konsumen: Konsumen[]; per_kategori: Kategori[];
}

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1).replace('.', ',')}%` : '–');
const BULAN = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
const right = { align: 'right' as const, total: true };
const money = (c: { getValue: () => unknown }) => <span className="num">{nf(c.getValue() as number)}</span>;

/** Pengganti sheet "Rekap": angka periode, laba kotor (khusus yang berhak), arus kas, dan rincian per produk/CS/mesin/metode/konsumen/kategori. */
export function LaporanPage() {
  const { can } = useAuth();
  const [range, setRange] = useState<DateRange>(rangeFor('bulan_ini'));
  const to = range.to || ymd();
  const from = range.from || addDays(to, -365);
  const q = useQuery({ queryKey: ['report', from, to], queryFn: () => api<Report>('report.summary', { from, to }) });
  const d = q.data;
  const r = d?.ringkas;
  const [tab, setTab] = useState<'produk' | 'cs' | 'mesin' | 'metode' | 'konsumen' | 'kategori'>('produk');

  // Rentang panjang (lebih dari 2 bulan) dikelompokkan per bulan supaya grafik tetap terbaca.
  const trend = useMemo(() => {
    const h = d?.harian || [];
    if (h.length <= 62) return { data: h, monthly: false };
    const m: Record<string, { tanggal: string; omzet: number; masuk: number }> = {};
    h.forEach((x) => { const k = x.tanggal.slice(0, 7) + '-01'; const t = (m[k] ||= { tanggal: k, omzet: 0, masuk: 0 }); t.omzet += x.omzet; t.masuk += x.masuk; });
    return { data: Object.values(m), monthly: true };
  }, [d?.harian]);

  const tabs = [
    ['produk', 'Produk', d?.per_produk.length], ['cs', 'CS / FO', d?.per_cs.length], ['mesin', 'Mesin', d?.per_mesin.length],
    ['metode', 'Metode bayar', d?.per_metode.length], ['konsumen', 'Konsumen', d?.per_konsumen.length], ['kategori', 'Pengeluaran', d?.per_kategori.length],
  ] as const;

  const exportAll = () => {
    if (!d || !r) return;
    const name = `Laporan_${d.from}_sd_${d.to}`;
    const ring: Record<string, unknown>[] = [
      { Pos: 'Omzet (nota dibuat)', Nilai: r.omzet }, { Pos: 'Jumlah nota', Nilai: r.nota }, { Pos: 'Rata-rata per nota', Nilai: r.rata_nota },
      { Pos: 'Total klik', Nilai: r.klik }, { Pos: 'Sisa piutang dari nota periode ini', Nilai: r.piutang_periode },
      { Pos: 'Uang masuk', Nilai: r.masuk }, { Pos: 'Pengeluaran dibayar lunas', Nilai: -r.keluar_lunas }, { Pos: 'Bayar hutang supplier', Nilai: -r.keluar_hutang },
      { Pos: 'Kas kecil keluar', Nilai: -r.kas_kecil }, { Pos: 'Arus kas bersih', Nilai: r.arus_kas }, { Pos: 'Total pengeluaran (termasuk hutang)', Nilai: r.pengeluaran_total },
      ...(d.can_laba ? [
        { Pos: 'Omzet yang punya harga beli', Nilai: r.omzet_ber_hpp }, { Pos: 'HPP (harga pokok)', Nilai: r.hpp }, { Pos: 'Laba kotor', Nilai: r.laba_kotor },
        { Pos: 'Cakupan HPP (%)', Nilai: r.cakupan_hpp }, { Pos: 'Biaya operasional', Nilai: r.biaya_operasional }, { Pos: 'Perkiraan laba bersih', Nilai: (r.laba_kotor || 0) - (r.biaya_operasional || 0) },
      ] : []),
    ];
    exportBook([
      { name: 'Ringkasan', rows: ring },
      { name: 'Harian', rows: d.harian.map((x) => ({ Tanggal: x.tanggal, Nota: x.nota, Omzet: x.omzet, 'Uang masuk': x.masuk })) },
      { name: 'Produk', rows: d.per_produk.map((x) => ({ Produk: x.nama, Nota: x.nota, Qty: x.qty, Klik: x.klik, Omzet: x.omzet, ...(d.can_laba ? { HPP: x.hpp, Laba: x.laba, 'HPP lengkap': x.hpp_lengkap ? 'ya' : 'tidak' } : {}) })) },
      { name: 'CS', rows: d.per_cs.map((x) => ({ CS: x.nama, Nota: x.nota, Klik: x.klik, Omzet: x.omzet })) },
      { name: 'Mesin', rows: d.per_mesin.map((x) => ({ Mesin: x.nama, Item: x.item, Klik: x.klik, Omzet: x.omzet })) },
      { name: 'Metode bayar', rows: d.per_metode.map((x) => ({ Metode: x.nama, Jenis: x.jenis, Transaksi: x.transaksi, Masuk: x.masuk })) },
      { name: 'Konsumen', rows: d.per_konsumen.map((x) => ({ Konsumen: x.nama, Tipe: x.tipe, Nota: x.nota, Omzet: x.omzet, 'Sisa piutang': x.sisa })) },
      { name: 'Pengeluaran', rows: d.per_kategori.map((x) => ({ Kategori: x.nama, Jenis: x.jenis, Transaksi: x.transaksi, Total: x.total })) },
    ], `${name}.xlsx`);
  };

  return (
    <>
      <PageHeader title="Laporan" desc="Rekap periode pengganti sheet Rekap. Omzet dihitung dari nota yang dibuat (tidak termasuk batal); uang masuk dari pembayaran yang diterima di periode itu."
        actions={<div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter value={range} onChange={setRange} id="laporan-range" />
          {(can('laporan', 'ekspor') || can('laporan')) && <button className="btn btn-ghost" disabled={!d} onClick={exportAll}><Download size={15} />Export semua</button>}
        </div>} />
      <ErrorBox error={q.error} />
      {d && <p className="-mt-2 mb-4 text-xs text-muted">Periode {tgl(d.from)} – {tgl(d.to)}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi tint="orange" label="Omzet" value={rp(r?.omzet)} sub={`${nf(r?.nota)} nota`} loading={q.isLoading} />
        <Kpi tint="purple" label="Rata-rata nota" value={rp(r?.rata_nota)} sub={`${nf(r?.klik)} klik`} loading={q.isLoading} />
        <Kpi tint="blue" label="Uang masuk" value={rp(r?.masuk)} sub={r ? `${pct(r.masuk, r.omzet)} dari omzet` : ''} loading={q.isLoading} />
        <Kpi tint="rose" label="Piutang periode ini" value={rp(r?.piutang_periode)} sub="sisa dari nota periode ini" loading={q.isLoading} bad={!!r?.piutang_periode} />
        <Kpi tint="amber" label="Total pengeluaran" value={rp(r?.pengeluaran_total)} sub="lunas + hutang" loading={q.isLoading} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="card p-4 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold">{trend.monthly ? 'Per bulan' : 'Per hari'}</h2><span className="text-xs text-muted">{trend.data.length} {trend.monthly ? 'bulan' : 'hari'}</span></div>
          {q.isLoading ? <div className="h-44 animate-pulse rounded-lg bg-sunk" /> :
            <TrendBars data={trend.data} tick={trend.monthly ? BULAN : undefined} label={trend.monthly ? (s) => new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) : undefined} />}
        </section>
        <ArusKas r={r} />
      </div>

      {d?.can_laba && r ? <Laba r={r} /> : d && can('laporan') && (
        <div className="card mt-4 flex items-center gap-3 p-4 text-sm text-muted"><Lock size={16} className="shrink-0" />Angka harga pokok dan laba hanya tampil untuk user dengan hak <b className="text-ink">Laporan laba</b>.</div>
      )}

      <div className="mb-3 mt-8 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map(([k, l, n]) => (
          <button key={k} id={`lap-tab-${k}`} onClick={() => setTab(k)} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${tab === k ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}>
            {l}{n != null && <span className="ml-1.5 text-xs font-normal text-muted">{n}</span>}
          </button>
        ))}
      </div>
      {d && <Rincian tab={tab} d={d} loading={q.isLoading} />}
    </>
  );
}

function Kpi({ label, value, sub, loading, bad, tint = 'orange' }: { label: string; value: string; sub?: string; loading?: boolean; bad?: boolean; tint?: string }) {
  return (
    <div className={`card tint tint-${tint} p-4`}>
      <div className="text-xs font-bold uppercase tracking-wider text-muted">{label}</div>
      <div className={`num mt-1.5 whitespace-nowrap text-lg font-extrabold sm:text-xl 2xl:text-2xl ${bad ? 'text-bad' : ''}`}>{loading ? '…' : value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

/** Arus kas sederhana: uang masuk dikurangi semua uang yang benar-benar keluar di periode itu. */
function ArusKas({ r }: { r?: Ringkas }) {
  const rows = r ? [
    { label: 'Uang masuk', v: r.masuk, plus: true },
    { label: 'Belanja lunas', v: r.keluar_lunas },
    { label: 'Bayar hutang supplier', v: r.keluar_hutang },
    { label: 'Kas kecil', v: r.kas_kecil },
  ] : [];
  const max = Math.max(1, ...rows.map((x) => x.v));
  return (
    <section className="card p-4">
      <h2 className="text-sm font-bold">Arus kas</h2>
      <p className="mb-3 text-xs text-muted">Uang yang benar-benar masuk dan keluar di periode ini.</p>
      <ul className="flex flex-col gap-2.5">
        {rows.map((x) => (
          <li key={x.label} className="text-sm">
            <div className="flex justify-between"><span>{x.label}</span><span className={`num font-semibold ${x.plus ? 'text-ok' : ''}`}>{x.plus ? '' : '−'}{nf(x.v)}</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-sunk"><div className="h-full rounded-full" style={{ width: `${(x.v / max) * 100}%`, background: x.plus ? 'var(--chart-2)' : 'var(--chart-1)' }} /></div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-baseline justify-between border-t border-line pt-3">
        <span className="text-sm font-bold">Arus kas bersih</span>
        <span className={`num text-xl font-extrabold ${r && r.arus_kas < 0 ? 'text-bad' : 'text-ok'}`}>{rp(r?.arus_kas)}</span>
      </div>
    </section>
  );
}

function Laba({ r }: { r: Ringkas }) {
  const lk = r.laba_kotor || 0, ops = r.biaya_operasional || 0;
  const tiles = [
    { label: 'Omzet ber-HPP', value: rp(r.omzet_ber_hpp), sub: `cakupan ${String(r.cakupan_hpp ?? 0).replace('.', ',')}% dari omzet`, tint: 'orange' },
    { label: 'HPP (harga pokok)', value: rp(r.hpp), sub: 'dari harga beli saat nota dibuat', tint: 'purple' },
    { label: 'Laba kotor', value: rp(lk), sub: `margin ${pct(lk, r.omzet_ber_hpp || 0)}`, ok: lk >= 0, tint: 'green' },
    { label: 'Biaya operasional', value: rp(ops), sub: 'non-bahan & non-aset + kas kecil', tint: 'amber' },
    { label: 'Perkiraan laba bersih', value: rp(lk - ops), sub: 'laba kotor − biaya operasional', ok: lk - ops >= 0, tint: 'teal' },
  ];
  return (
    <section className="mt-4">
      <h2 className="mb-2 text-base font-bold">Laba</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className={`card tint tint-${t.tint} p-4`}>
            <div className="text-xs font-bold uppercase tracking-wider text-muted">{t.label}</div>
            <div className={`num mt-1.5 whitespace-nowrap text-lg font-extrabold sm:text-xl ${t.ok === false ? 'text-bad' : t.ok ? 'text-ok' : ''}`}>{t.value}</div>
            <div className="mt-0.5 text-xs text-muted">{t.sub}</div>
          </div>
        ))}
      </div>
      {(r.cakupan_hpp ?? 0) < 100 && (
        <p className="mt-2 flex gap-2 text-xs text-warn"><Info size={14} className="shrink-0" />Sebagian omzet berasal dari produk yang belum punya harga beli, jadi laba kotor hanya dihitung dari {String(r.cakupan_hpp).replace('.', ',')}% omzet. Lengkapi lewat Pengeluaran (isi "isi per satuan") atau Master Produk.</p>
      )}
    </section>
  );
}

function Rincian({ tab, d, loading }: { tab: string; d: Report; loading: boolean }) {
  const omzet = d.ringkas.omzet;
  const share = (v: number, tot: number) => (
    <span className="flex items-center justify-end gap-2"><span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-sunk sm:block"><span className="block h-full bg-brand" style={{ width: `${tot ? (v / tot) * 100 : 0}%` }} /></span><span className="num w-12 text-xs text-muted">{pct(v, tot)}</span></span>
  );
  const common = { loading, initialSort: [{ id: tab === 'metode' ? 'masuk' : tab === 'kategori' ? 'total' : 'omzet', desc: true }] };
  if (tab === 'produk') {
    const cols: ColumnDef<Produk, any>[] = [
      { accessorKey: 'nama', header: 'Produk', cell: (c) => <span className="font-semibold">{c.getValue()}</span> },
      { accessorKey: 'nota', header: 'Nota', meta: right },
      { accessorKey: 'qty', header: 'Qty', meta: right, cell: money },
      { accessorKey: 'klik', header: 'Klik', meta: { ...right, hideOnCard: true }, cell: money },
      { accessorKey: 'omzet', header: 'Omzet', meta: right, cell: (c) => <b className="num">{nf(c.getValue())}</b> },
      { id: 'porsi', accessorFn: (x) => x.omzet, header: 'Porsi', enableSorting: false, meta: { align: 'right', hideOnCard: true }, cell: (c) => share(c.getValue(), omzet) },
      ...(d.can_laba ? [
        { id: 'hpp', accessorFn: (x) => (x.hpp ? x.hpp : x.hpp_lengkap ? 0 : null), header: 'HPP', meta: right, cell: (c) => c.getValue() == null ? <span className="text-xs text-warn" title="Produk ini belum punya harga beli">belum ada</span> : <span className="num">{c.row.original.hpp_lengkap ? nf(c.getValue()) : <span className="text-warn" title="Sebagian item belum punya harga beli">{nf(c.getValue())}*</span>}</span> },
        { id: 'laba', accessorFn: (x) => (x.hpp_lengkap ? x.laba : null), header: 'Laba kotor', meta: right, cell: (c) => c.getValue() == null ? <span className="text-muted">–</span> : <span className={`num font-semibold ${c.getValue() < 0 ? 'text-bad' : 'text-ok'}`}>{nf(c.getValue())}</span> },
        { id: 'margin', accessorFn: (x) => (x.hpp_lengkap && x.omzet ? (x.laba || 0) / x.omzet : null), header: 'Margin', meta: { align: 'right' }, cell: (c) => <span className="num text-xs">{c.getValue() == null ? '–' : `${(c.getValue() * 100).toFixed(0)}%`}</span> },
      ] as ColumnDef<Produk, any>[] : []),
    ];
    return <DataTable<Produk> key="p" data={d.per_produk} columns={cols} title="Laporan_produk" storageKey="lap-produk" {...common} cardTitle={(x) => x.nama} />;
  }
  if (tab === 'cs') {
    const cols: ColumnDef<Cs, any>[] = [
      { accessorKey: 'nama', header: 'CS / FO', cell: (c) => <span className="font-semibold">{c.getValue()}</span> },
      { accessorKey: 'nota', header: 'Nota', meta: right },
      { accessorKey: 'klik', header: 'Klik', meta: right, cell: money },
      { accessorKey: 'omzet', header: 'Omzet', meta: right, cell: (c) => <b className="num">{nf(c.getValue())}</b> },
      { id: 'rata', accessorFn: (x) => (x.nota ? x.omzet / x.nota : 0), header: 'Rata-rata nota', meta: { align: 'right' }, cell: money },
      { id: 'porsi', accessorFn: (x) => x.omzet, header: 'Porsi', enableSorting: false, meta: { align: 'right', hideOnCard: true }, cell: (c) => share(c.getValue(), omzet) },
    ];
    return <DataTable<Cs> key="c" data={d.per_cs} columns={cols} title="Laporan_CS" storageKey="lap-cs" {...common} cardTitle={(x) => x.nama} />;
  }
  if (tab === 'mesin') {
    const cols: ColumnDef<Mesin, any>[] = [
      { accessorKey: 'nama', header: 'Mesin', cell: (c) => <span className="font-semibold">{c.getValue()}</span> },
      { accessorKey: 'item', header: 'Item', meta: right },
      { accessorKey: 'klik', header: 'Klik', meta: right, cell: money },
      { accessorKey: 'omzet', header: 'Omzet', meta: right, cell: (c) => <b className="num">{nf(c.getValue())}</b> },
      { id: 'porsi', accessorFn: (x) => x.omzet, header: 'Porsi', enableSorting: false, meta: { align: 'right', hideOnCard: true }, cell: (c) => share(c.getValue(), omzet) },
    ];
    return <DataTable<Mesin> key="m" data={d.per_mesin} columns={cols} title="Laporan_mesin" storageKey="lap-mesin" {...common} cardTitle={(x) => x.nama} />;
  }
  if (tab === 'metode') {
    const cols: ColumnDef<Metode, any>[] = [
      { accessorKey: 'nama', header: 'Metode', cell: (c) => <span className="font-semibold">{c.getValue()}</span> },
      { accessorKey: 'jenis', header: 'Jenis', meta: { filter: 'select' } },
      { accessorKey: 'transaksi', header: 'Transaksi', meta: right },
      { accessorKey: 'masuk', header: 'Uang masuk', meta: right, cell: (c) => <b className="num">{nf(c.getValue())}</b> },
      { id: 'porsi', accessorFn: (x) => x.masuk, header: 'Porsi', enableSorting: false, meta: { align: 'right', hideOnCard: true }, cell: (c) => share(c.getValue(), d.ringkas.masuk) },
    ];
    return <DataTable<Metode> key="t" data={d.per_metode} columns={cols} title="Laporan_metode_bayar" storageKey="lap-metode" {...common} cardTitle={(x) => x.nama} />;
  }
  if (tab === 'konsumen') {
    const cols: ColumnDef<Konsumen, any>[] = [
      { accessorKey: 'nama', header: 'Konsumen', cell: (c) => <span className="font-semibold">{c.getValue()}</span> },
      { accessorKey: 'tipe', header: 'Tipe', meta: { filter: 'select' }, cell: (c) => <span className="capitalize">{c.getValue() === 'end_user' ? 'end user' : c.getValue()}</span> },
      { accessorKey: 'nota', header: 'Nota', meta: right },
      { accessorKey: 'omzet', header: 'Omzet', meta: right, cell: (c) => <b className="num">{nf(c.getValue())}</b> },
      { accessorKey: 'sisa', header: 'Sisa piutang', meta: right, cell: (c) => <span className={`num ${c.getValue() ? 'font-semibold text-bad' : 'text-muted'}`}>{nf(c.getValue())}</span> },
    ];
    return <DataTable<Konsumen> key="k" data={d.per_konsumen} columns={cols} title="Laporan_konsumen" storageKey="lap-konsumen" {...common} cardTitle={(x) => x.nama} />;
  }
  const cols: ColumnDef<Kategori, any>[] = [
    { accessorKey: 'nama', header: 'Kategori', cell: (c) => <span className="font-semibold">{c.getValue()}</span> },
    { accessorKey: 'jenis', header: 'Jenis', meta: { filter: 'select' }, cell: (c) => <span className="capitalize">{c.getValue()}</span> },
    { accessorKey: 'transaksi', header: 'Transaksi', meta: right },
    { accessorKey: 'total', header: 'Total', meta: right, cell: (c) => <b className="num">{nf(c.getValue())}</b> },
    { id: 'porsi', accessorFn: (x) => x.total, header: 'Porsi', enableSorting: false, meta: { align: 'right', hideOnCard: true }, cell: (c) => share(c.getValue(), d.ringkas.pengeluaran_total) },
  ];
  return <DataTable<Kategori> key="g" data={d.per_kategori} columns={cols} title="Laporan_pengeluaran" storageKey="lap-kategori" {...common} emptyText="Belum ada pengeluaran di periode ini." cardTitle={(x) => x.nama} />;
}

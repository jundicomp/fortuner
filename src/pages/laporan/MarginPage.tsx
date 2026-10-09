import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/table/DataTable';
import { ErrorBox, PageHeader } from '@/components/ui/Field';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { nf } from '@/lib/format';
import { dec } from '@/pages/stok/stokApi';

type Cell = { harga: number; margin: number } | null;
interface Row {
  id: string; kode: string; nama: string; kategori: string; jenis_harga: string; mesin: string; resep: boolean;
  hpp_bahan: number; hpp_klik: number; hpp: number; hpp_bb: number | null; es: Cell; rb: Cell; es_bb: Cell; rb_bb: Cell; margin_terendah: number | null;
  status: 'tanpa_resep' | 'tanpa_harga' | 'rugi' | 'tipis' | 'aman';
}
const STATUS: Record<Row['status'], [string, string]> = { rugi: ['Rugi', 'pill-bad'], tipis: ['Tipis', 'pill-warn'], aman: ['Aman', 'pill-ok'], tanpa_resep: ['Belum ada resep', 'pill-mute'], tanpa_harga: ['Belum ada harga', 'pill-mute'] };

/** HPP per produk (resep × harga rata-rata bahan + klik) dibanding harga jual tiap kolom harga. */
export function MarginPage() {
  const { can } = useAuth();
  const q = useQuery({ queryKey: ['margin'], queryFn: () => api<{ margin_min: number; rows: Row[] }>('margin.list') });
  const min = q.data?.margin_min ?? 20;
  const rows = q.data?.rows || [];
  const cell = (c: Cell) => (c ? <span className="num whitespace-nowrap"><span className="text-muted">{nf(c.harga)}</span> <b className={c.margin < 0 ? 'text-bad' : c.margin < min ? 'text-warn' : 'text-ok'}>{c.margin.toFixed(1).replace('.', ',')}%</b></span> : <span className="text-muted">–</span>);
  const ex = (k: 'es' | 'rb' | 'es_bb' | 'rb_bb') => (r: Row) => (r[k] ? r[k]!.margin : '');
  const cols: ColumnDef<Row, any>[] = [
    { accessorKey: 'kode', header: 'Kode', meta: { className: 'font-mono text-xs', hideOnCard: true } },
    { accessorKey: 'nama', header: 'Produk', cell: (c) => <span className="font-semibold">{c.getValue()}<span className="block text-[11px] font-normal text-muted">{c.row.original.mesin}</span></span>, meta: { hideOnCard: true } },
    { accessorKey: 'kategori', header: 'Kategori', meta: { filter: 'select' } },
    { accessorKey: 'hpp', header: 'HPP / unit', meta: { align: 'right' }, cell: (c) => <span className="num" title={`bahan ${dec(c.row.original.hpp_bahan)} + klik ${dec(c.row.original.hpp_klik)}`}>{dec(c.getValue())}</span> },
    { accessorKey: 'hpp_bb', header: 'HPP BB', meta: { align: 'right' }, cell: (c) => (c.getValue() != null ? <span className="num">{dec(c.getValue())}</span> : <span className="text-muted">–</span>) },
    { id: 'es', accessorFn: (r) => r.es?.margin ?? null, header: 'End user sedikit', meta: { align: 'right', exportValue: ex('es') }, cell: (c) => cell(c.row.original.es) },
    { id: 'rb', accessorFn: (r) => r.rb?.margin ?? null, header: 'Reseller banyak', meta: { align: 'right', exportValue: ex('rb') }, cell: (c) => cell(c.row.original.rb) },
    { id: 'es_bb', accessorFn: (r) => r.es_bb?.margin ?? null, header: 'End user sedikit BB', meta: { align: 'right', exportValue: ex('es_bb') }, cell: (c) => cell(c.row.original.es_bb) },
    { id: 'rb_bb', accessorFn: (r) => r.rb_bb?.margin ?? null, header: 'Reseller banyak BB', meta: { align: 'right', exportValue: ex('rb_bb') }, cell: (c) => cell(c.row.original.rb_bb) },
    { id: 'status', accessorFn: (r) => STATUS[r.status][0], header: 'Status', meta: { filter: 'select' }, cell: (c) => <span className={`pill ${STATUS[c.row.original.status][1]}`}>{c.getValue()}</span> },
  ];
  const n = (s: Row['status']) => rows.filter((r) => r.status === s).length;
  return (
    <>
      <PageHeader title="Margin Produk" desc={<>HPP dihitung dari resep bahan × harga rata-rata terbaru + biaya klik mesin, lalu dibanding harga jual yang berlaku. Margin di bawah <b>{min}%</b> ditandai tipis (atur di Pengaturan → Umum).</>} />
      <ErrorBox error={q.error} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <section className="card tint tint-rose p-4"><div className="text-xs font-bold uppercase tracking-wider text-muted">Rugi</div><div className="num mt-1 text-2xl font-extrabold">{n('rugi')}</div><div className="text-xs text-muted">harga di bawah HPP</div></section>
        <section className="card tint tint-amber p-4"><div className="text-xs font-bold uppercase tracking-wider text-muted">Margin tipis</div><div className="num mt-1 text-2xl font-extrabold">{n('tipis')}</div><div className="text-xs text-muted">di bawah {min}%</div></section>
        <section className="card tint tint-green p-4"><div className="text-xs font-bold uppercase tracking-wider text-muted">Aman</div><div className="num mt-1 text-2xl font-extrabold">{n('aman')}</div></section>
        <section className="card tint tint-blue p-4"><div className="text-xs font-bold uppercase tracking-wider text-muted">Belum lengkap</div><div className="num mt-1 text-2xl font-extrabold">{n('tanpa_resep') + n('tanpa_harga')}</div><div className="text-xs text-muted">isi resep di <Link className="text-brand underline" to="/master/produk">Produk</Link></div></section>
      </div>
      {n('rugi') > 0 && <div className="mb-3 flex items-start gap-2 rounded-xl border border-bad/30 bg-bad/5 px-4 py-3 text-sm"><AlertTriangle size={17} className="mt-0.5 shrink-0 text-bad" /><span>Ada produk yang harga jualnya di bawah HPP: {rows.filter((r) => r.status === 'rugi').map((r) => r.nama).join(', ')}. Periksa harga atau resepnya.</span></div>}
      <DataTable<Row> data={rows} loading={q.isLoading} columns={cols} title="Margin produk" storageKey="margin" canExport={can('laporan.laba', 'ekspor')}
        initialSort={[{ id: 'rb', desc: false }]} searchPlaceholder="Cari produk…"
        cardTitle={(r) => <span className="flex justify-between gap-2"><span>{r.nama}</span><span className={`pill ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span></span>} emptyText="Belum ada produk." />
      <p className="mt-2 text-xs text-muted">Ditampilkan harga tertinggi (end user sedikit) dan terendah (reseller banyak). Kolom BB (bolak-balik) memakai HPP 2 klik. Semua per lembar.</p>
    </>
  );
}

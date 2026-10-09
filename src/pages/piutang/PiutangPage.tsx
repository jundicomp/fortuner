import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/table/DataTable';
import { PageHeader } from '@/components/ui/Field';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { sync } from '@/lib/offline';
import { nf, rp, tgl, ymd } from '@/lib/format';
import { BAYAR, OrderDetailModal } from '@/pages/order/OrderDetailModal';
import type { Order } from '@/types';

const BUCKETS = [
  { key: '0-7', label: '0–7 hari', max: 7 },
  { key: '8-30', label: '8–30 hari', max: 30 },
  { key: '31-90', label: '31–90 hari', max: 90 },
  { key: '>90', label: 'Lebih 90 hari', max: Infinity },
];
const COLORS = ['rgb(var(--ok))', 'rgb(var(--warn))', 'rgb(var(--brand))', 'rgb(var(--bad))'];
const umur = (tanggal: string, today: string) => Math.max(0, Math.round((Date.parse(today) - Date.parse(tanggal)) / 864e5));
const bucketOf = (h: number) => BUCKETS.find((b) => h <= b.max)!.key;

interface PerKonsumen { customer_id: string; nama: string; tipe: string; telp: string; nota: number; sisa: number; tertua: number }
type Row = Order & { umur: number; bucket: string };

export function PiutangPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['orders', 'piutang'], queryFn: () => api<Order[]>('orders.list', { piutang: true }), retry: 0 });
  useEffect(() => { const off = sync.onSynced(() => qc.invalidateQueries({ queryKey: ['orders'] })); return () => { off(); }; }, [qc]);
  const [tab, setTab] = useState<'konsumen' | 'nota'>('konsumen');
  const [bucket, setBucket] = useState('');
  const [konsumen, setKonsumen] = useState<{ id: string; nama: string } | null>(null);
  const [open, setOpen] = useState('');
  const today = ymd();

  const rows: Row[] = useMemo(() => (q.data || []).map((o) => { const u = umur(o.tanggal, today); return { ...o, umur: u, bucket: bucketOf(u) }; }), [q.data, today]);
  const total = rows.reduce((a, r) => a + r.sisa, 0);
  const byBucket = BUCKETS.map((b) => { const rs = rows.filter((r) => r.bucket === b.key); return { ...b, sisa: rs.reduce((a, r) => a + r.sisa, 0), nota: rs.length }; });
  const maxB = Math.max(1, ...byBucket.map((b) => b.sisa));
  const filtered = rows.filter((r) => (!bucket || r.bucket === bucket) && (!konsumen || r.customer_id === konsumen.id));
  const perKonsumen: PerKonsumen[] = useMemo(() => {
    const m: Record<string, PerKonsumen> = {};
    rows.filter((r) => !bucket || r.bucket === bucket).forEach((r) => {
      const k = (m[r.customer_id] ||= { customer_id: r.customer_id, nama: r.customer_nama || '', tipe: r.customer_tipe || '', telp: r.customer_telp || '', nota: 0, sisa: 0, tertua: 0 });
      k.nota++; k.sisa += r.sisa; k.tertua = Math.max(k.tertua, r.umur);
    });
    return Object.values(m);
  }, [rows, bucket]);

  const kCols: ColumnDef<PerKonsumen, any>[] = [
    { accessorKey: 'nama', header: 'Konsumen', cell: (c) => <span className="font-semibold">{c.getValue()}</span>, meta: { hideOnCard: true } },
    { accessorKey: 'tipe', header: 'Tipe', meta: { filter: 'select', filterLabel: (v) => (v === 'reseller' ? 'Reseller' : 'End user') }, cell: (c) => (c.getValue() === 'reseller' ? <span className="pill pill-brand">Reseller</span> : <span className="pill pill-mute">End user</span>) },
    { accessorKey: 'telp', header: 'Telepon' },
    { accessorKey: 'nota', header: 'Nota', meta: { align: 'right', total: true } },
    { accessorKey: 'tertua', header: 'Tertua', meta: { align: 'right', exportValue: (r: PerKonsumen) => r.tertua }, cell: (c) => <span className={c.getValue() > 30 ? 'font-bold text-bad' : ''}>{c.getValue()} hari</span> },
    { accessorKey: 'sisa', header: 'Sisa piutang', meta: { align: 'right', total: true, money: true }, cell: (c) => <span className="font-bold">{nf(c.getValue())}</span> },
  ];
  const nCols: ColumnDef<Row, any>[] = [
    { accessorKey: 'nomor', header: 'No. nota', cell: (c) => <span className="font-mono text-xs font-bold">{c.getValue()}</span>, meta: { hideOnCard: true } },
    { accessorKey: 'tanggal', header: 'Tanggal', cell: (c) => <span className="num whitespace-nowrap">{tgl(c.getValue())}</span> },
    { accessorKey: 'umur', header: 'Umur', meta: { align: 'right' }, cell: (c) => <span className={c.getValue() > 30 ? 'font-bold text-bad' : c.getValue() > 7 ? 'text-warn' : ''}>{c.getValue()} hari</span> },
    { accessorKey: 'customer_nama', header: 'Konsumen', cell: (c) => <span className="font-semibold">{c.getValue()}</span> },
    { accessorKey: 'total', header: 'Total', meta: { align: 'right', total: true, money: true }, cell: (c) => nf(c.getValue()) },
    { accessorKey: 'terbayar', header: 'Terbayar', meta: { align: 'right', total: true, money: true, hideOnCard: true }, cell: (c) => nf(c.getValue()) },
    { accessorKey: 'sisa', header: 'Sisa', meta: { align: 'right', total: true, money: true }, cell: (c) => <span className="font-bold text-bad">{nf(c.getValue())}</span> },
    { accessorKey: 'status_bayar', header: 'Status', meta: { filter: 'select', filterLabel: (v) => BAYAR[String(v)]?.[0] || String(v) }, cell: (c) => <span className={`pill ${BAYAR[c.getValue()]?.[1]}`}>{BAYAR[c.getValue()]?.[0]}</span> },
    { id: 'ambil', accessorFn: (r) => (r.status_ambil === 'diambil' ? 'Sudah diambil' : 'Belum diambil'), header: 'Barang', meta: { filter: 'select' } },
  ];

  return (
    <>
      <PageHeader title="Piutang" desc="Semua nota yang belum lunas, dari tanggal berapa pun. Klik nota untuk mencatat pelunasan." />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[280px_1fr]">
        <section className="card p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted">Total piutang</div>
          <div className="num mt-1 text-3xl font-extrabold text-bad">{q.isLoading ? '…' : rp(total)}</div>
          <div className="mt-1 text-sm text-muted">{nf(rows.length)} nota · {nf(new Set(rows.map((r) => r.customer_id)).size)} konsumen</div>
        </section>
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Umur piutang <span className="font-normal text-muted">· klik untuk menyaring</span></h2>
            {bucket && <button className="text-xs font-semibold text-brand" onClick={() => setBucket('')}>Tampilkan semua</button>}
          </div>
          <div className="flex flex-col gap-1.5">
            {byBucket.map((b, i) => (
              <button key={b.key} onClick={() => setBucket(bucket === b.key ? '' : b.key)}
                className={`grid grid-cols-[88px_1fr] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-sunk sm:grid-cols-[96px_1fr_150px] ${bucket === b.key ? 'bg-sunk ring-1 ring-brand' : ''}`}>
                <span className="font-semibold">{b.label}</span>
                <span className="h-3 overflow-hidden rounded-full bg-sunk"><span className="block h-full rounded-full" style={{ width: `${(b.sisa / maxB) * 100}%`, minWidth: b.sisa ? 4 : 0, background: COLORS[i] }} /></span>
                <span className="num col-span-2 text-right sm:col-span-1"><b>{nf(b.sisa)}</b> <span className="text-xs text-muted">· {b.nota} nota</span></span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="my-4 flex flex-wrap items-center gap-2">
        {([['konsumen', 'Per konsumen'], ['nota', 'Per nota']] as const).map(([k, l]) => (
          <button key={k} className={`chip ${tab === k ? 'border-ink bg-ink text-canvas' : 'hover:border-muted'}`} onClick={() => setTab(k)}>{l}</button>
        ))}
        {konsumen && <span className="pill pill-brand">{konsumen.nama}<button className="ml-1 font-bold" onClick={() => setKonsumen(null)} aria-label="Hapus filter konsumen">×</button></span>}
        {bucket && <span className="pill pill-warn">{BUCKETS.find((b) => b.key === bucket)?.label}</span>}
      </div>

      {tab === 'konsumen' ? (
        <DataTable<PerKonsumen> data={perKonsumen} loading={q.isLoading} columns={kCols} title="Piutang_per_konsumen" storageKey="piutang-konsumen"
          initialSort={[{ id: 'sisa', desc: true }]} canExport={can('piutang', 'ekspor')} searchPlaceholder="Cari konsumen…"
          onRowClick={(r) => { setKonsumen({ id: r.customer_id, nama: r.nama }); setTab('nota'); }} emptyText="Tidak ada piutang." />
      ) : (
        <DataTable<Row> data={filtered} loading={q.isLoading} columns={nCols} title="Piutang_per_nota" storageKey="piutang-nota" dateField="tanggal"
          initialSort={[{ id: 'umur', desc: true }]} canExport={can('piutang', 'ekspor')} searchPlaceholder="Cari nomor nota atau konsumen…"
          cardTitle={(r) => <span className="flex justify-between gap-2"><span className="font-mono text-sm">{r.nomor}</span><span className="text-sm">{r.customer_nama}</span></span>}
          onRowClick={(r) => setOpen(r.id)} emptyText="Tidak ada piutang." />
      )}
      {open && <OrderDetailModal orderId={open} onClose={() => setOpen('')} />}
    </>
  );
}

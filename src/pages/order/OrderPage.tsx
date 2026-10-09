import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CloudOff, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/table/DataTable';
import { DateRangeFilter, rangeFor, type DateRange } from '@/components/table/DateRangeFilter';
import { PageHeader } from '@/components/ui/Field';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { sync, useSync } from '@/lib/offline';
import { nf, rp, tgl, tglJam } from '@/lib/format';
import { BAYAR, OrderDetailModal } from './OrderDetailModal';
import type { Order } from '@/types';

const RKEY = 'fortuner-order-range';

export function OrderPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const s = useSync();
  const [range, setRange] = useState<DateRange>(() => { try { const p = localStorage.getItem(RKEY); if (p) return rangeFor(p as DateRange['preset']); } catch { /* abaikan */ } return rangeFor('30_hari'); });
  useEffect(() => { try { if (range.preset !== 'custom') localStorage.setItem(RKEY, range.preset); } catch { /* abaikan */ } }, [range.preset]);
  const q = useQuery({ queryKey: ['orders', range.from, range.to], queryFn: () => api<Order[]>('orders.list', { from: range.from, to: range.to }), retry: 0 });
  useEffect(() => { const off = sync.onSynced(() => qc.invalidateQueries({ queryKey: ['orders'] })); return () => { off(); }; }, [qc]);
  const [open, setOpen] = useState('');
  const pending = s.outbox.filter((o) => o.kind === 'orders.create');
  // terbaru di atas (urutan waktu dibuat, lintas PC)
  const sorted = useMemo(() => [...(q.data || [])].sort((a, b) => b.created_at.localeCompare(a.created_at)), [q.data]);

  const columns: ColumnDef<Order, any>[] = [
    { accessorKey: 'nomor', header: 'No. nota', cell: (c) => <span className="whitespace-nowrap font-mono text-xs font-bold">{c.getValue()}{c.row.original.dibuat_offline && <CloudOff size={12} className="ml-1 inline text-warn" />}</span>, meta: { hideOnCard: true } },
    { accessorKey: 'tanggal', header: 'Tanggal', cell: (c) => <span className="num whitespace-nowrap">{tgl(c.getValue())}</span> },
    { accessorKey: 'customer_nama', header: 'Konsumen', cell: (c) => <span className="font-semibold">{c.getValue()}</span>, meta: { hideOnCard: true } },
    { accessorKey: 'ringkas', header: 'Isi', cell: (c) => <span className="line-clamp-1 max-w-[220px] text-xs text-muted" title={c.getValue()}>{c.row.original.item_count} item · {c.getValue()}</span>, meta: { hideOnCard: true } },
    { accessorKey: 'cs_nama', header: 'CS', meta: { filter: 'select' } },
    { accessorKey: 'kode_pc', header: 'PC', meta: { filter: 'select', hideOnCard: true } },
    { accessorKey: 'total', header: 'Total', meta: { align: 'right', total: true, money: true }, cell: (c) => nf(c.getValue()) },
    { accessorKey: 'terbayar', header: 'Terbayar', meta: { align: 'right', total: true, money: true, hideOnCard: true }, cell: (c) => nf(c.getValue()) },
    { id: 'sisa', accessorFn: (r) => (r.batal ? 0 : Math.max(0, r.sisa)), header: 'Sisa', meta: { align: 'right', total: true, money: true }, cell: (c) => <span className={c.getValue() > 0 ? 'font-bold text-bad' : 'text-muted'}>{nf(c.getValue())}</span> },
    { accessorKey: 'status_bayar', header: 'Bayar', meta: { filter: 'select', filterLabel: (v) => BAYAR[String(v)]?.[0] || String(v) }, cell: (c) => <span className={`pill ${BAYAR[c.getValue()]?.[1]}`}>{BAYAR[c.getValue()]?.[0]}</span> },
    { id: 'ambil', accessorFn: (r) => (r.status_ambil === 'diambil' ? 'Diambil' : r.produksi_selesai ? 'Siap diambil' : 'Dikerjakan'), header: 'Barang', meta: { filter: 'select' },
      cell: (c) => <span className={`pill ${c.getValue() === 'Diambil' ? 'pill-ok' : c.getValue() === 'Siap diambil' ? 'pill-brand' : 'pill-mute'}`}>{c.getValue()}</span> },
  ];

  return (
    <>
      <PageHeader title="Order" desc="Semua nota beserta pembayaran dan status pengambilan. Klik nota untuk bayar, tandai diambil, cetak ulang, atau batalkan."
        actions={can('kasir', 'tambah') && <Link to="/kasir" className="btn btn-primary"><Plus size={16} />Nota baru</Link>} />
      {pending.length > 0 && (
        <section className="card mb-4 border-warn/40">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-sm font-bold text-warn"><CloudOff size={16} />{pending.length} nota di perangkat ini belum terkirim</div>
          <ul className="divide-y divide-line text-sm">
            {pending.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
                <span className="font-mono text-xs font-bold">{o.label.split(' · ')[0]}</span><span className="flex-1 truncate">{o.label.split(' · ').slice(1).join(' · ')}</span>
                <span className="text-xs text-muted">{tglJam(o.created_at)}</span><span className="num font-semibold">{rp(o.total)}</span>
                {o.status === 'failed' && <span className="w-full text-xs text-bad">{o.error}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {q.error && !s.online && <div className="mb-4 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn">Daftar order butuh internet. Nota baru tetap bisa dibuat di Kasir pada PC kantor yang terdaftar.</div>}
      <DataTable<Order>
        data={sorted} loading={q.isLoading} columns={columns} title="Order" storageKey="order-list"
        canExport={can('order', 'ekspor')} searchPlaceholder="Cari nomor nota, konsumen, atau isi…" onRowClick={(r) => setOpen(r.id)}
        cardTitle={(r) => <span className="flex items-center justify-between gap-2"><span className="font-mono text-sm">{r.nomor}</span><span className="text-sm">{r.customer_nama}</span></span>}
        toolbar={<DateRangeFilter value={range} onChange={setRange} id="order-range" />}
        emptyText="Belum ada nota di periode ini."
      />
      {open && <OrderDetailModal orderId={open} onClose={() => setOpen('')} />}
    </>
  );
}

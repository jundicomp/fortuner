import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Receipt, X } from 'lucide-react';
import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/table/DataTable';
import { DateRangeFilter, periodeLabel, rangeFor, type DateRange } from '@/components/table/DateRangeFilter';
import { PageHeader } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { BuktiThumb, TITIP_INVALIDATE, TitipDecideModal, TitipForm, type TitipRow } from '@/components/Titip';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { nf, rp, tglJam } from '@/lib/format';

type Row = TitipRow & { key: string; status: string; tone: string; aksi: string; oleh: string };
const TONE: Record<string, string> = { ok: 'pill-ok', warn: 'pill-warn', bad: 'pill-bad', mute: 'pill-mute' };

/** Titip catat pengeluaran owner: kasir mencatat pembayaran yang sudah dilakukan owner dari rekening, owner mengonfirmasi. */
export function TitipPage() {
  const { can, user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [range, setRange] = useState<DateRange>(rangeFor('bulan_ini'));
  const q = useQuery({ queryKey: ['riwayat', 'titip', range.from, range.to], queryFn: () => api<{ rows: Row[]; bisa_putuskan: boolean }>('riwayat.list', { tab: 'titip', from: range.from, to: range.to }) });
  const [form, setForm] = useState(false);
  const [decide, setDecide] = useState<{ r: Row; terima: boolean } | null>(null);
  const batal = useMutation({ mutationFn: (id: string) => api('titip.cancel', { id }), onSuccess: () => { TITIP_INVALIDATE.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast('Titipan dibatalkan'); } });
  const rows = q.data?.rows || [];
  const pending = rows.filter((r) => r.status === 'Menunggu');
  const cols: ColumnDef<Row, any>[] = [
    { accessorKey: 'waktu', header: 'Dicatat', cell: (c) => <span className="num whitespace-nowrap text-xs">{tglJam(c.getValue())}<span className="block text-muted">{c.row.original.oleh}</span></span> },
    { accessorKey: 'keterangan', header: 'Keterangan', cell: (c) => <span className="flex items-center gap-2 text-[13px]"><BuktiThumb src={c.row.original.bukti} className="h-11 w-10" /><span>{c.getValue()}</span></span> },
    { accessorKey: 'nominal', header: 'Nominal', meta: { align: 'right', money: true, total: true }, cell: (c) => <b>{nf(c.getValue())}</b> },
    { accessorKey: 'status', header: 'Status', meta: { filter: 'select' }, cell: (c) => {
      const r = c.row.original;
      if (r.aksi === 'titip') return <span className="flex gap-1"><button className="btn btn-sm border-green-700 bg-green-700 px-2 text-xs text-white" onClick={() => setDecide({ r, terima: true })}><Check size={12} />Konfirmasi</button><button className="btn btn-sm border-bad px-2 text-xs text-bad" onClick={() => setDecide({ r, terima: false })}><X size={12} />Tolak</button></span>;
      return <span className="flex items-center gap-2"><span className={`pill ${TONE[r.tone] || 'pill-mute'}`}>{r.status}</span>{r.status === 'Menunggu' && r.oleh === user?.nama && <button className="text-xs font-semibold text-muted hover:text-bad" disabled={batal.isPending} onClick={() => batal.mutate(r.ref_id)}>Batalkan</button>}</span>;
    } },
  ];
  return (
    <>
      <PageHeader title="Titip catat pengeluaran" desc="Owner sudah membayar dari rekening dan mengirim bukti (chat WA / bukti transfer). Kasir mencatat di sini, owner mengonfirmasi, baru masuk pembukuan."
        actions={can('pengeluaran.titip', 'tambah') && <button id="tp-new" className="btn btn-primary" onClick={() => setForm(true)}><Receipt size={16} />Catat titipan</button>} />
      {pending.length > 0 && (
        <section className="card mb-4 flex flex-wrap items-center gap-3 border-amber-300 bg-amber-50/60 p-4 dark:bg-amber-500/10">
          <Clock size={20} className="text-amber-600" />
          <div className="flex-1"><b>{pending.length} titipan menunggu konfirmasi</b><div className="text-xs text-muted">Total {rp(pending.reduce((a, r) => a + r.nominal, 0))}{q.data?.bisa_putuskan ? ' · periksa bukti lalu konfirmasi atau tolak' : ' · menunggu owner'}</div></div>
        </section>
      )}
      <DataTable<Row> data={rows} loading={q.isLoading} columns={cols} title="Titipan pengeluaran" storageKey="titip" canExport={can('pengeluaran.titip', 'ekspor')}
        exportSubtitle={periodeLabel(range.from, range.to)} toolbar={<DateRangeFilter value={range} onChange={setRange} id="tp-range" />} searchPlaceholder="Cari keperluan, rekening…"
        cardTitle={(r) => <span className="flex justify-between gap-2"><span>{r.status}</span><span className="num">{rp(r.nominal)}</span></span>} emptyText="Belum ada titipan di periode ini." />
      {form && <TitipForm onClose={() => setForm(false)} />}
      {decide && <TitipDecideModal row={decide.r} terima={decide.terima} onClose={() => setDecide(null)} />}
    </>
  );
}

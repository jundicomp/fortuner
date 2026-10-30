import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/table/DataTable';
import { DateRangeFilter, periodeLabel, rangeFor, type DateRange } from '@/components/table/DateRangeFilter';
import { ErrorBox, PageHeader } from '@/components/ui/Field';
import { CancelDecideModal, CN_STATUS, RF_STATUS } from '@/components/Pembatalan';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { nf, rp, tgl } from '@/lib/format';

interface Row {
  id: string; nomor: string; tanggal: string; created_at: string; status: string; level: string; jenis: string; kategori: string; alasan: string; order_nomor: string; customer_nama: string;
  nilai_item: number; nilai_batal: number; ditahan: number; kelebihan: number; penyelesaian: string; refund_status: string; refund_nomor: string; diajukan_nama: string; diputus_nama: string; flag: string; bisa_putuskan: boolean;
}
interface Data {
  rows: Row[]; bisa_putuskan: boolean;
  ringkas: { nilai: number; dokumen: number; persen_omzet: number; kerugian: number; kerugian_nota: number; refund: number; refund_tunai: number; refund_transfer: number; deposit: number; deposit_konsumen: number; menunggu: number; menunggu_nilai: number; menunggu_tertua: number; ditandai: number };
  per_user: { id: string; nama: string; dokumen: number; nilai: number; persen: number | null }[];
  per_kategori: { kategori: string; jumlah: number }[];
}
const uang = (r: Row) => {
  if (r.status !== 'disetujui') return <span className="text-muted">–</span>;
  if (!r.kelebihan) return <span className="pill pill-mute">{r.level === 'cepat' ? 'Jalur cepat' : 'Piutang hapus'}</span>;
  if (r.penyelesaian === 'deposit') return <span className="pill pill-brand">Deposit {nf(r.kelebihan)}</span>;
  return <span className={`pill ${RF_STATUS[r.refund_status]?.[1] || 'pill-mute'}`}>{r.penyelesaian === 'tunai' ? 'Tunai' : 'Transfer'} {nf(r.kelebihan)} · {RF_STATUS[r.refund_status]?.[0] || ''}</span>;
};

/** Laporan pembatalan: rekap, per pengaju, alasan, dan daftar dokumen BTL. */
export function PembatalanPage() {
  const { can } = useAuth();
  const [range, setRange] = useState<DateRange>(rangeFor('bulan_ini'));
  const [tab, setTab] = useState<'semua' | 'menunggu' | 'uang' | 'ditandai'>('semua');
  const [open, setOpen] = useState('');
  const q = useQuery({ queryKey: ['pembatalan', 'list', range.from, range.to], queryFn: () => api<Data>('cancel.list', { from: range.from, to: range.to }) });
  const d = q.data, r = d?.ringkas;
  const rows = (d?.rows || []).filter((x) => tab === 'semua' || (tab === 'menunggu' ? x.status === 'menunggu' : tab === 'uang' ? x.kelebihan > 0 : !!x.flag));
  const maxKat = Math.max(1, ...(d?.per_kategori || []).map((k) => k.jumlah));
  const cols: ColumnDef<Row, any>[] = [
    { accessorKey: 'nomor', header: 'Dokumen', cell: (c) => <span className="font-mono text-xs">{c.getValue()}<span className="block font-sans text-muted">{tgl(c.row.original.tanggal)}</span></span> },
    { accessorKey: 'order_nomor', header: 'Nota asal', cell: (c) => <span className={`font-mono text-xs ${c.row.original.status === 'disetujui' && c.row.original.jenis === 'penuh' ? 'text-muted line-through' : ''}`}>{c.getValue()}</span> },
    { accessorKey: 'customer_nama', header: 'Konsumen', cell: (c) => <span>{c.getValue()}{c.row.original.flag && <span className="flex items-center gap-1 text-xs text-warn"><AlertTriangle size={11} />{c.row.original.flag}</span>}</span> },
    { accessorKey: 'kategori', header: 'Alasan', meta: { filter: 'select' }, cell: (c) => <span className="text-[13px]">{c.getValue()}<span className="block max-w-[260px] truncate text-xs text-muted">{c.row.original.alasan}</span></span> },
    { accessorKey: 'diajukan_nama', header: 'Pengaju', meta: { filter: 'select' } },
    { id: 'batal', accessorFn: (x) => (x.status === 'disetujui' ? x.nilai_batal : x.nilai_item), header: 'Batal', meta: { align: 'right', money: true, total: true }, cell: (c) => <b>{nf(c.getValue())}</b> },
    { accessorKey: 'ditahan', header: 'Ditahan', meta: { align: 'right', money: true }, cell: (c) => (c.getValue() ? nf(c.getValue()) : '–') },
    { id: 'uang', header: 'Uang', accessorFn: (x) => x.penyelesaian, cell: (c) => uang(c.row.original) },
    { accessorKey: 'diputus_nama', header: 'Disetujui', cell: (c) => c.getValue() || '–' },
    { accessorKey: 'status', header: 'Status', meta: { filter: 'select' }, cell: (c) => c.row.original.bisa_putuskan
      ? <button className="btn btn-sm btn-primary px-2 text-xs" onClick={(e) => { e.stopPropagation(); setOpen(c.row.original.id); }}>Periksa</button>
      : <span className={`pill ${c.row.original.flag && c.getValue() === 'disetujui' ? 'pill-warn' : CN_STATUS[c.getValue()]?.[1]}`}>{c.row.original.flag && c.getValue() === 'disetujui' ? 'Ditandai' : CN_STATUS[c.getValue()]?.[0]}</span> },
  ];
  return (
    <>
      <PageHeader title="Pembatalan & Refund" desc="Setiap pembatalan tercatat sebagai dokumen BTL bertanggal hari disetujui. Nota asal tidak dihapus; nilainya masuk Laba Rugi sebagai pengurang omzet." actions={<DateRangeFilter value={range} onChange={setRange} id="btl-range" />} />
      <ErrorBox error={q.error} />
      {r && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <K t="orange" l="Pembatalan penjualan" v={rp(r.nilai)} s={`${r.dokumen} dokumen · ${String(r.persen_omzet).replace('.', ',')}% dari omzet`} />
          <K t="rose" l="Kerugian order batal" v={rp(r.kerugian)} s={`bahan & klik terbuang · ${r.kerugian_nota} nota`} />
          <K t="blue" l="Refund dibayar" v={rp(r.refund)} s={`tunai ${nf(r.refund_tunai)} · transfer ${nf(r.refund_transfer)}`} />
          <K t="amber" l="Jadi deposit" v={rp(r.deposit)} s={`${r.deposit_konsumen} konsumen`} />
          <K t="purple" l="Menunggu persetujuan" v={String(r.menunggu)} s={r.menunggu ? `${rp(r.menunggu_nilai)} · tertua ${r.menunggu_tertua} hari` : 'tidak ada'} />
        </div>
      )}
      {d && (
        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <section className="card overflow-hidden">
            <h3 className="border-b border-line px-4 py-3 text-sm font-bold">Per pengaju (CS / kasir)</h3>
            <table className="tbl w-full text-[13px]">
              <thead><tr><th className="px-3 py-2 text-left">Nama</th><th className="px-3 py-2 text-right">Dokumen</th><th className="px-3 py-2 text-right">Nilai</th><th className="px-3 py-2 text-right">% omzet nota</th></tr></thead>
              <tbody>{d.per_user.map((u) => <tr key={u.id} className="border-t border-line"><td className="px-3 py-2 font-semibold">{u.nama}</td><td className="num px-3 py-2 text-right">{u.dokumen}</td><td className="num px-3 py-2 text-right">{nf(u.nilai)}</td>
                <td className="px-3 py-2 text-right">{u.persen == null ? '–' : <span className={`pill ${u.persen >= 3 ? 'pill-warn' : 'pill-ok'}`}>{String(u.persen).replace('.', ',')}%</span>}</td></tr>)}
                {!d.per_user.length && <tr><td colSpan={4} className="px-3 py-4 text-center text-muted">Belum ada pembatalan disetujui.</td></tr>}</tbody>
            </table>
          </section>
          <section className="card p-4">
            <h3 className="mb-3 text-sm font-bold">Alasan terbanyak</h3>
            {!d.per_kategori.length ? <p className="text-sm text-muted">Belum ada data.</p> : <div className="flex flex-col gap-3">{d.per_kategori.map((k) => (
              <div key={k.kategori} className="text-[13px]"><div className="flex justify-between"><span>{k.kategori}</span><b>{k.jumlah}</b></div><div className="mt-1 h-1.5 rounded-full bg-sunk"><div className="h-full rounded-full bg-brand" style={{ width: `${(k.jumlah / maxKat) * 100}%` }} /></div></div>
            ))}</div>}
          </section>
        </div>
      )}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {([['semua', 'Semua', d?.rows.length], ['menunggu', 'Menunggu', r?.menunggu], ['uang', 'Ada pengembalian uang', d?.rows.filter((x) => x.kelebihan > 0).length], ['ditandai', 'Ditandai', r?.ditandai]] as const).map(([k, l, n]) => (
          <button key={k} id={`btl-tab-${k}`} className={`chip px-3 py-1.5 ${tab === k ? 'border-brand bg-brand text-white' : ''}`} onClick={() => setTab(k)}>{k === 'ditandai' && <AlertTriangle size={12} />}{l}{n ? ` · ${n}` : ''}</button>
        ))}
      </div>
      <DataTable<Row> data={rows} loading={q.isLoading} columns={cols} title="Pembatalan" storageKey="pembatalan" canExport={can('pembatalan', 'ekspor')} exportSubtitle={periodeLabel(range.from, range.to)}
        onRowClick={(x) => setOpen(x.id)} searchPlaceholder="Cari nomor, nota, konsumen…" emptyText="Belum ada pembatalan di periode ini."
        cardTitle={(x) => <span className="flex justify-between gap-2"><span className="font-mono text-sm">{x.nomor}</span><span className="num">{rp(x.status === 'disetujui' ? x.nilai_batal : x.nilai_item)}</span></span>} />
      {open && <CancelDecideModal id={open} onClose={() => setOpen('')} />}
    </>
  );
}

function K({ t, l, v, s }: { t: string; l: string; v: string; s: string }) {
  return <div className={`card tint tint-${t} p-4`}><div className="text-xs font-bold uppercase tracking-wider text-muted">{l}</div><div className="num mt-1.5 text-xl font-extrabold">{v}</div><div className="mt-0.5 text-xs text-muted">{s}</div></div>;
}

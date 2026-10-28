import { useQuery } from '@tanstack/react-query';
import { Check, Receipt, X } from 'lucide-react';
import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/table/DataTable';
import { DateRangeFilter, periodeLabel, rangeFor, type DateRange } from '@/components/table/DateRangeFilter';
import { PageHeader } from '@/components/ui/Field';
import { KasCards } from '@/components/SumberKas';
import { CekModal, type CekTarget } from '@/components/CekModal';
import { DecideModal } from '@/pages/kas/SetoranTab';
import { BuktiThumb, TitipDecideModal, TitipForm, type TitipRow } from '@/components/Titip';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { nf, tgl, tglJam } from '@/lib/format';

interface RRow { key: string; waktu: string; tanggal: string; jenis: string; keterangan: string; nominal: number; masuk: number; keluar: number; oleh: string; status: string; tone: string; aksi: '' | 'setoran' | 'cek' | 'titip'; ref_tabel: string; ref_id: string; bukti?: string; extra?: TitipRow['extra'] }
interface RData { tab: string; tabs: { key: string; label: string; jumlah: number }[]; rows: RRow[]; bisa_putuskan: boolean }
const JENIS: Record<string, string> = { Titipan: 'bg-sky-100 text-sky-800', Setoran: 'bg-amber-100 text-amber-800', 'Kas kecil': 'bg-orange-100 text-orange-800', 'Pindah dana': 'bg-blue-100 text-blue-800', Pengeluaran: 'bg-red-100 text-red-800', 'Bayar bon': 'bg-red-100 text-red-800', Rekonsiliasi: 'bg-purple-100 text-purple-800', Penjualan: 'bg-emerald-100 text-emerald-800' };
const TONE: Record<string, string> = { ok: 'pill-ok', warn: 'pill-warn', bad: 'pill-bad', mute: 'pill-mute', brand: 'pill-brand' };

/** Riwayat semua gerakan uang. Tab mengikuti hak akses (owner/keuangan: semua; kasir: laci, setoran, kas kecil). */
export function RiwayatPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState('');
  const [range, setRange] = useState<DateRange>(rangeFor('bulan_ini'));
  const q = useQuery({ queryKey: ['riwayat', tab, range.from, range.to], queryFn: () => api<RData>('riwayat.list', { tab, from: range.from, to: range.to }) });
  const d = q.data;
  const cur = d?.tab || tab;
  const [decide, setDecide] = useState<{ r: RRow; terima: boolean } | null>(null);
  const [cek, setCek] = useState<CekTarget | null>(null);
  const [titip, setTitip] = useState<{ r: RRow; terima: boolean } | null>(null);
  const [form, setForm] = useState(false);
  const masukKeluar = cur === 'laci' || cur === 'kaskecil';

  const cols: ColumnDef<RRow, any>[] = [
    { accessorKey: 'waktu', header: 'Waktu', cell: (c) => <span className="num whitespace-nowrap text-xs">{c.getValue() ? tglJam(c.getValue()) : tgl(c.row.original.tanggal)}</span> },
    { accessorKey: 'jenis', header: 'Jenis', meta: { filter: 'select' }, cell: (c) => <span className={`pill ${JENIS[c.getValue()] || 'pill-mute'}`}>{c.getValue()}</span> },
    { accessorKey: 'keterangan', header: 'Keterangan', cell: (c) => <span className="flex items-center gap-2 text-[13px]">{c.row.original.bukti && <BuktiThumb src={c.row.original.bukti} className="h-10 w-9" />}<span>{c.getValue()}</span></span> },
    ...(masukKeluar ? [
      { accessorKey: 'masuk', header: 'Masuk', meta: { align: 'right', money: true, total: true }, cell: (c: any) => (c.getValue() ? <span className="text-ok">{nf(c.getValue())}</span> : '') },
      { accessorKey: 'keluar', header: 'Keluar', meta: { align: 'right', money: true, total: true }, cell: (c: any) => (c.getValue() ? <span className="text-bad">{nf(c.getValue())}</span> : '') },
    ] as ColumnDef<RRow, any>[] : [{ accessorKey: 'nominal', header: 'Nominal', meta: { align: 'right', money: true }, cell: (c: any) => <b>{nf(c.getValue())}</b> } as ColumnDef<RRow, any>]),
    { accessorKey: 'oleh', header: 'Oleh', meta: { filter: 'select' } },
    { accessorKey: 'status', header: 'Status', meta: { filter: 'select' }, cell: (c) => {
      const r = c.row.original;
      if (r.aksi === 'setoran') return <span className="flex gap-1"><button className="btn btn-sm border-green-700 bg-green-700 px-2 text-xs text-white" onClick={() => setDecide({ r, terima: true })}><Check size={12} />Terima</button><button className="btn btn-sm border-bad px-2 text-xs text-bad" onClick={() => setDecide({ r, terima: false })}><X size={12} />Tolak</button></span>;
      if (r.aksi === 'titip') return <span className="flex gap-1"><button className="btn btn-sm border-green-700 bg-green-700 px-2 text-xs text-white" onClick={() => setTitip({ r, terima: true })}><Check size={12} />Konfirmasi</button><button className="btn btn-sm border-bad px-2 text-xs text-bad" onClick={() => setTitip({ r, terima: false })}><X size={12} />Tolak</button></span>;
      if (r.aksi === 'cek') { const t = { tabel: r.ref_tabel, id: r.ref_id, judul: r.keterangan, nominal: r.nominal }; return <span className="flex gap-1"><button className="btn btn-sm px-2 text-xs" onClick={() => setCek({ ...t, status: 'sesuai' })}>Sesuai</button><button className="btn btn-sm px-2 text-xs text-bad" onClick={() => setCek({ ...t, status: 'bermasalah' })}>Bermasalah</button></span>; }
      return r.status === '–' ? <span className="text-muted">–</span> : <span className={`pill ${TONE[r.tone] || 'pill-mute'}`}>{r.status}</span>;
    } },
  ];

  return (
    <>
      <PageHeader title="Riwayat transaksi kas" desc="Semua gerakan uang tunai & rekening: siapa yang mencatat, kapan, dan status pengecekannya. Tab yang tampil sesuai hak akses Anda."
        actions={can('pengeluaran.titip', 'tambah') && <button id="rw-titip" className="btn btn-primary" onClick={() => setForm(true)}><Receipt size={16} />Titip catat pengeluaran</button>} />
      <KasCards className="mb-4" />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {(d?.tabs || []).map((t) => (
          <button key={t.key} id={`rw-tab-${t.key}`} className={`chip ${cur === t.key ? 'border-ink bg-ink text-canvas' : 'hover:border-muted'}`} onClick={() => setTab(t.key)}>
            {t.label}{t.jumlah > 0 && <span className="ml-1.5 rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">{t.jumlah}</span>}
          </button>
        ))}
      </div>
      <DataTable<RRow> data={d?.rows || []} loading={q.isLoading} columns={cols} title="Riwayat kas" storageKey={`riwayat-${cur}`} canExport={can('kas', 'ekspor')}
        exportSubtitle={periodeLabel(range.from, range.to)} toolbar={cur === 'cek' ? undefined : <DateRangeFilter value={range} onChange={setRange} id="rw-range" />} searchPlaceholder="Cari keterangan, nama…"
        cardTitle={(r) => <span className="flex justify-between gap-2"><span>{r.jenis} · {r.oleh}</span><span className="num">{nf(r.nominal)}</span></span>}
        emptyText={cur === 'cek' ? 'Tidak ada transaksi yang perlu dicek.' : 'Belum ada transaksi di periode ini.'} />
      {decide && <DecideModal s={{ id: decide.r.ref_id, kasir_nama: decide.r.oleh, nominal: decide.r.nominal, tanggal: decide.r.tanggal }} terima={decide.terima} onClose={() => setDecide(null)} />}
      {cek && <CekModal t={cek} onClose={() => setCek(null)} />}
      {titip && <TitipDecideModal row={titip.r} terima={titip.terima} onClose={() => setTitip(null)} />}
      {form && <TitipForm onClose={() => setForm(false)} />}
    </>
  );
}

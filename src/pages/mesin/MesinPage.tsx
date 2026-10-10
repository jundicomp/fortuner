import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gauge, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/table/DataTable';
import { DateRangeFilter, periodeLabel, rangeFor, type DateRange } from '@/components/table/DateRangeFilter';
import { ErrorBox, Field, PageHeader } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { nf, tgl, ymd } from '@/lib/format';

interface CRow {
  id: string; tanggal: string; mesin_id: string; counter_awal: number | null; counter_akhir: number | null; reject_trouble: number; reject_operator: number; reject_fo: number; batal: number; keterangan: string;
  klik_mesin: number | null; reject: number; klik_fo: number; selisih: number | null; awal_saran: number | null;
}
interface CList { machines: { id: string; nama: string; aktif: boolean }[]; rows: CRow[]; last_akhir: Record<string, number | null> }
const numIn = (s: string) => (s === '' ? null : Number(String(s).replace(/[^\d]/g, '')));

/**
 * Pengganti sheet "Operator": counter masuk/tutup per mesin per hari, reject, lalu dibandingkan dengan klik dari nota FO.
 * Selisih = klik mesin − reject − (klik FO − batal). Positif = mesin mencetak lebih banyak dari yang ditagih.
 */
export function MesinPage() {
  const { can } = useAuth();
  const [tanggal, setTanggal] = useState(ymd());
  const day = useQuery({ queryKey: ['counter', tanggal], queryFn: () => api<CList>('counter.list', { from: tanggal, to: tanggal }) });
  const [range, setRange] = useState<DateRange>(rangeFor('30_hari'));
  const hist = useQuery({ queryKey: ['counter', 'range', range.from, range.to], queryFn: () => api<CList>('counter.list', { from: range.from || '2000-01-01', to: range.to || ymd() }) });
  const machines = (day.data?.machines || []).filter((m) => m.aktif);
  const mName = Object.fromEntries((hist.data?.machines || day.data?.machines || []).map((m) => [m.id, m.nama]));

  const cols: ColumnDef<CRow, any>[] = [
    { accessorKey: 'tanggal', header: 'Tanggal', cell: (c) => <span className="num whitespace-nowrap">{tgl(c.getValue())}</span> },
    { id: 'mesin', accessorFn: (r) => mName[r.mesin_id] || '', header: 'Mesin', meta: { filter: 'select' }, cell: (c) => <span className="font-semibold">{c.getValue()}</span> },
    { accessorKey: 'counter_awal', header: 'Masuk', meta: { align: 'right' }, cell: (c) => nf(c.getValue()) },
    { accessorKey: 'counter_akhir', header: 'Tutup', meta: { align: 'right' }, cell: (c) => nf(c.getValue()) },
    { accessorKey: 'klik_mesin', header: 'Klik mesin', meta: { align: 'right', total: true }, cell: (c) => <b>{nf(c.getValue())}</b> },
    { accessorKey: 'reject', header: 'Reject', meta: { align: 'right', total: true }, cell: (c) => nf(c.getValue()) },
    { accessorKey: 'batal', header: 'Batal', meta: { align: 'right', total: true, hideOnCard: true }, cell: (c) => nf(c.getValue()) },
    { accessorKey: 'klik_fo', header: 'Klik FO', meta: { align: 'right', total: true }, cell: (c) => nf(c.getValue()) },
    { accessorKey: 'selisih', header: 'Selisih', meta: { align: 'right', total: true }, cell: (c) => <Selisih v={c.getValue()} /> },
    { accessorKey: 'keterangan', header: 'Keterangan', meta: { hideOnCard: true } },
  ];

  return (
    <>
      <PageHeader title="Mesin & Operator" desc="Isi counter masuk dan tutup tiap mesin setiap hari. Aplikasi membandingkannya dengan klik dari nota FO, jadi cetakan yang tidak tertagih langsung kelihatan."
        actions={<Field label="Tanggal"><input id="mesin-tanggal" type="date" className="input" value={tanggal} max={ymd()} onChange={(e) => e.target.value && setTanggal(e.target.value)} /></Field>} />
      <ErrorBox error={day.error} />
      {day.isLoading && <div className="card p-6 text-sm text-muted">Memuat…</div>}
      {!day.isLoading && !machines.length && <div className="card p-6 text-sm text-muted">Belum ada mesin yang memakai counter. Aktifkan "Catat counter klik harian" di Master Data → Mesin.</div>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {machines.map((m) => (
          <CounterCard key={`${m.id}-${tanggal}`} tanggal={tanggal} mesin={m} row={day.data?.rows.find((r) => r.mesin_id === m.id)} lastAkhir={day.data?.last_akhir[m.id] ?? null}
            canEdit={can('mesin', 'tambah') || can('mesin', 'ubah')} />
        ))}
      </div>
      <h2 className="mb-3 mt-8 text-base font-bold">Riwayat counter</h2>
      <DataTable<CRow> data={(hist.data?.rows || []).filter((r) => r.id || r.klik_fo)} loading={hist.isLoading} columns={cols} title="Counter_mesin" storageKey="mesin-history"
        initialSort={[{ id: 'tanggal', desc: true }]} canExport={can('mesin', 'ekspor') || can('mesin', 'lihat')}
        exportSubtitle={periodeLabel(range.from, range.to)} toolbar={<DateRangeFilter value={range} onChange={setRange} id="mesin-range" />} emptyText="Belum ada data counter di periode ini."
        cardTitle={(r) => <span className="flex justify-between"><span>{mName[r.mesin_id]}</span><span className="num text-sm text-muted">{tgl(r.tanggal)}</span></span>} />
    </>
  );
}

function Selisih({ v }: { v: number | null }) {
  if (v == null) return <span className="text-muted/60">–</span>;
  if (v === 0) return <span className="pill pill-ok">Cocok</span>;
  return <span className={`num font-bold ${Math.abs(v) > 20 ? 'text-bad' : 'text-warn'}`}>{v > 0 ? '+' : ''}{nf(v)}</span>;
}

function CounterCard({ tanggal, mesin, row, lastAkhir, canEdit }: { tanggal: string; mesin: { id: string; nama: string }; row?: CRow; lastAkhir: number | null; canEdit: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const init = () => ({
    counter_awal: row?.counter_awal != null ? String(row.counter_awal) : row?.awal_saran != null ? String(row.awal_saran) : lastAkhir != null && tanggal === ymd() ? String(lastAkhir) : '',
    counter_akhir: row?.counter_akhir != null ? String(row.counter_akhir) : '',
    reject_trouble: String(row?.reject_trouble || ''), reject_operator: String(row?.reject_operator || ''), reject_fo: String(row?.reject_fo || ''), batal: String(row?.batal || ''), keterangan: row?.keterangan || '',
  });
  const [f, setF] = useState(init);
  useEffect(() => setF(init()), [row?.id, row?.counter_akhir]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useMutation({
    mutationFn: () => api('counter.save', { row: { tanggal, mesin_id: mesin.id, ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, k === 'keterangan' ? v : numIn(v)])) } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['counter'] }); toast(`Counter ${mesin.nama} disimpan`); },
  });
  const awal = numIn(f.counter_awal), akhir = numIn(f.counter_akhir);
  const klikMesin = awal != null && akhir != null ? akhir - awal : null;
  const reject = (numIn(f.reject_trouble) || 0) + (numIn(f.reject_operator) || 0) + (numIn(f.reject_fo) || 0);
  const klikFo = row?.klik_fo || 0;
  const batal = numIn(f.batal) || 0;
  const selisih = klikMesin == null ? null : klikMesin - reject - (klikFo - batal);
  const id = (k: string) => `cnt-${mesin.id}-${k}`;
  const inp = (k: keyof typeof f, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <input id={id(k)} className="input num text-right" inputMode="numeric" disabled={!canEdit} value={k === 'keterangan' ? f[k] : f[k] ? nf(Number(f[k].replace(/\D/g, ''))) : ''} onChange={(e) => setF({ ...f, [k]: e.target.value.replace(/\D/g, '') })} />
    </Field>
  );

  return (
    <section className="card flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand"><Gauge size={18} /></div>
        <div className="min-w-0 flex-1"><div className="font-bold">{mesin.nama}</div><div className="text-xs text-muted">{row?.id ? 'Sudah diisi' : 'Belum diisi'} · {tgl(tanggal)}</div></div>
        <Selisih v={selisih} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {inp('counter_awal', 'Counter masuk', lastAkhir != null && !row?.id ? `Tutup terakhir ${nf(lastAkhir)}` : undefined)}
        {inp('counter_akhir', 'Counter tutup')}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {inp('reject_trouble', 'Reject trouble')}
        {inp('reject_operator', 'Salah operator')}
        {inp('reject_fo', 'Salah FO')}
        {inp('batal', 'Batal (klik)')}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-sunk px-3 py-2 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-muted">Klik mesin</dt><dd className="num font-bold">{nf(klikMesin)}</dd></div>
        <div><dt className="text-xs text-muted">Reject</dt><dd className="num font-bold">{nf(reject)}</dd></div>
        <div><dt className="text-xs text-muted">Klik FO (nota)</dt><dd className="num font-bold">{nf(klikFo)}</dd></div>
        <div><dt className="text-xs text-muted">Selisih</dt><dd className="num font-bold"><Selisih v={selisih} /></dd></div>
      </dl>
      <Field label="Keterangan"><input id={id('keterangan')} className="input" disabled={!canEdit} value={f.keterangan} onChange={(e) => setF({ ...f, keterangan: e.target.value })} placeholder="mis. kalibrasi warna, kertas macet" /></Field>
      <ErrorBox error={save.error} />
      {canEdit && <button className="btn btn-primary self-end" disabled={save.isPending} onClick={() => save.mutate()}><Save size={15} />Simpan</button>}
    </section>
  );
}

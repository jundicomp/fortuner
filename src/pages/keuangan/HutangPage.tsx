import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HandCoins, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/table/DataTable';
import { ErrorBox, Field, PageHeader } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { addDays, nf, rp, tgl, tglJam, ymd } from '@/lib/format';
import { useExpenseMeta } from './PengeluaranPage';

interface Bill {
  id: string; tanggal: string; nota: string; supplier_id: string; supplier: string; total: number; terbayar: number; sisa: number; jatuh_tempo: string; keterangan: string;
  pembayaran: { id: string; tanggal: string; nominal: number; metode: string; oleh: string; keterangan: string; created_at: string }[];
}
type Row = Bill & { status: string; hari: number };
const numIn = (s: string) => Number(String(s).replace(/[^\d]/g, '')) || 0;
const STATUS: Record<string, string> = { Lunas: 'pill-ok', Terlambat: 'pill-bad', 'Jatuh tempo ≤ 7 hari': 'pill-warn', 'Belum jatuh tempo': 'pill-mute' };

/** Pengganti sheet "Hutang": tagihan supplier, cicilan, dan jatuh tempo. */
export function HutangPage() {
  const { can } = useAuth();
  const [semua, setSemua] = useState(false);
  const q = useQuery({ queryKey: ['bills', semua], queryFn: () => api<Bill[]>('bills.list', { semua }) });
  const [open, setOpen] = useState('');
  const [baru, setBaru] = useState(false);
  const today = ymd();
  const rows: Row[] = useMemo(() => (q.data || []).map((b) => {
    const hari = Math.round((Date.parse(b.jatuh_tempo) - Date.parse(today)) / 864e5);
    const status = b.sisa <= 0 ? 'Lunas' : hari < 0 ? 'Terlambat' : hari <= 7 ? 'Jatuh tempo ≤ 7 hari' : 'Belum jatuh tempo';
    return { ...b, hari, status };
  }).sort((a, b) => (a.sisa > 0 ? 0 : 1) - (b.sisa > 0 ? 0 : 1) || a.jatuh_tempo.localeCompare(b.jatuh_tempo)), [q.data, today]);
  const openRows = rows.filter((r) => r.sisa > 0);
  const sum = (rs: Row[]) => rs.reduce((a, r) => a + r.sisa, 0);
  const sel = rows.find((r) => r.id === open);

  const cols: ColumnDef<Row, any>[] = [
    { accessorKey: 'supplier', header: 'Supplier', meta: { filter: 'select', hideOnCard: true }, cell: (c) => <span className="font-semibold">{c.getValue()}</span> },
    { accessorKey: 'keterangan', header: 'Keterangan', cell: (c) => <span>{c.getValue()}{c.row.original.nota && <span className="block font-mono text-[11px] text-muted">{c.row.original.nota}</span>}</span> },
    { accessorKey: 'tanggal', header: 'Tanggal', cell: (c) => <span className="num whitespace-nowrap">{tgl(c.getValue())}</span> },
    { accessorKey: 'jatuh_tempo', header: 'Jatuh tempo', cell: (c) => <span className="num whitespace-nowrap">{tgl(c.getValue())}{c.row.original.sisa > 0 && <span className={`block text-[11px] ${c.row.original.hari < 0 ? 'font-bold text-bad' : 'text-muted'}`}>{c.row.original.hari < 0 ? `lewat ${-c.row.original.hari} hari` : c.row.original.hari === 0 ? 'hari ini' : `${c.row.original.hari} hari lagi`}</span>}</span> },
    { accessorKey: 'total', header: 'Total', meta: { align: 'right', total: true, money: true }, cell: (c) => nf(c.getValue()) },
    { accessorKey: 'terbayar', header: 'Dibayar', meta: { align: 'right', total: true, money: true, hideOnCard: true }, cell: (c) => nf(c.getValue()) },
    { accessorKey: 'sisa', header: 'Sisa', meta: { align: 'right', total: true, money: true }, cell: (c) => <b className={c.getValue() > 0 ? 'text-bad' : 'text-muted'}>{nf(c.getValue())}</b> },
    { accessorKey: 'status', header: 'Status', meta: { filter: 'select' }, cell: (c) => <span className={`pill ${STATUS[c.getValue()]}`}>{c.getValue()}</span> },
  ];

  return (
    <>
      <PageHeader title="Hutang Supplier" desc="Tagihan dari pembelian bahan secara tempo. Urutan: jatuh tempo paling dekat di atas. Klik tagihan untuk mencatat pembayaran."
        actions={can('hutang', 'tambah') && <button className="btn" onClick={() => setBaru(true)}><Plus size={16} />Tagihan tanpa pembelian</button>} />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile tint="orange" label="Total hutang" value={rp(sum(openRows))} sub={`${openRows.length} tagihan`} />
        <Tile tint="rose" label="Terlambat" value={rp(sum(openRows.filter((r) => r.hari < 0)))} sub={`${openRows.filter((r) => r.hari < 0).length} tagihan`} tone="text-bad" />
        <Tile tint="amber" label="Jatuh tempo 7 hari" value={rp(sum(openRows.filter((r) => r.hari >= 0 && r.hari <= 7)))} sub={`${openRows.filter((r) => r.hari >= 0 && r.hari <= 7).length} tagihan`} tone="text-warn" />
      </div>
      <DataTable<Row> data={rows} loading={q.isLoading} columns={cols} title="Hutang_supplier" storageKey="hutang" canExport={can('hutang', 'ekspor')} onRowClick={(r) => setOpen(r.id)}
        searchPlaceholder="Cari supplier, nota, keterangan…" cardTitle={(r) => <span className="flex justify-between gap-2"><span>{r.supplier}</span><span className="num text-sm">{nf(r.sisa)}</span></span>}
        toolbar={<label className="flex cursor-pointer items-center gap-2 px-2 text-sm"><input type="checkbox" className="accent-[rgb(var(--brand))]" checked={semua} onChange={(e) => setSemua(e.target.checked)} />Semua yang lunas</label>}
        emptyText="Tidak ada hutang." />
      {sel && <BillModal bill={sel} onClose={() => setOpen('')} />}
      {baru && <NewBill onClose={() => setBaru(false)} />}
    </>
  );
}

function Tile({ label, value, sub, tone = '', tint = 'blue' }: { label: string; value: string; sub?: string; tone?: string; tint?: string }) {
  return <section className={`card tint tint-${tint} p-4`}><div className="text-xs font-bold uppercase tracking-wider text-muted">{label}</div><div className={`num mt-1 text-2xl font-extrabold ${tone}`}>{value}</div>{sub && <div className="text-xs text-muted">{sub}</div>}</section>;
}

function BillModal({ bill, onClose }: { bill: Row; onClose: () => void }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const meta = useExpenseMeta();
  const methods = meta.data?.payment_methods || [];
  const [nominal, setNominal] = useState(String(bill.sisa));
  const [methodId, setMethodId] = useState('');
  const [tanggal, setTanggal] = useState(ymd());
  const [ket, setKet] = useState('');
  const pay = useMutation({
    mutationFn: () => api('bills.pay', { bill_id: bill.id, nominal: numIn(nominal), method_id: methodId || methods.find((m) => m.jenis === 'transfer')?.id || methods[0]?.id, tanggal, keterangan: ket }),
    onSuccess: () => { ['bills', 'expenses', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast(numIn(nominal) >= bill.sisa ? 'Hutang lunas' : 'Pembayaran hutang dicatat'); onClose(); },
  });
  return (
    <Modal open onClose={onClose} title={bill.supplier} subtitle={`${bill.keterangan}${bill.nota ? ` · ${bill.nota}` : ''} · ${tgl(bill.tanggal)}`}>
      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg bg-sunk p-3"><dt className="text-xs text-muted">Total</dt><dd className="num font-bold">{rp(bill.total)}</dd></div>
        <div className="rounded-lg bg-sunk p-3"><dt className="text-xs text-muted">Dibayar</dt><dd className="num font-bold">{rp(bill.terbayar)}</dd></div>
        <div className="rounded-lg bg-sunk p-3"><dt className="text-xs text-muted">Sisa · jatuh tempo {tgl(bill.jatuh_tempo)}</dt><dd className="num font-bold text-bad">{rp(bill.sisa)}</dd></div>
      </dl>
      <h3 className="mb-2 mt-4 text-sm font-bold">Riwayat pembayaran</h3>
      {!bill.pembayaran.length ? <p className="text-sm text-muted">Belum ada pembayaran.</p> : (
        <ul className="divide-y divide-line rounded-xl border border-line text-sm">
          {bill.pembayaran.map((p) => <li key={p.id} className="flex flex-wrap gap-x-3 px-3 py-2"><span className="num">{tgl(p.tanggal)}</span><span className="font-semibold">{p.metode}</span><span className="text-xs text-muted">{p.oleh} · {tglJam(p.created_at)}</span><span className="num ml-auto font-bold">{rp(p.nominal)}</span></li>)}
        </ul>
      )}
      {bill.sisa > 0 && can('hutang', 'ubah') && (
        <section className="mt-4 rounded-xl border border-brand/40 bg-brand/5 p-4">
          <h3 className="mb-3 text-sm font-bold">Bayar hutang</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Nominal"><input id="bp-nominal" className="input num text-right" inputMode="numeric" value={nominal ? nf(numIn(nominal)) : ''} onChange={(e) => setNominal(e.target.value)} /></Field>
            <Field label="Metode"><select id="bp-metode" className="input" value={methodId} onChange={(e) => setMethodId(e.target.value)}><option value="">– pilih –</option>{methods.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}</select></Field>
            <Field label="Tanggal bayar"><input id="bp-tanggal" type="date" className="input" max={ymd()} value={tanggal} onChange={(e) => setTanggal(e.target.value)} /></Field>
            <Field label="Catatan / no. transfer" className="sm:col-span-3"><input id="bp-ket" className="input" value={ket} onChange={(e) => setKet(e.target.value)} /></Field>
          </div>
          <div className="mt-3"><ErrorBox error={pay.error} /></div>
          <div className="mt-3 flex justify-end"><button className="btn btn-primary" disabled={!numIn(nominal) || !methodId || pay.isPending} onClick={() => pay.mutate()}><HandCoins size={16} />Simpan pembayaran</button></div>
        </section>
      )}
    </Modal>
  );
}

function NewBill({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const meta = useExpenseMeta();
  const [f, setF] = useState({ tanggal: ymd(), supplier_id: '', nota: '', total: '', jatuh_tempo: addDays(ymd(), 30), keterangan: '' });
  const save = useMutation({
    mutationFn: () => api('bills.save', { bill: { ...f, total: numIn(f.total) } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bills'] }); toast('Tagihan dicatat'); onClose(); },
  });
  return (
    <Modal open onClose={onClose} title="Tagihan supplier" subtitle="Untuk hutang lama atau tagihan yang tidak dicatat lewat Pengeluaran (mis. saat migrasi dari Excel)."
      footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={!f.supplier_id || !numIn(f.total) || save.isPending} onClick={() => save.mutate()}>Simpan</button></>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Supplier"><select id="nb-sup" className="input" value={f.supplier_id} onChange={(e) => setF({ ...f, supplier_id: e.target.value })}><option value="">– pilih –</option>{(meta.data?.suppliers || []).map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}</select></Field>
        <Field label="No. nota"><input id="nb-nota" className="input" value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} /></Field>
        <Field label="Tanggal"><input id="nb-tgl" type="date" className="input" value={f.tanggal} onChange={(e) => setF({ ...f, tanggal: e.target.value })} /></Field>
        <Field label="Jatuh tempo"><input id="nb-jt" type="date" className="input" value={f.jatuh_tempo} onChange={(e) => setF({ ...f, jatuh_tempo: e.target.value })} /></Field>
        <Field label="Total"><input id="nb-total" className="input num text-right" inputMode="numeric" value={f.total ? nf(numIn(f.total)) : ''} onChange={(e) => setF({ ...f, total: e.target.value })} /></Field>
        <Field label="Keterangan"><input id="nb-ket" className="input" value={f.keterangan} onChange={(e) => setF({ ...f, keterangan: e.target.value })} /></Field>
      </div>
      <div className="mt-3"><ErrorBox error={save.error} /></div>
    </Modal>
  );
}

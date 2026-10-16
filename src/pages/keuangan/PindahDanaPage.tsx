import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, ArrowUpDown, Ban, CheckCircle2, KeyRound, Scale } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/table/DataTable';
import { DateRangeFilter, periodeLabel, rangeFor, type DateRange } from '@/components/table/DateRangeFilter';
import { ErrorBox, Field, PageHeader } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { KasCards, type KasSaldo } from '@/components/SumberKas';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { nf, rp, tgl, tglJam, ymd } from '@/lib/format';

interface Transfer {
  id: string; tanggal: string; jenis: string; dari: string; ke: string; dari_nama: string; ke_nama: string; nominal: number; biaya_admin: number; keterangan: string;
  batal: boolean; alasan_batal: string; batal_oleh_nama: string; batal_at: string; oleh: string; created_at: string;
}
interface Recon { id: string; tanggal: string; akun: string; akun_nama: string; saldo_sistem: number; saldo_asli: number; selisih: number; disesuaikan: boolean; alasan: string; keterangan: string; oleh: string; created_at: string }
interface FundData { transfers: Transfer[]; recons: Recon[]; akun: KasSaldo[]; per: string; alasan: string[] }

const numIn = (s: string) => Number(String(s).replace(/[^\d]/g, '')) || 0;
const JENIS_PILL: Record<string, string> = {
  'Setor tunai': 'bg-green-100 text-green-800', 'Tarik tunai': 'bg-purple-100 text-purple-800', 'Antar rekening': 'bg-blue-100 text-blue-800',
  'Isi kas kecil': 'bg-amber-100 text-amber-800', 'Kembali dari kas kecil': 'bg-amber-100 text-amber-800', 'Pencairan EDC': 'bg-slate-100 text-slate-700',
};
const jenisOf = (d?: KasSaldo, k?: KasSaldo) => !d || !k ? '' : k.jenis === 'kas_kecil' ? 'Isi kas kecil' : d.jenis === 'kas_kecil' ? 'Kembali dari kas kecil' : d.jenis === 'tunai' ? 'Setor tunai' : k.jenis === 'tunai' ? 'Tarik tunai' : d.jenis === 'edc' ? 'Pencairan EDC' : 'Antar rekening';
const INVALIDATE = ['fund', 'kas-saldo', 'kas-kecil', 'dashboard', 'laporan'];

/** Kolom password untuk verifikasi tindakan keuangan. */
function PasswordField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Password Anda (verifikasi)">
      <div className="relative"><KeyRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input id={id} type="password" autoComplete="current-password" className="input pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Masukkan password login" /></div>
    </Field>
  );
}

export function PindahDanaPage() {
  const { can } = useAuth();
  const [sp, setSp] = useSearchParams();
  const [tab, setTab] = useState<'riwayat' | 'rekon'>('riwayat');
  const [range, setRange] = useState<DateRange>(rangeFor('bulan_ini'));
  const q = useQuery({ queryKey: ['fund', range.from, range.to], queryFn: () => api<FundData>('fund.list', { from: range.from, to: range.to }) });
  const [form, setForm] = useState<{ ke?: string } | null>(null);
  const [cancel, setCancel] = useState<Transfer | null>(null);
  useEffect(() => { const ke = sp.get('ke'); if (ke && can('pindah_dana', 'tambah')) { setForm({ ke }); setSp({}, { replace: true }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cols: ColumnDef<Transfer, any>[] = [
    { accessorKey: 'tanggal', header: 'Tanggal', cell: (c) => <span className="num whitespace-nowrap">{tgl(c.getValue())}</span> },
    { accessorKey: 'jenis', header: 'Jenis', meta: { filter: 'select' }, cell: (c) => <span className={`pill ${JENIS_PILL[c.getValue()] || 'pill-mute'}`}>{c.getValue()}</span> },
    { id: 'alur', accessorFn: (r) => `${r.dari_nama} → ${r.ke_nama}`, header: 'Dari → Ke', cell: (c) => <span className="whitespace-nowrap font-semibold">{c.row.original.dari_nama} <span className="text-brand">→</span> {c.row.original.ke_nama}</span> },
    { accessorKey: 'nominal', header: 'Nominal', meta: { align: 'right', money: true, total: true }, cell: (c) => <b className={c.row.original.batal ? 'text-muted line-through' : ''}>{nf(c.getValue())}</b> },
    { accessorKey: 'biaya_admin', header: 'Admin', meta: { align: 'right', money: true }, cell: (c) => (c.getValue() ? <span className="text-bad">{nf(c.getValue())}</span> : <span className="text-muted">–</span>) },
    { accessorKey: 'keterangan', header: 'Catatan', cell: (c) => <span>{c.getValue()}{c.row.original.batal && <span className="block text-[11px] text-bad">Dibatalkan {c.row.original.batal_oleh_nama} · {tglJam(c.row.original.batal_at)}: {c.row.original.alasan_batal}</span>}</span> },
    { accessorKey: 'oleh', header: 'Dicatat', meta: { filter: 'select' }, cell: (c) => <span className="text-xs">{c.getValue()}<span className="block text-muted">{tglJam(c.row.original.created_at)}</span></span> },
    { id: 'status', accessorFn: (r) => (r.batal ? 'Batal' : 'Sah'), header: 'Status', meta: { filter: 'select' }, cell: (c) => c.getValue() === 'Batal' ? <span className="pill pill-bad">Batal</span> : <span className="pill pill-ok">Sah</span> },
    ...(can('pindah_dana', 'hapus') ? [{ id: 'aksi', header: '', enableSorting: false, meta: { noExport: true, hideOnCard: true },
      cell: (c: { row: { original: Transfer } }) => c.row.original.batal ? null : <button className="btn btn-ghost btn-sm px-1.5 text-bad" aria-label="Batalkan" title="Batalkan" onClick={() => setCancel(c.row.original)}><Ban size={14} /></button> } as ColumnDef<Transfer, any>] : []),
  ];

  return (
    <>
      <PageHeader title="Pindah Dana" desc="Setor tunai ke bank, tarik tunai, antar rekening, dan isi kas kecil. Uang hanya pindah tempat, jadi laba tidak berubah. Semua tercatat dengan password & catatan."
        actions={can('pindah_dana', 'tambah') && <button id="pd-new" className="btn btn-primary" onClick={() => setForm({})}><ArrowLeftRight size={16} />Pindah dana</button>} />
      <div className="mb-4 flex gap-1.5">
        {([['riwayat', 'Riwayat pindah dana'], ['rekon', 'Rekonsiliasi rekening']] as const).map(([k, l]) => (
          <button key={k} id={`pd-tab-${k}`} className={`chip ${tab === k ? 'border-ink bg-ink text-canvas' : 'hover:border-muted'}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <KasCards className="mb-4" />
      {tab === 'riwayat' ? (
        <DataTable<Transfer> data={q.data?.transfers || []} loading={q.isLoading} columns={cols} title="Pindah dana" storageKey="pindah-dana" canExport={can('pindah_dana', 'ekspor')}
          exportSubtitle={periodeLabel(range.from, range.to)} toolbar={<DateRangeFilter value={range} onChange={setRange} id="pd-range" />} searchPlaceholder="Cari catatan, rekening…"
          cardTitle={(r) => <span className="flex justify-between gap-2"><span>{r.dari_nama} → {r.ke_nama}</span><span className="num">{rp(r.nominal)}</span></span>} emptyText="Belum ada pindah dana di periode ini." />
      ) : <ReconTab range={range} setRange={setRange} history={q.data?.recons || []} alasan={q.data?.alasan || []} />}
      {form && <TransferForm initialKe={form.ke} onClose={() => setForm(null)} />}
      {cancel && <CancelModal t={cancel} onClose={() => setCancel(null)} />}
    </>
  );
}

function TransferForm({ initialKe, onClose }: { initialKe?: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['fund', 'akun'], queryFn: () => api<FundData>('fund.list', { from: ymd(), to: ymd() }) });
  const akun = q.data?.akun || [];
  const [f, setF] = useState({ dari: '', ke: initialKe || '', nominal: '', admin: '', tanggal: ymd(), keterangan: '', password: '' });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  useEffect(() => {
    if (!akun.length) return;
    const tunai = akun.find((a) => a.jenis === 'tunai');
    setF((x) => {
      const ke = x.ke || akun.find((a) => a.jenis === 'transfer')?.id || '';
      const dari = x.dari || (ke !== tunai?.id ? tunai?.id : akun.find((a) => a.jenis === 'transfer')?.id) || '';
      return { ...x, dari, ke };
    });
  }, [akun.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const dari = akun.find((a) => a.id === f.dari), ke = akun.find((a) => a.id === f.ke);
  const nominal = numIn(f.nominal), admin = numIn(f.admin);
  const sisaDari = dari ? dari.saldo - nominal - admin : 0, sisaKe = ke ? ke.saldo + nominal : 0;
  const save = useMutation({
    mutationFn: () => api<Transfer>('fund.transfer', { transfer: { dari: f.dari, ke: f.ke, nominal, biaya_admin: admin, tanggal: f.tanggal, keterangan: f.keterangan }, password: f.password }),
    onSuccess: (r) => { INVALIDATE.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast(`${r.jenis}: ${r.dari_nama} → ${r.ke_nama} ${rp(r.nominal)} tercatat`); onClose(); },
  });
  const ok = dari && ke && dari.id !== ke.id && nominal > 0 && f.keterangan.trim() && f.password;
  const opt = (a: KasSaldo) => <option key={a.id} value={a.id}>{a.nama} — saldo Rp {nf(a.saldo)}</option>;
  return (
    <Modal open onClose={onClose} title="Pindah dana" subtitle="Uang pindah tempat, bukan pemasukan / pengeluaran"
      footer={<><button className="btn" onClick={onClose}>Batal</button><button id="pd-save" className="btn btn-primary" disabled={!ok || save.isPending} onClick={() => save.mutate()}>Simpan pindah {nominal ? rp(nominal) : ''}</button></>}>
      <div className="flex flex-col gap-3.5">
        <div>
          <Field label="Dari"><select id="pd-dari" className="input" value={f.dari} onChange={(e) => set('dari', e.target.value)}>{akun.map(opt)}</select></Field>
          {dari && nominal > 0 && <div className={`mt-1 flex justify-between text-xs ${sisaDari < 0 ? 'font-semibold text-bad' : 'text-muted'}`}><span>Saldo {dari.nama} setelah pindah</span><b className="num">Rp {nf(sisaDari)}{sisaDari < 0 ? ' · tidak cukup' : ''}</b></div>}
        </div>
        <div className="-my-1 flex justify-center">
          <button type="button" className="grid h-8 w-8 place-items-center rounded-full bg-brand text-brand-ink shadow" title="Tukar arah" aria-label="Tukar arah" onClick={() => setF((x) => ({ ...x, dari: x.ke, ke: x.dari }))}><ArrowUpDown size={15} /></button>
        </div>
        <div>
          <Field label="Ke"><select id="pd-ke" className="input" value={f.ke} onChange={(e) => set('ke', e.target.value)}>{akun.map(opt)}</select></Field>
          {ke && nominal > 0 && <div className="mt-1 flex justify-between text-xs text-muted"><span>Saldo {ke.nama} setelah pindah</span><b className="num text-ok">Rp {nf(sisaKe)}</b></div>}
          {dari && ke && dari.id === ke.id && <p className="mt-1 text-xs font-semibold text-bad">Asal dan tujuan tidak boleh sama.</p>}
        </div>
        <Field label="Nominal (Rp)"><input id="pd-nominal" className="input num text-right text-xl font-bold" inputMode="numeric" placeholder="0" value={f.nominal ? nf(nominal) : ''} onChange={(e) => set('nominal', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Biaya admin (opsional)" hint="Dipotong dari rekening asal"><input id="pd-admin" className="input num text-right" inputMode="numeric" placeholder="0" value={f.admin ? nf(admin) : ''} onChange={(e) => set('admin', e.target.value)} /></Field>
          <Field label="Tanggal"><input id="pd-tanggal" type="date" className="input" max={ymd()} value={f.tanggal} onChange={(e) => set('tanggal', e.target.value)} /></Field>
        </div>
        <Field label="Catatan / no. referensi (wajib)"><input id="pd-ket" className="input" placeholder="mis. setoran harian, ref transfer 88213" value={f.keterangan} onChange={(e) => set('keterangan', e.target.value)} /></Field>
        {dari && ke && dari.id !== ke.id && <div className="rounded-lg bg-sunk px-3 py-2 text-xs"><b>Terbaca sebagai:</b> {jenisOf(dari, ke)} · {dari.nama} → {ke.nama}{admin ? ` · admin ${rp(admin)}` : ''}</div>}
        <PasswordField id="pd-password" value={f.password} onChange={(v) => set('password', v)} />
        <ErrorBox error={save.error} />
      </div>
    </Modal>
  );
}

function CancelModal({ t, onClose }: { t: Transfer; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [alasan, setAlasan] = useState('');
  const [pw, setPw] = useState('');
  const m = useMutation({
    mutationFn: () => api('fund.cancel', { id: t.id, alasan, password: pw }),
    onSuccess: () => { INVALIDATE.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast('Pindah dana dibatalkan, saldo dikembalikan'); onClose(); },
  });
  return (
    <Modal open onClose={onClose} size="sm" title="Batalkan pindah dana?" subtitle={`${t.jenis} · ${t.dari_nama} → ${t.ke_nama} · ${rp(t.nominal)} · ${tgl(t.tanggal)}`}
      footer={<><button className="btn" onClick={onClose}>Tutup</button><button id="pd-cancel-ok" className="btn btn-danger" disabled={!alasan.trim() || !pw || m.isPending} onClick={() => m.mutate()}>Batalkan</button></>}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">Data tidak dihapus: tetap tampil di riwayat dengan status <b className="text-bad">Batal</b>, dan saldo kedua sisi dikembalikan.</p>
        <Field label="Alasan pembatalan"><input id="pd-alasan" className="input" value={alasan} onChange={(e) => setAlasan(e.target.value)} /></Field>
        <PasswordField id="pd-cancel-pw" value={pw} onChange={setPw} />
        <ErrorBox error={m.error} />
      </div>
    </Modal>
  );
}

interface ReconRow { asli: string; sesuaikan: boolean; alasan: string; ket: string }
function ReconTab({ range, setRange, history, alasan }: { range: DateRange; setRange: (r: DateRange) => void; history: Recon[]; alasan: string[] }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [per, setPer] = useState(ymd());
  const q = useQuery({ queryKey: ['fund', 'per', per], queryFn: () => api<FundData>('fund.list', { from: per, to: per, per }) });
  const akun = (q.data?.akun || []).filter((a) => a.jenis !== 'edc' || a.saldo !== 0);
  const [rows, setRows] = useState<Record<string, ReconRow>>({});
  const [pw, setPw] = useState('');
  const setRow = (id: string, v: Partial<ReconRow>) => setRows((x) => { const base: ReconRow = x[id] || { asli: '', sesuaikan: false, alasan: alasan[0] || '', ket: '' }; return { ...x, [id]: { ...base, ...v } }; });
  const calc = akun.map((a) => {
    const r = rows[a.id];
    const filled = !!r && r.asli !== '';
    const asli = filled ? Number(String(r.asli).replace(/[^\d-]/g, '')) || 0 : 0;
    return { a, r, filled, asli, sel: filled ? asli - a.saldo : 0 };
  });
  const filled = calc.filter((x) => x.filled);
  const save = useMutation({
    mutationFn: () => api('recon.save', { tanggal: per, password: pw, rows: filled.map((x) => ({ akun: x.a.id, saldo_asli: x.asli, sesuaikan: x.r!.sesuaikan && x.sel !== 0, alasan: x.r!.alasan, keterangan: x.r!.ket })) }),
    onSuccess: () => { INVALIDATE.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast('Rekonsiliasi tersimpan'); setRows({}); setPw(''); },
  });
  const bad = filled.some((x) => x.r!.sesuaikan && x.sel !== 0 && (!x.r!.alasan || !x.r!.ket.trim()));
  const histCols: ColumnDef<Recon, any>[] = useMemo(() => [
    { accessorKey: 'tanggal', header: 'Per tanggal', cell: (c) => <span className="num">{tgl(c.getValue())}</span> },
    { accessorKey: 'akun_nama', header: 'Kas / rekening', meta: { filter: 'select' }, cell: (c) => <b>{c.getValue()}</b> },
    { accessorKey: 'saldo_sistem', header: 'Sistem', meta: { align: 'right', money: true }, cell: (c) => nf(c.getValue()) },
    { accessorKey: 'saldo_asli', header: 'Asli', meta: { align: 'right', money: true }, cell: (c) => nf(c.getValue()) },
    { accessorKey: 'selisih', header: 'Selisih', meta: { align: 'right', money: true }, cell: (c) => <b className={c.getValue() < 0 ? 'text-bad' : c.getValue() > 0 ? 'text-ok' : ''}>{c.getValue() > 0 ? '+' : ''}{nf(c.getValue())}</b> },
    { id: 'hasil', accessorFn: (r) => (!r.selisih ? 'Cocok' : r.disesuaikan ? 'Disesuaikan' : 'Dicatat saja'), header: 'Hasil', meta: { filter: 'select' },
      cell: (c) => <span className={`pill ${c.getValue() === 'Cocok' ? 'pill-ok' : c.getValue() === 'Disesuaikan' ? 'pill-brand' : 'pill-warn'}`}>{c.getValue()}{c.row.original.alasan ? ` · ${c.row.original.alasan}` : ''}</span> },
    { accessorKey: 'keterangan', header: 'Catatan' },
    { accessorKey: 'oleh', header: 'Dicek oleh', meta: { filter: 'select' }, cell: (c) => <span className="text-xs">{c.getValue()}<span className="block text-muted">{tglJam(c.row.original.created_at)}</span></span> },
  ], []);
  return (
    <>
      <section className="card mb-4 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <Scale size={18} className="text-brand" />
          <div className="flex-1"><b>Cocokkan saldo sistem dengan saldo asli</b><div className="text-xs text-muted">Isi saldo dari m-banking / mutasi bank atau hasil hitung uang fisik. Selisih bisa disesuaikan dengan alasan & catatan.</div></div>
          <label className="flex items-center gap-2 text-sm">Per tanggal <input id="rk-per" type="date" className="input w-40" max={ymd()} value={per} onChange={(e) => { setPer(e.target.value); setRows({}); }} /></label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead><tr className="bg-[#14532D] text-left text-[11px] uppercase tracking-wider text-white">
              <th className="px-3 py-2.5">Kas / rekening</th><th className="px-3 py-2.5 text-right">Saldo sistem</th><th className="px-3 py-2.5 text-right">Saldo asli</th><th className="px-3 py-2.5 text-right">Selisih</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Penyesuaian</th>
            </tr></thead>
            <tbody>
              {calc.map(({ a, r, filled: f, sel }) => (
                <tr key={a.id} className="border-b border-line align-top">
                  <td className="px-3 py-2.5 font-semibold">{a.nama}</td>
                  <td className="num px-3 py-2.5 text-right">{nf(a.saldo)}</td>
                  <td className="px-3 py-1.5 text-right"><input id={`rk-asli-${a.id}`} className="input num ml-auto w-40 text-right" inputMode="numeric" placeholder="belum diisi" disabled={!can('pindah_dana', 'ubah')}
                    value={r?.asli ? nf(Number(String(r.asli).replace(/[^\d-]/g, '')) || 0) : ''} onChange={(e) => setRow(a.id, { asli: e.target.value.replace(/[^\d-]/g, '') })} /></td>
                  <td className={`num px-3 py-2.5 text-right font-bold ${sel < 0 ? 'text-bad' : sel > 0 ? 'text-ok' : ''}`}>{f ? `${sel > 0 ? '+' : ''}${nf(sel)}` : '–'}</td>
                  <td className="px-3 py-2.5">{!f ? <span className="pill pill-mute">Belum dicek</span> : sel === 0 ? <span className="pill pill-ok"><CheckCircle2 size={12} className="mr-1 inline" />Cocok</span> : <span className={`pill ${sel < 0 ? 'pill-bad' : 'pill-warn'}`}>{sel < 0 ? 'Kurang' : 'Lebih'}</span>}</td>
                  <td className="px-3 py-1.5">
                    {f && sel !== 0 && (
                      <div className="flex flex-col gap-1.5">
                        <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" id={`rk-adj-${a.id}`} checked={!!r?.sesuaikan} onChange={(e) => setRow(a.id, { sesuaikan: e.target.checked })} />Sesuaikan saldo sistem jadi {nf(Number(r?.asli || 0))}</label>
                        {r?.sesuaikan && (
                          <div className="flex gap-1.5">
                            <select id={`rk-alasan-${a.id}`} className="input py-1.5 text-xs" value={r.alasan} onChange={(e) => setRow(a.id, { alasan: e.target.value })}>{alasan.map((x) => <option key={x}>{x}</option>)}</select>
                            <input id={`rk-ket-${a.id}`} className="input py-1.5 text-xs" placeholder="Catatan (wajib)" value={r.ket} onChange={(e) => setRow(a.id, { ket: e.target.value })} />
                          </div>
                        )}
                        {!r?.sesuaikan && <span className="text-[11px] text-muted">Tidak dicentang = selisih hanya dicatat di riwayat.</span>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {can('pindah_dana', 'ubah') && (
          <div className="flex flex-wrap items-end justify-end gap-3 px-4 py-3">
            <div className="w-72"><PasswordField id="rk-password" value={pw} onChange={setPw} /></div>
            <button id="rk-save" className="btn btn-primary" disabled={!filled.length || !pw || bad || save.isPending} onClick={() => save.mutate()}><Scale size={15} />Simpan rekonsiliasi ({filled.length})</button>
            <div className="w-full"><ErrorBox error={save.error} /></div>
          </div>
        )}
      </section>
      <DataTable<Recon> data={history} columns={histCols} title="Riwayat rekonsiliasi" storageKey="rekonsiliasi" canExport={can('pindah_dana', 'ekspor')}
        exportSubtitle={periodeLabel(range.from, range.to)} toolbar={<DateRangeFilter value={range} onChange={setRange} id="rk-range" />} searchPlaceholder="Cari rekening, catatan…"
        cardTitle={(r) => <span className="flex justify-between"><span>{r.akun_nama}</span><span className="num">{nf(r.selisih)}</span></span>} emptyText="Belum ada rekonsiliasi di periode ini." />
    </>
  );
}

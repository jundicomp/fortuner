import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plus, Scale, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/table/DataTable';
import { DateRangeFilter, rangeFor, type DateRange } from '@/components/table/DateRangeFilter';
import { ErrorBox, Field, PageHeader } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { nf, rp, tgl, ymd } from '@/lib/format';
import { numIn } from '@/pages/stok/stokApi';
import { kodeTampil, SUMBER, TIPE, type Account, type JEntry, type TrialRow } from './akuntansi';
import { Money } from '@/components/ui/Money';

type Tab = 'neraca' | 'akun' | 'jurnal';
interface Ledger { akun: Account; from: string; to: string; saldo_awal: number; saldo_akhir: number; rows: { tanggal: string; ref: string; sumber: string; keterangan: string; debit: number; kredit: number; saldo: number }[]; accounts: Account[] }
interface Manual { id: string; tanggal: string; keterangan: string; lines: { akun: string; debit: number; kredit: number }[]; oleh: string }

/** Buku besar yang dibentuk dari semua transaksi: neraca saldo, rincian per akun, jurnal umum, dan jurnal manual (saldo awal/koreksi). */
export function BukuBesarPage() {
  const [sp, setSp] = useSearchParams();
  const initFrom = sp.get('from'), initTo = sp.get('to');
  const [tab, setTab] = useState<Tab>(sp.get('akun') ? 'akun' : 'neraca');
  const [akun, setAkun] = useState(sp.get('akun') || '1300');
  const [range, setRange] = useState<DateRange>(initFrom && initTo ? { preset: 'custom', from: initFrom, to: initTo } : rangeFor('bulan_ini'));
  const to = range.to || ymd(), from = range.from || '2000-01-01';
  const pickAkun = (k: string) => { setAkun(k); setTab('akun'); setSp({}, { replace: true }); };
  const tabs: [Tab, string][] = [['neraca', 'Neraca saldo'], ['akun', 'Buku besar per akun'], ['jurnal', 'Jurnal umum']];
  return (
    <>
      <PageHeader title="Buku Besar" desc="Semua transaksi (nota, pembayaran, pembelian, pemakaian bahan, opname, pengeluaran, hutang, kas kecil) dibukukan otomatis dengan debit = kredit. Jurnal manual hanya untuk saldo awal dan koreksi."
        actions={<DateRangeFilter value={range} onChange={setRange} id="bb-range" />} />
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map(([k, l]) => <button key={k} id={`bb-tab-${k}`} onClick={() => setTab(k)} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${tab === k ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}>{l}</button>)}
      </div>
      {tab === 'neraca' && <NeracaTab from={from} to={to} onPick={pickAkun} />}
      {tab === 'akun' && <AkunTab from={from} to={to} akun={akun} onPick={setAkun} />}
      {tab === 'jurnal' && <JurnalTab from={from} to={to} onPick={pickAkun} />}
    </>
  );
}

function NeracaTab({ from, to, onPick }: { from: string; to: string; onPick: (k: string) => void }) {
  const { can } = useAuth();
  const q = useQuery({ queryKey: ['ledger-trial', from, to], queryFn: () => api<{ rows: TrialRow[]; total_debit: number; total_kredit: number }>('ledger.trial', { from, to }) });
  const d = q.data;
  const sum = (t: Account['tipe']) => (d?.rows || []).filter((r) => r.tipe === t).reduce((a, r) => a + r.saldo_akhir, 0);
  const cols: ColumnDef<TrialRow, any>[] = [
    { id: 'kode', accessorFn: (r) => kodeTampil(r.kode), header: 'Kode', meta: { className: 'font-mono text-xs' } },
    { accessorKey: 'nama', header: 'Akun', cell: (c) => <span className="font-semibold">{c.getValue()}</span>, meta: { hideOnCard: true } },
    { id: 'tipe', accessorFn: (r) => TIPE[r.tipe], header: 'Kelompok', meta: { filter: 'select' } },
    { accessorKey: 'saldo_awal', header: 'Saldo awal', meta: { money: true, align: 'right' }, cell: (c) => <span className="num text-muted">{nf(c.getValue())}</span> },
    { accessorKey: 'debit', header: 'Debit', meta: { money: true, align: 'right', total: true }, cell: (c) => <span className="num">{nf(c.getValue())}</span> },
    { accessorKey: 'kredit', header: 'Kredit', meta: { money: true, align: 'right', total: true }, cell: (c) => <span className="num">{nf(c.getValue())}</span> },
    { accessorKey: 'saldo_akhir', header: 'Saldo akhir', meta: { money: true, align: 'right' }, cell: (c) => <b className={`num ${c.getValue() < 0 ? 'text-bad' : ''}`}>{nf(c.getValue())}</b> },
  ];
  const balanced = d && d.total_debit === d.total_kredit;
  return (
    <>
      {d && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {(['aset', 'kewajiban', 'modal', 'pendapatan'] as const).map((t) => <div key={t} className="card p-3"><div className="text-[11px] font-bold uppercase tracking-wider text-muted">{TIPE[t]}</div><div className="num mt-0.5 text-lg font-extrabold">{nf(sum(t))}</div></div>)}
          <div className={`card flex items-center gap-2 p-3 text-sm font-semibold ${balanced ? 'text-ok' : 'text-bad'}`}>{balanced ? <CheckCircle2 size={18} /> : <Scale size={18} />}{balanced ? 'Debit = kredit, seimbang' : 'Tidak seimbang!'}</div>
        </div>
      )}
      <DataTable<TrialRow> data={d?.rows || []} loading={q.isLoading} columns={cols} title={`Neraca saldo ${from} sd ${to}`} storageKey="bb-neraca" canExport={can('laporan.laba', 'ekspor')} onRowClick={(r) => onPick(r.kode)}
        cardTitle={(r) => <span className="flex justify-between gap-2"><span>{r.nama}</span><span className="num">{nf(r.saldo_akhir)}</span></span>} emptyText="Belum ada transaksi." />
      <p className="mt-2 text-xs text-muted">Saldo ditampilkan sesuai sisi normal akun: aset, HPP, beban bertambah di debit; kewajiban, modal, pendapatan bertambah di kredit. Klik akun untuk melihat rinciannya.</p>
    </>
  );
}

function AkunTab({ from, to, akun, onPick }: { from: string; to: string; akun: string; onPick: (k: string) => void }) {
  const { can } = useAuth();
  const q = useQuery({ queryKey: ['ledger', akun, from, to], queryFn: () => api<Ledger>('ledger.get', { akun, from, to }) });
  const d = q.data;
  const rows = useMemo(() => [...(d?.rows || [])].reverse(), [d]);
  type R = Ledger['rows'][number];
  const cols: ColumnDef<R, any>[] = [
    { accessorKey: 'tanggal', header: 'Tanggal', cell: (c) => <span className="num whitespace-nowrap">{tgl(c.getValue())}</span> },
    { accessorKey: 'ref', header: 'Ref', meta: { className: 'font-mono text-xs' } },
    { id: 'sumber', accessorFn: (r) => SUMBER[r.sumber] || r.sumber, header: 'Sumber', meta: { filter: 'select' } },
    { accessorKey: 'keterangan', header: 'Keterangan', cell: (c) => <span className="text-xs">{c.getValue()}</span> },
    { accessorKey: 'debit', header: 'Debit', meta: { money: true, align: 'right', total: true }, cell: (c) => (c.getValue() ? <span className="num">{nf(c.getValue())}</span> : '') },
    { accessorKey: 'kredit', header: 'Kredit', meta: { money: true, align: 'right', total: true }, cell: (c) => (c.getValue() ? <span className="num">{nf(c.getValue())}</span> : '') },
    { accessorKey: 'saldo', header: 'Saldo', meta: { money: true, align: 'right' }, cell: (c) => <b className="num">{nf(c.getValue())}</b> },
  ];
  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-3 sm:col-span-2"><div className="text-[11px] font-bold uppercase tracking-wider text-muted">Akun</div><div className="mt-0.5 font-bold">{d ? `${kodeTampil(d.akun.kode)} · ${d.akun.nama}` : '…'}</div><div className="text-xs text-muted">{d ? TIPE[d.akun.tipe] : ''}</div></div>
        <div className="card p-3"><div className="text-[11px] font-bold uppercase tracking-wider text-muted">Saldo awal</div><div className="num mt-0.5 text-lg font-extrabold">{d ? nf(d.saldo_awal) : '…'}</div></div>
        <div className="card p-3"><div className="text-[11px] font-bold uppercase tracking-wider text-muted">Saldo akhir</div><div className="num mt-0.5 text-lg font-extrabold">{d ? nf(d.saldo_akhir) : '…'}</div></div>
      </div>
      <ErrorBox error={q.error} />
      <DataTable<R> data={rows} loading={q.isLoading} columns={cols} title={`Buku besar ${d?.akun.nama || akun}`} storageKey="bb-akun" canExport={can('laporan.laba', 'ekspor')}
        toolbar={<select id="bb-akun" className="input w-auto min-w-[240px]" value={akun} onChange={(e) => onPick(e.target.value)}>
          {(d?.accounts || [{ kode: akun, nama: akun, tipe: 'aset' as const }]).map((a) => <option key={a.kode} value={a.kode}>{kodeTampil(a.kode)} · {a.nama}</option>)}
        </select>}
        cardTitle={(r) => <span className="flex justify-between gap-2"><span className="truncate">{r.keterangan}</span><span className="num text-sm">{tgl(r.tanggal)}</span></span>} emptyText="Tidak ada mutasi di periode ini." />
    </>
  );
}

function JurnalTab({ from, to, onPick }: { from: string; to: string; onPick: (k: string) => void }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['journal', from, to], queryFn: () => api<{ accounts: Account[]; entries: JEntry[]; manual: Manual[] }>('journal.list', { from, to }) });
  const [sumber, setSumber] = useState('');
  const [form, setForm] = useState(false);
  const [del, setDel] = useState<Manual | null>(null);
  const [alasan, setAlasan] = useState('');
  const [limit, setLimit] = useState(60);
  const nama = Object.fromEntries((q.data?.accounts || []).map((a) => [a.kode, a.nama]));
  const entries = useMemo(() => [...(q.data?.entries || [])].filter((e) => !sumber || e.sumber === sumber).reverse(), [q.data, sumber]);
  const remove = useMutation({
    mutationFn: () => api('journal.delete', { id: del!.id, alasan }),
    onSuccess: () => { ['journal', 'ledger', 'ledger-trial', 'pnl'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast('Jurnal dihapus'); setDel(null); setAlasan(''); },
  });
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select id="jr-sumber" className="input w-auto" value={sumber} onChange={(e) => setSumber(e.target.value)}><option value="">Semua sumber</option>{Object.entries(SUMBER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <span className="text-xs text-muted">{entries.length} jurnal</span>
        <span className="flex-1" />
        {can('laporan.laba', 'tambah') && <button id="jr-new" className="btn btn-primary" onClick={() => setForm(true)} disabled={!q.data}><Plus size={16} />Jurnal manual</button>}
      </div>
      {!!q.data?.manual.length && (
        <section className="card mb-4 p-4">
          <h3 className="mb-2 text-sm font-bold">Jurnal manual</h3>
          <ul className="divide-y divide-line text-sm">{q.data.manual.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2">
              <span className="num w-24 shrink-0">{tgl(m.tanggal)}</span><span className="min-w-0 flex-1 truncate">{m.keterangan} <span className="text-xs text-muted">· {m.oleh}</span></span>
              <span className="num font-semibold">{nf(m.lines.reduce((a, l) => a + l.debit, 0))}</span>
              {can('laporan.laba', 'hapus') && <button className="btn btn-ghost btn-sm px-1.5 text-bad" aria-label="Hapus" onClick={() => setDel(m)}><Trash2 size={14} /></button>}
            </li>
          ))}</ul>
        </section>
      )}
      <div className="flex flex-col gap-2">
        {q.isLoading && <div className="card p-4 text-sm text-muted">Memuat…</div>}
        {entries.slice(0, limit).map((e, i) => (
          <section key={i} className="card px-4 py-3 text-sm">
            <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3"><span className="num font-semibold">{tgl(e.tanggal)}</span><span className="font-mono text-xs text-muted">{e.ref}</span><span className="pill pill-mute">{SUMBER[e.sumber] || e.sumber}</span><span className="min-w-0 flex-1 truncate text-muted">{e.keterangan}</span></div>
            <table className="w-full text-xs"><tbody>{e.lines.map((l, j) => (
              <tr key={j}><td className={`py-0.5 ${l.k ? 'pl-6' : ''}`}><button className="hover:text-brand hover:underline" onClick={() => onPick(l.akun)}>{kodeTampil(l.akun)} · {nama[l.akun] || l.akun}</button></td><td className="num w-28 text-right">{l.d ? nf(l.d) : ''}</td><td className="num w-28 text-right">{l.k ? nf(l.k) : ''}</td></tr>
            ))}</tbody></table>
          </section>
        ))}
        {entries.length > limit && <button className="btn self-center" onClick={() => setLimit((n) => n + 100)}>Tampilkan lebih banyak ({entries.length - limit} lagi)</button>}
        {!q.isLoading && !entries.length && <div className="card p-6 text-center text-sm text-muted">Tidak ada jurnal di periode ini.</div>}
      </div>
      {form && q.data && <JournalForm accounts={q.data.accounts} onClose={() => setForm(false)} />}
      <Modal open={!!del} onClose={() => setDel(null)} size="sm" title="Hapus jurnal manual?" subtitle={del?.keterangan}
        footer={<><button className="btn" onClick={() => setDel(null)}>Batal</button><button className="btn btn-danger" disabled={!alasan.trim() || remove.isPending} onClick={() => remove.mutate()}>Hapus</button></>}>
        <Field label="Alasan (tercatat di log)"><input className="input" value={alasan} onChange={(e) => setAlasan(e.target.value)} /></Field>
        <div className="mt-3"><ErrorBox error={remove.error} /></div>
      </Modal>
    </>
  );
}

function JournalForm({ accounts, onClose }: { accounts: Account[]; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [tanggal, setTanggal] = useState(ymd());
  const [ket, setKet] = useState('');
  const [lines, setLines] = useState([{ akun: '', debit: '', kredit: '' }, { akun: '3100', debit: '', kredit: '' }]);
  const d = lines.reduce((a, l) => a + numIn(l.debit), 0), k = lines.reduce((a, l) => a + numIn(l.kredit), 0);
  const ok = d > 0 && d === k && ket.trim() && lines.filter((l) => l.akun && (numIn(l.debit) || numIn(l.kredit))).length >= 2;
  const save = useMutation({
    mutationFn: () => api('journal.save', { journal: { tanggal, keterangan: ket, lines: lines.map((l) => ({ akun: l.akun, debit: numIn(l.debit), kredit: numIn(l.kredit) })) } }),
    onSuccess: () => { ['journal', 'ledger', 'ledger-trial', 'pnl'].forEach((x) => qc.invalidateQueries({ queryKey: [x] })); toast('Jurnal disimpan'); onClose(); },
  });
  const set = (i: number, p: Partial<(typeof lines)[number]>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  return (
    <Modal open onClose={onClose} size="lg" title="Jurnal manual" subtitle="Untuk saldo awal kas/bank, modal, aset yang sudah ada, atau koreksi. Transaksi harian tidak perlu dijurnal manual."
      footer={<><button className="btn" onClick={onClose}>Batal</button><button id="jr-save" className="btn btn-primary" disabled={!ok || save.isPending} onClick={() => save.mutate()}>Simpan</button></>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Tanggal"><input id="jr-tanggal" type="date" className="input" value={tanggal} onChange={(e) => setTanggal(e.target.value)} /></Field>
        <Field label="Keterangan" className="sm:col-span-2"><input id="jr-ket" className="input" value={ket} onChange={(e) => setKet(e.target.value)} placeholder="mis. Saldo awal BCA per 1 Maret" /></Field>
      </div>
      <table className="tbl mt-4 w-full text-sm">
        <thead className="text-left text-xs text-muted"><tr><th className="py-1">Akun</th><th className="w-36 text-right">Debit</th><th className="w-36 text-right">Kredit</th><th className="w-8" /></tr></thead>
        <tbody>{lines.map((l, i) => (
          <tr key={i}>
            <td className="py-1 pr-2"><select id={`jr-akun-${i}`} className="input" value={l.akun} onChange={(e) => set(i, { akun: e.target.value })}><option value="">– pilih akun –</option>{accounts.map((a) => <option key={a.kode} value={a.kode}>{kodeTampil(a.kode)} · {a.nama}</option>)}</select></td>
            <td className="pr-2"><input id={`jr-d-${i}`} className="input num text-right" inputMode="numeric" value={l.debit ? nf(numIn(l.debit)) : ''} onChange={(e) => set(i, { debit: e.target.value, kredit: '' })} /></td>
            <td className="pr-1"><input id={`jr-k-${i}`} className="input num text-right" inputMode="numeric" value={l.kredit ? nf(numIn(l.kredit)) : ''} onChange={(e) => set(i, { kredit: e.target.value, debit: '' })} /></td>
            <td>{lines.length > 2 && <button className="btn btn-ghost btn-sm px-1" aria-label="Hapus baris" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><X size={14} /></button>}</td>
          </tr>
        ))}</tbody>
        <tfoot><tr className="border-t border-line font-bold"><td className="py-2"><button className="btn btn-sm" onClick={() => setLines((ls) => [...ls, { akun: '', debit: '', kredit: '' }])}><Plus size={14} />Baris</button></td><td className="num text-right"><Money v={d} /></td><td className="num text-right"><Money v={k} /></td><td /></tr></tfoot>
      </table>
      {d !== k && <p className="mt-2 text-sm text-bad">Selisih {rp(Math.abs(d - k))}. Debit dan kredit harus sama.</p>}
      <div className="mt-3"><ErrorBox error={save.error} /></div>
    </Modal>
  );
}

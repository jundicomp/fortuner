import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, HandCoins, KeyRound, Send, X } from 'lucide-react';
import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/table/DataTable';
import { DateRangeFilter, periodeLabel, rangeFor, type DateRange } from '@/components/table/DateRangeFilter';
import { ErrorBox, Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import type { KasSaldo } from '@/components/SumberKas';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { nf, rp, tgl, tglJam } from '@/lib/format';

export interface Setoran {
  id: string; tanggal: string; kasir_id: string; kasir_nama: string; nominal: number; saldo_laci: number; catatan: string;
  status: 'menunggu' | 'diterima' | 'ditolak' | 'dibatalkan'; diputus_nama: string; diputus_at: string; catatan_owner: string; created_at: string;
}
interface SetoranData { rows: Setoran[]; bisa_putuskan: boolean; laci_saya: (KasSaldo & { user_id: string }) | null; laci: KasSaldo[] }
const numIn = (s: string) => Number(String(s).replace(/[^\d]/g, '')) || 0;
const PILL: Record<string, string> = { menunggu: 'pill-warn', diterima: 'pill-ok', ditolak: 'pill-bad', dibatalkan: 'pill-mute' };
const LABEL: Record<string, string> = { menunggu: 'Menunggu', diterima: 'Diterima', ditolak: 'Ditolak', dibatalkan: 'Dibatalkan' };
const INVALIDATE = ['setoran', 'kas-saldo', 'fund', 'kas-rekap', 'dashboard', 'riwayat', 'notif'];

export const useSetoran = (range?: DateRange) => useQuery({ queryKey: ['setoran', range?.from || '', range?.to || ''], queryFn: () => api<SetoranData>('setoran.list', { from: range?.from || '', to: range?.to || '' }) });

function Pw({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Password Anda (verifikasi)">
      <div className="relative"><KeyRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input id={id} type="password" autoComplete="current-password" className="input pl-9" placeholder="Masukkan password login" value={value} onChange={(e) => onChange(e.target.value)} /></div>
    </Field>
  );
}

/** Setoran fisik laci kasir ke owner: kasir mengisi form, owner menerima / menolak. Riwayat tampil di kedua sisi. */
export function SetoranTab() {
  const { can } = useAuth();
  const [range, setRange] = useState<DateRange>(rangeFor('bulan_ini'));
  const q = useSetoran(range);
  const d = q.data;
  const [decide, setDecide] = useState<{ s: Setoran; terima: boolean } | null>(null);
  const pending = (d?.rows || []).filter((r) => r.status === 'menunggu');
  const myPending = d?.laci_saya ? pending.find((r) => r.kasir_id === d.laci_saya!.user_id) : undefined;

  const cols: ColumnDef<Setoran, any>[] = [
    { accessorKey: 'tanggal', header: 'Tanggal', cell: (c) => <span className="num whitespace-nowrap">{tgl(c.getValue())}<span className="block text-[11px] text-muted">{tglJam(c.row.original.created_at).slice(-5)}</span></span> },
    { accessorKey: 'kasir_nama', header: 'Kasir', meta: { filter: 'select' }, cell: (c) => <b>{c.getValue()}</b> },
    { accessorKey: 'nominal', header: 'Disetor', meta: { align: 'right', money: true, total: true }, cell: (c) => <b>{nf(c.getValue())}</b> },
    { accessorKey: 'saldo_laci', header: 'Saldo laci saat setor', meta: { align: 'right', money: true }, cell: (c) => <span className="text-muted">{nf(c.getValue())}</span> },
    { accessorKey: 'catatan', header: 'Catatan kasir' },
    { accessorKey: 'status', header: 'Status', meta: { filter: 'select', filterLabel: (v: unknown) => LABEL[String(v)] || String(v) }, cell: (c) => <span className={`pill ${PILL[c.getValue()]}`}>{LABEL[c.getValue()]}</span> },
    { id: 'putusan', accessorFn: (r) => r.diputus_nama, header: 'Diputuskan', cell: (c) => c.row.original.status === 'menunggu' ? <span className="text-xs text-muted">–</span>
      : <span className="text-xs">{c.row.original.diputus_nama}<span className="block text-muted">{tglJam(c.row.original.diputus_at)}</span>{c.row.original.catatan_owner && <span className="block text-ink">“{c.row.original.catatan_owner}”</span>}</span> },
  ];

  return (
    <>
      {d?.laci_saya && <FormSetoran laci={d.laci_saya} pending={myPending} />}
      {d?.bisa_putuskan && (
        <section className="card mb-4 p-4">
          <h3 className="mb-3 flex items-center gap-2 font-bold"><Clock size={17} className="text-brand" />Menunggu persetujuan {pending.length ? <span className="pill pill-warn">{pending.length}</span> : null}</h3>
          {!pending.length ? <p className="text-sm text-muted">Tidak ada setoran yang menunggu.</p> : (
            <div className="grid gap-3 md:grid-cols-2">
              {pending.map((s) => {
                const sel = s.nominal - s.saldo_laci;
                return (
                  <div key={s.id} className="rounded-xl border border-amber-300 bg-amber-50/60 p-3.5 dark:bg-amber-500/10">
                    <div className="flex items-start justify-between gap-2">
                      <div><b>{s.kasir_nama}</b><div className="text-xs text-muted">{tgl(s.tanggal)} · {tglJam(s.created_at).slice(-5)}</div></div>
                      <div className="text-right"><div className="text-[11px] text-muted">Disetor</div><div className="num text-xl font-extrabold">{rp(s.nominal)}</div></div>
                    </div>
                    <div className="mt-2 flex justify-between text-xs"><span className="text-muted">Saldo laci di sistem</span><span className="num">{rp(s.saldo_laci)}</span></div>
                    {sel !== 0 && <div className={`flex justify-between text-xs ${sel < 0 ? 'text-muted' : 'font-semibold text-bad'}`}><span>{sel < 0 ? 'Sisa di laci (modal kembalian)' : 'Lebih dari saldo laci'}</span><span className="num">{rp(Math.abs(sel))}</span></div>}
                    {s.catatan && <p className="mt-2 rounded-lg bg-surface px-2.5 py-1.5 text-xs">“{s.catatan}”</p>}
                    <div className="mt-3 flex gap-2">
                      <button id={`st-terima-${s.id}`} className="btn btn-sm flex-1 border-green-700 bg-green-700 text-white" onClick={() => setDecide({ s, terima: true })}><Check size={15} />Terima</button>
                      <button id={`st-tolak-${s.id}`} className="btn btn-sm flex-1 border-bad text-bad" onClick={() => setDecide({ s, terima: false })}><X size={15} />Tolak</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
      <DataTable<Setoran> data={d?.rows || []} loading={q.isLoading} columns={cols} title="Riwayat setoran" storageKey="setoran" canExport={can('kas', 'ekspor')}
        exportSubtitle={periodeLabel(range.from, range.to)} toolbar={<DateRangeFilter value={range} onChange={setRange} id="st-range" />} searchPlaceholder="Cari kasir, catatan…"
        cardTitle={(r) => <span className="flex justify-between gap-2"><span>{r.kasir_nama} · {LABEL[r.status]}</span><span className="num">{rp(r.nominal)}</span></span>} emptyText="Belum ada setoran di periode ini." />
      {decide && <DecideModal s={decide.s} terima={decide.terima} onClose={() => setDecide(null)} />}
    </>
  );
}

function FormSetoran({ laci, pending }: { laci: KasSaldo; pending?: Setoran }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [nominal, setNominal] = useState('');
  const [catatan, setCatatan] = useState('');
  const [pw, setPw] = useState('');
  const [open, setOpen] = useState(false);
  const n = numIn(nominal);
  const kirim = useMutation({
    mutationFn: () => api('setoran.create', { nominal: n, catatan, password: pw }),
    onSuccess: () => { INVALIDATE.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast('Setoran dikirim, menunggu persetujuan owner'); setPw(''); setCatatan(''); setOpen(false); },
  });
  const batal = useMutation({
    mutationFn: () => api('setoran.cancel', { id: pending!.id }),
    onSuccess: () => { INVALIDATE.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast('Setoran dibatalkan'); },
  });
  if (pending) return (
    <section className="card mb-4 flex flex-wrap items-center gap-3 border-amber-300 bg-amber-50/60 p-4 dark:bg-amber-500/10">
      <Clock size={20} className="text-amber-600" />
      <div className="flex-1"><b>Setoran {rp(pending.nominal)} menunggu persetujuan owner</b><div className="text-xs text-muted">Dikirim {tglJam(pending.created_at)}. Saldo laci berkurang setelah owner menerima.</div></div>
      <button className="btn btn-sm" disabled={batal.isPending} onClick={() => batal.mutate()}>Batalkan</button>
    </section>
  );
  return (
    <>
      <section className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand"><HandCoins size={20} /></span>
        <div className="flex-1"><b>Setor uang laci ke owner</b><div className="text-xs text-muted">Saldo {laci.nama} saat ini <b className="text-ink">{rp(laci.saldo)}</b>. Serahkan uang fisik ke owner, lalu buat setoran.</div></div>
        <button id="st-buat" className="btn btn-primary" onClick={() => { kirim.reset(); setNominal(laci.saldo > 0 ? String(laci.saldo) : ''); setOpen(true); }}><Send size={15} />Buat setoran</button>
      </section>
      <Modal open={open} onClose={() => setOpen(false)} size="sm" title="Setor uang laci ke owner" subtitle={`Saldo ${laci.nama} saat ini ${rp(laci.saldo)}`}
        footer={<><button className="btn" onClick={() => setOpen(false)}>Batal</button><button id="st-kirim" className="btn btn-primary" disabled={!n || !pw || kirim.isPending} onClick={() => kirim.mutate()}><Send size={15} />Kirim {n ? rp(n) : ''}</button></>}>
        <div className="flex flex-col gap-3">
          <Field label="Jumlah disetor (Rp)"><input id="st-nominal" className="input num text-right text-xl font-bold" inputMode="numeric" autoFocus value={nominal ? nf(n) : ''} onChange={(e) => setNominal(e.target.value)} /></Field>
          {n > 0 && n !== laci.saldo && <p className={`-mt-1 text-xs ${n > laci.saldo ? 'font-semibold text-bad' : 'text-muted'}`}>{n > laci.saldo ? `Lebih ${rp(n - laci.saldo)} dari saldo laci di sistem.` : `Sisa di laci setelah setor: ${rp(laci.saldo - n)}.`}</p>}
          <Field label="Catatan (opsional)"><input id="st-catatan" className="input" placeholder="mis. sisa 300rb untuk modal besok" value={catatan} onChange={(e) => setCatatan(e.target.value)} /></Field>
          <Pw id="st-password" value={pw} onChange={setPw} />
          <p className="rounded-lg bg-sunk px-3 py-2 text-xs text-muted">Setoran berstatus <b className="text-ink">Menunggu</b> sampai owner menerima. Saldo laci baru berkurang setelah diterima.</p>
          <ErrorBox error={kirim.error} />
        </div>
      </Modal>
    </>
  );
}

export function DecideModal({ s, terima, onClose }: { s: Pick<Setoran, 'id' | 'kasir_nama' | 'nominal' | 'tanggal'>; terima: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [cat, setCat] = useState('');
  const [pw, setPw] = useState('');
  const m = useMutation({
    mutationFn: () => api('setoran.decide', { id: s.id, terima, catatan: cat, password: pw }),
    onSuccess: () => { INVALIDATE.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast(terima ? `Setoran ${s.kasir_nama} ${rp(s.nominal)} diterima` : 'Setoran ditolak'); onClose(); },
  });
  return (
    <Modal open onClose={onClose} size="sm" title={terima ? 'Terima setoran?' : 'Tolak setoran?'} subtitle={`${s.kasir_nama} · ${rp(s.nominal)} · ${tgl(s.tanggal)}`}
      footer={<><button className="btn" onClick={onClose}>Batal</button>
        <button id="st-decide-ok" className={`btn ${terima ? 'border-green-700 bg-green-700 text-white' : 'btn-danger'}`} disabled={!pw || (!terima && !cat.trim()) || m.isPending} onClick={() => m.mutate()}>{terima ? <><Check size={15} />Terima, uang sudah saya pegang</> : <><X size={15} />Tolak</>}</button></>}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">{terima ? <>Saldo <b className="text-ink">laci {s.kasir_nama}</b> berkurang {rp(s.nominal)} dan <b className="text-ink">Kas owner</b> bertambah {rp(s.nominal)}.</> : 'Saldo laci tidak berubah. Kasir bisa mengirim ulang setoran yang benar.'}</p>
        <Field label={terima ? 'Catatan (opsional)' : 'Alasan penolakan (wajib)'}><input id="st-decide-cat" className="input" placeholder={terima ? 'mis. uang pas' : 'mis. uang kurang 50rb, hitung ulang'} value={cat} onChange={(e) => setCat(e.target.value)} /></Field>
        <Pw id="st-decide-pw" value={pw} onChange={setPw} />
        <ErrorBox error={m.error} />
      </div>
    </Modal>
  );
}

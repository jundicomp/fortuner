import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, KeyRound, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/table/DataTable';
import { ErrorBox, Field, PageHeader } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { nf, rp, tgl, tglJam, ymd } from '@/lib/format';
import { Money } from '@/components/ui/Money';
import { KasCards, useKasSaldo, type KasSaldo } from '@/components/SumberKas';
import { CekModal, type CekTarget } from '@/components/CekModal';
import { SetoranTab, useSetoran } from './SetoranTab';

interface RekapRow { kasir_id: string; kasir_nama: string; method_id: string; method_nama: string; jenis: string; sistem: number; transaksi: number; aktual: number | null; selisih: number | null; keterangan: string; dicatat_oleh: string; dicatat_at: string }
interface Rekap { tanggal: string; kas_kecil_keluar: number; rows: RekapRow[] }
interface PcRow { id: string; tanggal: string; item: string; masuk: number; keluar: number; saldo: number; keterangan: string; oleh: string; created_at: string; sumber?: string; ref_tabel?: string; perlu_cek?: boolean; cek_status?: string; cek_catatan?: string; cek_oleh_nama?: string }
const numIn = (s: string) => Number(String(s).replace(/[^\d]/g, '')) || 0;

/** Pengganti sheet "Rekap" (bagian kasir & setor) dan "Kas Kecil". */
export function KasPage() {
  const [tab, setTab] = useState<'tutup' | 'setoran' | 'kecil'>('tutup');
  const st = useSetoran();
  const nPending = (st.data?.rows || []).filter((r) => r.status === 'menunggu').length;
  return (
    <>
      <PageHeader title="Kas" desc="Tutup kasir harian: cocokkan uang di laci dengan sistem dan mutasi bank. Kas kecil: catat uang keluar-masuk untuk keperluan harian." />
      <KasCards className="mb-4" />
      <div className="mb-4 flex gap-2">
        {([['tutup', 'Tutup kasir'], ['setoran', 'Setoran ke owner'], ['kecil', 'Kas kecil']] as const).map(([k, l]) => (
          <button key={k} id={`kas-tab-${k}`} className={`chip ${tab === k ? 'border-ink bg-ink text-canvas' : 'hover:border-muted'}`} onClick={() => setTab(k)}>{l}{k === 'setoran' && nPending > 0 && <span className="ml-1.5 rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">{nPending}</span>}</button>
        ))}
      </div>
      {tab === 'tutup' ? <TutupKasir /> : tab === 'setoran' ? <SetoranTab /> : <KasKecil />}
    </>
  );
}

function TutupKasir() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [tanggal, setTanggal] = useState(ymd());
  const q = useQuery({ queryKey: ['kas-rekap', tanggal], queryFn: () => api<Rekap>('kas.rekap', { tanggal }) });
  const [draft, setDraft] = useState<Record<string, { aktual: string; keterangan: string }>>({});
  const key = (r: RekapRow) => `${r.kasir_id}|${r.method_id}`;
  useEffect(() => {
    const d: Record<string, { aktual: string; keterangan: string }> = {};
    (q.data?.rows || []).forEach((r) => (d[key(r)] = { aktual: r.aktual == null ? '' : String(r.aktual), keterangan: r.keterangan || '' }));
    setDraft(d);
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => api('kas.setor', { tanggal, rows: (q.data?.rows || []).map((r) => ({ kasir_id: r.kasir_id, method_id: r.method_id, aktual: draft[key(r)]?.aktual === '' ? null : numIn(draft[key(r)]?.aktual || ''), keterangan: draft[key(r)]?.keterangan })) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kas-rekap'] }); toast('Tutup kasir disimpan'); },
  });
  const rows = q.data?.rows || [];
  const totSistem = rows.reduce((a, r) => a + r.sistem, 0);
  const tunai = rows.filter((r) => r.jenis === 'tunai').reduce((a, r) => a + r.sistem, 0);
  const nonTunai = totSistem - tunai;
  const totSelisih = rows.reduce((a, r) => { const v = draft[key(r)]?.aktual; return v === '' || v == null ? a : a + numIn(v) - r.sistem; }, 0);
  const filled = rows.filter((r) => (draft[key(r)]?.aktual ?? '') !== '').length;
  const editable = can('kas', 'ubah');

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <section className="card p-4"><Field label="Tanggal"><input id="kas-tanggal" type="date" className="input" value={tanggal} max={ymd()} onChange={(e) => e.target.value && setTanggal(e.target.value)} /></Field></section>
        <Tile tint="orange" label="Uang masuk (sistem)" value={rp(totSistem)} sub={`${rows.reduce((a, r) => a + r.transaksi, 0)} transaksi`} />
        <Tile tint="green" label="Tunai" value={rp(tunai)} sub={q.data?.kas_kecil_keluar ? `Kas kecil keluar hari ini ${rp(q.data.kas_kecil_keluar)}` : 'Tidak ada kas kecil keluar'} />
        <Tile tint="blue" label="Transfer & EDC" value={rp(nonTunai)} sub="Cocokkan dengan mutasi bank" />
        <Tile tint="purple" label="Selisih" value={filled ? (totSelisih === 0 ? 'Cocok' : rp(totSelisih)) : '–'} sub={`${filled}/${rows.length} baris dicocokkan`} tone={!filled ? '' : totSelisih === 0 ? 'text-ok' : 'text-bad'} />
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tbl w-full min-w-[760px] text-[13px]">
            <thead><tr className="bg-sunk text-[11px] uppercase tracking-wider text-muted">
              <th className="px-3 py-2.5 text-left">Kasir</th><th className="px-3 py-2.5 text-left">Metode</th><th className="px-3 py-2.5 text-right">Trx</th><th className="px-3 py-2.5 text-right">Sistem</th>
              <th className="px-3 py-2.5 text-right">Aktual</th><th className="px-3 py-2.5 text-right">Selisih</th><th className="px-3 py-2.5 text-left">Keterangan</th>
            </tr></thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted">Memuat…</td></tr>}
              {!q.isLoading && !rows.length && <tr><td colSpan={7} className="p-8 text-center text-muted">Tidak ada pembayaran pada {tgl(tanggal)}.</td></tr>}
              {rows.map((r) => {
                const d = draft[key(r)] || { aktual: '', keterangan: '' };
                const sel = d.aktual === '' ? null : numIn(d.aktual) - r.sistem;
                return (
                  <tr key={key(r)} className="border-t border-line align-top">
                    <td className="px-3 py-2.5 font-semibold">{r.kasir_nama}</td>
                    <td className="px-3 py-2.5">{r.method_nama}<div className="text-[11px] text-muted">{r.jenis === 'tunai' ? 'hitung uang fisik' : 'cek mutasi bank'}</div></td>
                    <td className="num px-3 py-2.5 text-right">{r.transaksi}</td>
                    <td className="num px-3 py-2.5 text-right font-semibold"><Money v={r.sistem} /></td>
                    <td className="px-3 py-2"><input aria-label={`Aktual ${r.kasir_nama} ${r.method_nama}`} className="input num w-36 text-right" inputMode="numeric" disabled={!editable} placeholder={nf(r.sistem)}
                      value={d.aktual === '' ? '' : nf(numIn(d.aktual))} onChange={(e) => setDraft({ ...draft, [key(r)]: { ...d, aktual: e.target.value.replace(/\D/g, '') } })} /></td>
                    <td className="num px-3 py-2.5 text-right">{sel == null ? <span className="text-muted/60">–</span> : sel === 0 ? <span className="pill pill-ok">Cocok</span> : <b className="text-bad"><Money>{sel > 0 ? '+' : ''}{nf(sel)}</Money></b>}</td>
                    <td className="px-3 py-2"><input aria-label={`Keterangan ${r.kasir_nama} ${r.method_nama}`} className="input" disabled={!editable} placeholder={sel ? 'wajib bila ada selisih' : ''}
                      value={d.keterangan} onChange={(e) => setDraft({ ...draft, [key(r)]: { ...d, keterangan: e.target.value } })} />
                      {r.dicatat_oleh && <div className="mt-1 text-[11px] text-muted">dicatat {r.dicatat_oleh} · {tglJam(r.dicatat_at)}</div>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {editable && rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line p-3">
            <ErrorBox error={save.error} />
            <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate()}><Save size={15} />Simpan tutup kasir</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, sub, tone = '', tint = 'blue' }: { label: string; value: string; sub?: string; tone?: string; tint?: string }) {
  return (
    <section className={`card tint tint-${tint} p-4`}>
      <div className="text-xs font-bold uppercase tracking-wider text-muted">{label}</div>
      <div className={`num mt-1.5 text-xl font-extrabold ${tone}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </section>
  );
}

function KasKecil() {
  const { can, user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['kas-kecil'], queryFn: () => api<{ saldo: number; rows: PcRow[] }>('pettycash.list', {}) });
  const ks = useKasSaldo();
  const kk = ks.data?.find((a) => a.jenis === 'kas_kecil');
  const laciSaya = ks.data?.find((a) => a.jenis === 'laci' && a.user_id === String(user?.id || ''));
  const plafon = kk?.plafon || 0;
  const [isiLaci, setIsiLaci] = useState(false);
  const [isiPlafon, setIsiPlafon] = useState(false);
  const [cek, setCek] = useState<CekTarget | null>(null);
  const [form, setForm] = useState<{ tanggal: string; item: string; jenis: 'keluar' | 'masuk'; nominal: string; keterangan: string } | null>(null);
  const [del, setDel] = useState<PcRow | null>(null);
  const [alasan, setAlasan] = useState('');
  const add = useMutation({
    mutationFn: () => api('pettycash.save', { row: { tanggal: form!.tanggal, item: form!.item, keterangan: form!.keterangan, masuk: form!.jenis === 'masuk' ? numIn(form!.nominal) : 0, keluar: form!.jenis === 'keluar' ? numIn(form!.nominal) : 0 } }),
    onSuccess: () => { ['kas-kecil', 'kas-rekap', 'kas-saldo', 'riwayat', 'notif'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast('Kas kecil dicatat'); setForm(null); },
  });
  const remove = useMutation({
    mutationFn: () => api('pettycash.delete', { id: del!.id, alasan }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kas-kecil'] }); toast('Transaksi dihapus'); setDel(null); setAlasan(''); },
  });
  const rows = q.data?.rows || [];
  const saldo = q.data?.saldo ?? kk?.saldo ?? 0;
  const bulanIni = ymd().slice(0, 7);
  const keluarBulan = rows.filter((r) => r.tanggal.startsWith(bulanIni)).reduce((a, r) => a + r.keluar, 0);
  const cols: ColumnDef<PcRow, any>[] = [
    { accessorKey: 'tanggal', header: 'Tanggal', cell: (c) => <span className="num whitespace-nowrap">{tgl(c.getValue())}</span> },
    { accessorKey: 'item', header: 'Keterangan', cell: (c) => <span className="font-semibold">{c.getValue()}{c.row.original.keterangan && <span className="block text-xs font-normal text-muted">{c.row.original.keterangan}</span>}</span> },
    { accessorKey: 'masuk', header: 'Masuk', meta: { align: 'right', total: true, money: true }, cell: (c) => (c.getValue() ? <span className="text-ok">{nf(c.getValue())}</span> : '') },
    { accessorKey: 'keluar', header: 'Keluar', meta: { align: 'right', total: true, money: true }, cell: (c) => (c.getValue() ? <span className="text-bad">{nf(c.getValue())}</span> : '') },
    { accessorKey: 'saldo', header: 'Saldo', meta: { money: true, align: 'right' }, cell: (c) => <b>{nf(c.getValue())}</b> },
    { accessorKey: 'oleh', header: 'Dicatat', meta: { filter: 'select', hideOnCard: true } },
    { id: 'cek', accessorFn: (r) => (!r.perlu_cek ? '' : r.cek_status || 'perlu'), header: 'Cek owner', meta: { filter: 'select', filterLabel: (v: unknown) => ({ '': '–', perlu: 'Perlu dicek', sesuai: 'Sesuai', bermasalah: 'Bermasalah' } as Record<string, string>)[String(v)] || String(v) },
      cell: (c) => {
        const r = c.row.original;
        if (!r.perlu_cek) return <span className="text-muted">–</span>;
        if (r.cek_status) return <span className={`pill ${r.cek_status === 'sesuai' ? 'pill-ok' : 'pill-bad'}`} title={r.cek_catatan || ''}>{r.cek_status === 'sesuai' ? 'Sesuai' : 'Bermasalah'}{r.cek_oleh_nama ? ` · ${r.cek_oleh_nama}` : ''}</span>;
        if (!can('pindah_dana', 'ubah')) return <span className="pill pill-warn">Perlu dicek</span>;
        const t = { tabel: r.ref_tabel || 'petty_cash', id: r.id, judul: r.item, nominal: r.keluar || r.masuk };
        return <span className="flex gap-1"><button className="btn btn-sm px-2 text-xs" onClick={() => setCek({ ...t, status: 'sesuai' })}>Sesuai</button><button className="btn btn-sm px-2 text-xs text-bad" onClick={() => setCek({ ...t, status: 'bermasalah' })}>Bermasalah</button></span>;
      } },
    ...(can('kas', 'hapus') ? [{ id: 'aksi', header: '', enableSorting: false, meta: { noExport: true, hideOnCard: true }, cell: (c: { row: { original: PcRow } }) => c.row.original.sumber ? null : <button className="btn btn-ghost btn-sm px-1.5 text-bad" aria-label="Hapus" onClick={(e) => { e.stopPropagation(); setDel(c.row.original); }}><Trash2 size={14} /></button> } as ColumnDef<PcRow, any>] : []),
  ];
  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-wrap items-center gap-4 p-4">
        <div className="min-w-[240px] flex-1">
          <div className="flex items-baseline justify-between gap-2"><b>Kas kecil · uang tunai bersama</b><span className="text-xs text-muted">keluar bulan ini {rp(keluarBulan)}</span></div>
          <div className="mt-1 flex items-baseline gap-1.5"><span className={`num text-2xl font-extrabold ${saldo < plafon * 0.25 ? 'text-bad' : ''}`}>{q.isLoading ? '…' : rp(saldo)}</span>{plafon > 0 && <span className="text-sm text-muted">/ plafon {rp(plafon)}</span>}</div>
          {plafon > 0 && <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunk"><div className={`h-full rounded-full ${saldo < plafon * 0.25 ? 'bg-bad' : 'bg-amber-500'}`} style={{ width: `${Math.max(0, Math.min(100, (saldo / plafon) * 100))}%` }} /></div>}
          {plafon > 0 && saldo < plafon * 0.25 && <p className="mt-1 text-xs font-semibold text-bad">Menipis — minta isi ulang ke owner{laciSaya ? ', atau isi dari laci Anda' : ''}.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {can('kas', 'tambah') && <button id="kk-keluar" className="btn btn-primary" onClick={() => { add.reset(); setForm({ tanggal: ymd(), item: '', jenis: 'keluar', nominal: '', keterangan: '' }); }}><ArrowUpRight size={16} />Uang keluar</button>}
          {can('kas', 'tambah') && laciSaya && <button id="kk-isi-laci" className="btn" onClick={() => setIsiLaci(true)}><ArrowDownLeft size={16} />Isi dari laci saya</button>}
          {can('pindah_dana', 'tambah') && <button id="kk-isi-plafon" className="btn" disabled={plafon <= saldo} onClick={() => setIsiPlafon(true)}><RefreshCw size={15} />Isi ulang sampai plafon</button>}
        </div>
      </section>
      <DataTable<PcRow> data={rows} loading={q.isLoading} columns={cols} title="Kas_kecil" storageKey="kas-kecil" dateField="tanggal" initialSort={[{ id: 'tanggal', desc: true }]}
        canExport={can('kas', 'ekspor')} searchPlaceholder="Cari keterangan…" emptyText="Belum ada transaksi kas kecil." />

      <Modal open={!!form} onClose={() => setForm(null)} size="sm" title={form?.jenis === 'masuk' ? 'Uang masuk ke kas kecil' : 'Uang keluar dari kas kecil'}
        footer={<><button className="btn" onClick={() => setForm(null)}>Batal</button><button className="btn btn-primary" disabled={add.isPending || !form?.item || !numIn(form?.nominal || '')} onClick={() => add.mutate()}><Plus size={15} />Catat</button></>}>
        {form && (
          <div className="flex flex-col gap-3">
            <Field label="Tanggal"><input id="kk-tanggal" type="date" className="input" max={ymd()} value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} /></Field>
            <Field label="Untuk apa"><input id="kk-item" className="input" autoFocus value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} placeholder={form.jenis === 'masuk' ? 'mis. isi ulang dari owner' : 'mis. galon, parkir kurir'} /></Field>
            <Field label="Nominal"><input id="kk-nominal" className="input num text-right text-lg" inputMode="numeric" value={form.nominal ? nf(numIn(form.nominal)) : ''} onChange={(e) => setForm({ ...form, nominal: e.target.value })} /></Field>
            <Field label="Catatan (opsional)"><input id="kk-ket" className="input" value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} /></Field>
            <ErrorBox error={add.error} />
          </div>
        )}
      </Modal>
      {isiLaci && laciSaya && <IsiDariLaci laci={laciSaya} kk={saldo} onClose={() => setIsiLaci(false)} />}
      {isiPlafon && <IsiPlafon saldo={saldo} plafon={plafon} onClose={() => setIsiPlafon(false)} />}
      {cek && <CekModal t={cek} onClose={() => setCek(null)} />}
      <Modal open={!!del} onClose={() => setDel(null)} size="sm" title="Hapus transaksi kas kecil?" subtitle={del ? `${del.item} · ${rp(del.masuk || del.keluar)} · ${tgl(del.tanggal)}` : undefined}
        footer={<><button className="btn" onClick={() => setDel(null)}>Batal</button><button className="btn btn-danger" disabled={!alasan.trim() || remove.isPending} onClick={() => remove.mutate()}>Hapus</button></>}>
        <Field label="Alasan (tercatat di log)"><input id="kk-alasan" className="input" value={alasan} onChange={(e) => setAlasan(e.target.value)} /></Field>
        <div className="mt-3"><ErrorBox error={remove.error} /></div>
      </Modal>
    </div>
  );
}

function PwField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Password Anda (verifikasi)">
      <div className="relative"><KeyRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input id={id} type="password" autoComplete="current-password" className="input pl-9" placeholder="Masukkan password login" value={value} onChange={(e) => onChange(e.target.value)} /></div>
    </Field>
  );
}
const KK_INVALIDATE = ['kas-kecil', 'kas-saldo', 'riwayat', 'notif', 'fund', 'kas-rekap'];

/** Kasir mengisi kas kecil dari lacinya sendiri (langsung berlaku, owner mengecek sesudahnya). */
function IsiDariLaci({ laci, kk, onClose }: { laci: KasSaldo; kk: number; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [nominal, setNominal] = useState('');
  const [ket, setKet] = useState('');
  const [pw, setPw] = useState('');
  const n = numIn(nominal);
  const m = useMutation({
    mutationFn: () => api('kaskecil.isi_laci', { nominal: n, keterangan: ket, password: pw }),
    onSuccess: () => { KK_INVALIDATE.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast(`Kas kecil diisi ${rp(n)} dari ${laci.nama}`); onClose(); },
  });
  const kurang = n > laci.saldo;
  return (
    <Modal open onClose={onClose} size="sm" title="Isi kas kecil dari laci saya" subtitle={`${laci.nama} ${rp(laci.saldo)} → Kas kecil ${rp(kk)}`}
      footer={<><button className="btn" onClick={onClose}>Batal</button><button id="il-ok" className="btn btn-primary" disabled={!n || kurang || !ket.trim() || !pw || m.isPending} onClick={() => m.mutate()}>Isi kas kecil {n ? rp(n) : ''}</button></>}>
      <div className="flex flex-col gap-3">
        <div>
          <Field label="Jumlah (Rp)"><input id="il-nominal" className="input num text-right text-xl font-bold" inputMode="numeric" autoFocus placeholder="0" value={nominal ? nf(n) : ''} onChange={(e) => setNominal(e.target.value)} /></Field>
          {n > 0 && <div className={`mt-1 flex justify-between text-xs ${kurang ? 'font-semibold text-bad' : 'text-muted'}`}><span>{laci.nama} setelah ini</span><b className="num">{kurang ? 'saldo laci tidak cukup' : rp(laci.saldo - n)}</b></div>}
        </div>
        <Field label="Untuk keperluan apa (wajib)"><input id="il-ket" className="input" placeholder="mis. servis mesin, owner tidak di tempat" value={ket} onChange={(e) => setKet(e.target.value)} /></Field>
        <PwField id="il-pw" value={pw} onChange={setPw} />
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">Langsung berlaku: uang dipindah sekarang. Owner &amp; keuangan mendapat notifikasi dan akan mengecek.</p>
        <ErrorBox error={m.error} />
      </div>
    </Modal>
  );
}

/** Owner mengisi kas kecil kembali penuh sesuai plafon, dari Kas owner. */
function IsiPlafon({ saldo, plafon, onClose }: { saldo: number; plafon: number; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const n = Math.max(0, plafon - saldo);
  const m = useMutation({
    mutationFn: () => api('kaskecil.isi_plafon', { password: pw }),
    onSuccess: () => { KK_INVALIDATE.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast(`Kas kecil diisi ${rp(n)}, kembali ${rp(plafon)}`); onClose(); },
  });
  return (
    <Modal open onClose={onClose} size="sm" title="Isi ulang kas kecil sampai plafon" subtitle={`Dari Kas owner · plafon ${rp(plafon)}`}
      footer={<><button className="btn" onClick={onClose}>Batal</button><button id="ip-ok" className="btn btn-primary" disabled={!pw || !n || m.isPending} onClick={() => m.mutate()}>Isi {rp(n)}</button></>}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-lg bg-sunk p-2"><div className="text-[11px] text-muted">Saldo sekarang</div><b className="num">{rp(saldo)}</b></div>
          <div className="rounded-lg bg-brand/10 p-2"><div className="text-[11px] text-muted">Diisi</div><b className="num text-brand">{rp(n)}</b></div>
          <div className="rounded-lg bg-sunk p-2"><div className="text-[11px] text-muted">Jadi</div><b className="num">{rp(plafon)}</b></div>
        </div>
        <p className="text-xs text-muted">Siapkan uang tunai sebesar {rp(n)} dari Kas owner, cocokkan dengan struk belanja kasir, lalu masukkan ke amplop kas kecil.</p>
        <PwField id="ip-pw" value={pw} onChange={setPw} />
        <ErrorBox error={m.error} />
      </div>
    </Modal>
  );
}

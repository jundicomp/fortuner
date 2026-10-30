import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Plus } from 'lucide-react';
import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/table/DataTable';
import { DateRangeFilter, rangeFor, type DateRange } from '@/components/table/DateRangeFilter';
import { ErrorBox, PageHeader } from '@/components/ui/Field';
import { DepositCairModal, DepositMutasi, DepositTopupModal, type DepCard } from '@/components/Deposit';
import { RefundDecideModal, RefundPayModal, RF_STATUS, type RefundRow } from '@/components/Pembatalan';
import { CustomerCard } from '@/components/CustomerCard';
import { useAuth } from '@/auth/AuthContext';
import { useSettings } from '@/lib/queries';
import { api } from '@/lib/api';
import { nf, rp, tgl, tglJam } from '@/lib/format';

interface Sum {
  ringkas: { total: number; konsumen: number; masuk: number; topup: number; dari_batal: number; lebih_bayar: number; dipakai: number; dipakai_nota: number; dicairkan: number; dicairkan_n: number; buku_besar: number; cocok: boolean; selisih: number };
  konsumen: { customer_id: string; nama: string; kode: string; tipe: string; percetakan: string; saldo: number; ditahan: number; terakhir: string; jenis_terakhir: string; umur: number }[];
  bisa_topup: boolean; bisa_cair: boolean; pilihan: { id: string; nama: string; kode: string; percetakan?: string }[];
}
type KRow = Sum['konsumen'][number];
const JN: Record<string, string> = { topup: 'top-up', pembatalan: 'pembatalan', lebih_bayar: 'lebih bayar', pakai: 'bayar nota', cair: 'dicairkan' };

/** Deposit konsumen: total utang toko ke konsumen, saldo per konsumen dengan umur, kartu deposit, dan antrian refund. */
export function DepositPage() {
  const { can } = useAuth();
  const settings = useSettings();
  const [range, setRange] = useState<DateRange>(rangeFor('bulan_ini'));
  const [umur90, setUmur90] = useState(false);
  const [sel, setSel] = useState('');
  const [topup, setTopup] = useState(false);
  const [cair, setCair] = useState(false);
  const [profil, setProfil] = useState('');
  const [pay, setPay] = useState<RefundRow | null>(null);
  const [dec, setDec] = useState<RefundRow | null>(null);
  const q = useQuery({ queryKey: ['deposit', 'summary', range.from, range.to], queryFn: () => api<Sum>('deposit.summary', { from: range.from, to: range.to }) });
  const rf = useQuery({ queryKey: ['refunds', 'open'], queryFn: async () => (await api<RefundRow[]>('refund.list', {})).filter((r) => r.status === 'menunggu' || r.status === 'siap') });
  const card = useQuery({ queryKey: ['deposit', 'card', sel], enabled: !!sel, queryFn: () => api<DepCard>('deposit.card', { customer_id: sel }) });
  const d = q.data, r = d?.ringkas;
  const rows = (d?.konsumen || []).filter((k) => !umur90 || k.umur > 90);
  const cols: ColumnDef<KRow, any>[] = [
    { accessorKey: 'nama', header: 'Konsumen', cell: (c) => <span><b>{c.getValue()}</b> <span className="text-xs text-muted">#{c.row.original.kode}</span>{c.row.original.percetakan && <span className="block text-xs text-muted">{c.row.original.percetakan}</span>}</span> },
    { accessorKey: 'tipe', header: 'Jenis', meta: { filter: 'select', filterLabel: (v: unknown) => (v === 'reseller' ? '01 · Percetakan' : '02 · End user') }, cell: (c) => <span className={`pill ${c.getValue() === 'reseller' ? 'pill-brand' : 'pill-mute'}`}>{c.getValue() === 'reseller' ? '01 · Percetakan' : '02 · End user'}</span> },
    { accessorKey: 'saldo', header: 'Saldo', meta: { align: 'right', money: true, total: true }, cell: (c) => <span><b>{nf(c.getValue())}</b>{c.row.original.ditahan > 0 && <span className="block text-xs text-warn">{nf(c.row.original.ditahan)} dicairkan</span>}</span> },
    { accessorKey: 'terakhir', header: 'Mutasi terakhir', cell: (c) => `${tgl(c.getValue())} · ${JN[c.row.original.jenis_terakhir] || c.row.original.jenis_terakhir}` },
    { accessorKey: 'umur', header: 'Umur', meta: { align: 'right' }, cell: (c) => <span className={`pill ${c.getValue() > 90 ? 'pill-bad' : c.getValue() > 30 ? 'pill-warn' : 'pill-ok'}`}>{c.getValue()} hari</span> },
  ];
  const selRow = d?.konsumen.find((k) => k.customer_id === sel);
  const open = rf.data || [];
  return (
    <>
      <PageHeader title="Deposit Konsumen" desc="Saldo titipan konsumen di toko. Bukan omzet: tercatat sebagai utang toko ke konsumen (akun 2150) sampai dipakai bayar nota atau dicairkan."
        actions={<div className="flex flex-wrap gap-2"><DateRangeFilter value={range} onChange={setRange} id="dep-range" />{d?.bisa_topup && <button id="dep-tambah" className="btn btn-primary" onClick={() => setTopup(true)}><Plus size={16} />Tambah deposit</button>}</div>} />
      <ErrorBox error={q.error} />
      {r && (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="card bg-ink p-4 text-canvas"><div className="text-xs font-bold uppercase tracking-wider opacity-70">Total saldo deposit</div><div className="num mt-1.5 text-2xl font-extrabold">{rp(r.total)}</div><div className="mt-0.5 text-xs opacity-70">utang toko ke {r.konsumen} konsumen</div></div>
            <K t="green" l="Masuk periode ini" v={rp(r.masuk)} s={`top-up ${nf(r.topup)} · batal ${nf(r.dari_batal)} · lebih bayar ${nf(r.lebih_bayar)}`} />
            <K t="orange" l="Dipakai bayar nota" v={rp(r.dipakai)} s={`${r.dipakai_nota} pembayaran`} />
            <K t="rose" l="Dicairkan" v={rp(r.dicairkan)} s={`${r.dicairkan_n} refund · disetujui owner`} />
          </div>
          <div className={`mb-4 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm ${r.cocok ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad'}`}>
            {r.cocok ? <CheckCircle2 size={17} className="mt-0.5 shrink-0" /> : <AlertTriangle size={17} className="mt-0.5 shrink-0" />}
            <span>{r.cocok ? <><b>Cocok dengan Buku Besar.</b> Jumlah saldo semua konsumen = saldo akun 2150 Uang muka konsumen ({rp(r.buku_besar)}).</> : <><b>Tidak cocok dengan Buku Besar.</b> Saldo konsumen {rp(r.total)}, akun 2150 {rp(r.buku_besar)} (selisih {rp(r.selisih)}). Periksa jurnal manual pada akun 2150.</>}</span>
          </div>
        </>
      )}
      {open.length > 0 && (
        <section className="card mb-4 overflow-hidden border-amber-300">
          <h3 className="border-b border-line bg-amber-50/60 px-4 py-2.5 text-sm font-bold dark:bg-amber-500/10">Refund & pencairan yang perlu ditindaklanjuti · {open.length}</h3>
          <ul className="divide-y divide-line">{open.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
              <span className="font-mono text-xs">{x.nomor}</span><span className={`pill ${RF_STATUS[x.status]?.[1]}`}>{RF_STATUS[x.status]?.[0]}</span>
              <span><b>{x.customer_nama}</b> <span className="text-xs text-muted">· {x.sumber === 'deposit' ? 'pencairan deposit' : `pembatalan ${x.order_nomor}`} · {x.cara} · diajukan {x.diajukan_nama} {tglJam(x.created_at)}</span></span>
              <b className="num ml-auto">{rp(x.nominal)}</b>
              {x.bisa_putuskan && <button className="btn btn-sm btn-primary" onClick={() => setDec(x)}>Periksa</button>}
              {x.bisa_bayar && <button id={`rf-pay-${x.id}`} className="btn btn-sm btn-primary" onClick={() => setPay(x)}>Bayar</button>}
            </li>
          ))}</ul>
        </section>
      )}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_1fr]">
        <DataTable<KRow> data={rows} loading={q.isLoading} columns={cols} title="Saldo deposit per konsumen" storageKey="deposit" canExport={can('deposit', 'ekspor')} onRowClick={(k) => setSel(k.customer_id)}
          toolbar={<button className={`btn ${umur90 ? 'btn-primary' : ''}`} onClick={() => setUmur90(!umur90)}>Tidak dipakai &gt; 90 hari</button>} searchPlaceholder="Cari konsumen…" emptyText="Belum ada konsumen dengan saldo deposit."
          cardTitle={(k) => <span className="flex justify-between gap-2"><span>{k.nama}</span><span className="num">{rp(k.saldo)}</span></span>} />
        <section className="card p-4">
          {!sel ? <p className="text-sm text-muted">Klik salah satu konsumen untuk melihat kartu deposit (rekening koran).</p> : card.data && (
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2"><div><h3 className="font-bold">Kartu deposit · {card.data.customer?.nama}</h3><p className="text-xs text-muted">#{card.data.customer?.kode} · saldo saat ini</p></div><b className="num text-lg text-brand">{rp(card.data.saldo)}</b></div>
              <DepositMutasi card={card.data} toko={settings.data?.nama_usaha || 'Fortuner'} />
              <div className="flex flex-wrap gap-2">
                {can('master.konsumen') && <button className="btn btn-sm" onClick={() => setProfil(sel)}>Buka kartu konsumen</button>}
                {d?.bisa_cair && card.data.bebas > 0 && <button id="dep-cair" className="btn btn-sm text-bad" onClick={() => setCair(true)}>Cairkan</button>}
              </div>
            </div>
          )}
        </section>
      </div>
      {topup && <DepositTopupModal customers={d?.pilihan} onClose={() => setTopup(false)} />}
      {cair && selRow && card.data && <DepositCairModal customer={{ id: sel, nama: selRow.nama }} saldo={card.data.bebas} onClose={() => setCair(false)} />}
      {profil && <CustomerCard id={profil} onClose={() => setProfil('')} />}
      {pay && <RefundPayModal r={pay} onClose={() => setPay(null)} />}
      {dec && <RefundDecideModal r={dec} onClose={() => setDec(null)} />}
    </>
  );
}

function K({ t, l, v, s }: { t: string; l: string; v: string; s: string }) {
  return <div className={`card tint tint-${t} p-4`}><div className="text-xs font-bold uppercase tracking-wider text-muted">{l}</div><div className="num mt-1.5 text-xl font-extrabold">{v}</div><div className="mt-0.5 text-xs text-muted">{s}</div></div>;
}

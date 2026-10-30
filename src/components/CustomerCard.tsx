import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Pencil, Plus, WalletCards } from 'lucide-react';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ErrorBox } from '@/components/ui/Field';
import { useAuth } from '@/auth/AuthContext';
import { CancelDecideModal, CN_STATUS } from '@/components/Pembatalan';
import { DepositCairModal, DepositMutasi, DepositTopupModal, waLink, type DepCard, type DepMove } from '@/components/Deposit';
import { OrderDetailModal, BAYAR } from '@/pages/order/OrderDetailModal';
import { useSettings } from '@/lib/queries';
import { api } from '@/lib/api';
import { nf, rp, tgl, tglJam } from '@/lib/format';
import type { Customer } from '@/types';

interface Profile {
  customer: Customer & { created_at?: string }; cs_terbanyak: string; pelanggan_sejak: string;
  kpi: { belanja: number; nota: number; rata_nota: number; peringkat: number | null; jumlah_konsumen: number; terakhir: string; hari_sejak: number | null; interval: number | null;
    piutang: number; piutang_nota: number; piutang_tertua: number; deposit: number; deposit_bebas: number; batal_dokumen: number; batal_nilai: number; batal_menunggu: number };
  status: Record<string, number>; aging: { a: number; an: number; b: number; bn: number; c: number; cn: number }; tahun: string; bulan: { cash: number; piutang: number; batal: number }[];
  produk: { nama: string; nilai: number; qty: number }[];
  kebiasaan: { hari: string[]; jam: string; lama_bayar: number | null; cara: Record<string, number> };
  orders: { id: string; nomor: string; tanggal: string; total: number; batal_nilai: number; terbayar: number; sisa: number; status_bayar: string; status_ambil: string; status_batal: string; ringkas: string; umur: number; deposit: boolean }[];
  payments: { id: string; tanggal: string; nominal: number; metode: string; kasir: string; nota: string }[];
  deposit: DepMove[];
  pembatalan: { id: string; nomor: string; status: string; tanggal: string; order_nomor: string; nilai_item: number; nilai_batal: number; alasan: string; diajukan_nama: string }[];
  timeline: { waktu: string; jenis: string; judul: string; detail: string }[];
}
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const CARA: Record<string, [string, string]> = { transfer: ['Transfer', '#2e6db4'], tunai: ['Tunai', '#22804a'], edc: ['EDC', '#7c5cc4'], deposit: ['Deposit', 'rgb(var(--brand))'], lain: ['Lain', '#999'] };
const TL: Record<string, string> = { bayar: 'text-ok', batal: 'text-bad', deposit: 'text-brand', cair: 'text-bad', data: 'text-muted' };
const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/** Kartu Konsumen: profil, ringkasan, grafik belanja, riwayat order, piutang, deposit, pembatalan, aktivitas. */
export function CustomerCard({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit?: (c: Customer) => void }) {
  const { can } = useAuth();
  const settings = useSettings();
  const q = useQuery({ queryKey: ['customer-profile', id], queryFn: () => api<Profile>('customer.profile', { customer_id: id }) });
  const [tab, setTab] = useState<'order' | 'piutang' | 'deposit' | 'batal' | 'bayar'>('order');
  const [order, setOrder] = useState('');
  const [cn, setCn] = useState('');
  const [topup, setTopup] = useState(false);
  const [cair, setCair] = useState(false);
  const p = q.data;
  const cu = p?.customer;
  const toko = settings.data?.nama_usaha || 'Fortuner';
  const maxBulan = Math.max(1, ...(p?.bulan || []).map((b) => b.cash + b.piutang));
  const caraTot = p ? Object.values(p.kebiasaan.cara).reduce((a, b) => a + b, 0) : 0;
  const card: DepCard | null = p && cu ? { customer: { id: cu.id, nama: cu.nama, kode: cu.kode, telp: cu.telp, percetakan: cu.percetakan || '', tipe: cu.tipe }, saldo: p.kpi.deposit, bebas: p.kpi.deposit_bebas, mutasi: p.deposit } : null;
  const piutangList = (p?.orders || []).filter((o) => o.sisa > 0);
  const tagihWa = p && cu && piutangList.length ? `Halo ${cu.nama}, berikut tagihan dari ${toko}:\n\n${piutangList.map((o) => `${o.nomor} (${tgl(o.tanggal)}): ${rp(o.sisa)}`).join('\n')}\n\n*Total: ${rp(p.kpi.piutang)}*\nTerima kasih.` : '';

  return (
    <Modal open onClose={onClose} size="xl" title={cu ? <>{cu.nama} <span className="font-mono text-sm font-normal text-muted">#{cu.kode}</span></> : 'Kartu konsumen'} subtitle={cu ? 'Kartu konsumen · semua data satu konsumen' : undefined}>
      {q.isLoading && <div className="h-80 animate-pulse rounded-xl bg-sunk" />}
      <ErrorBox error={q.error} />
      {p && cu && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_2fr]">
            <section className="relative overflow-hidden rounded-2xl bg-[#111] p-5 text-white">
              <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full" style={{ background: 'radial-gradient(circle, rgba(242,107,29,.5), rgba(242,107,29,0) 65%)' }} />
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#F26B1D] text-xl font-extrabold">{initials(cu.percetakan || cu.nama)}</div>
              <h3 className="mt-3 text-xl font-extrabold">{cu.nama}</h3>
              <div className="text-xs opacity-70">{[cu.percetakan, `#${cu.kode}`].filter(Boolean).join(' · ')}</div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold">
                <span className="rounded-full bg-[#F26B1D] px-2.5 py-1">{cu.tipe === 'reseller' ? '01 · Percetakan · harga reseller' : '02 · End user · harga end user'}</span>
                {p.kpi.peringkat && p.kpi.peringkat <= 5 && <span className="rounded-full bg-white/15 px-2.5 py-1">Top {p.kpi.peringkat} konsumen</span>}
                <span className="rounded-full bg-white/15 px-2.5 py-1">{cu.aktif ? 'Aktif' : 'Nonaktif'}</span>
              </div>
              <dl className="relative mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                <div><dt className="opacity-60">WhatsApp</dt><dd>{cu.telp || '–'}</dd></div>
                <div><dt className="opacity-60">Pelanggan sejak</dt><dd>{p.pelanggan_sejak ? tgl(p.pelanggan_sejak) : '–'}</dd></div>
                <div><dt className="opacity-60">Alamat</dt><dd>{cu.alamat || '–'}</dd></div>
                <div><dt className="opacity-60">Paling sering dilayani</dt><dd>{p.cs_terbanyak || '–'}</dd></div>
                {cu.catatan && <div className="col-span-2"><dt className="opacity-60">Catatan</dt><dd>{cu.catatan}</dd></div>}
              </dl>
              <div className="relative mt-4 flex flex-wrap gap-2">
                {cu.telp && cu.telp !== '-' && <a className="btn btn-sm border-white/20 bg-white/10 text-white" href={waLink(cu.telp, `Halo ${cu.nama}, `)} target="_blank" rel="noreferrer"><MessageCircle size={14} />WhatsApp</a>}
                {can('deposit', 'tambah') && <button className="btn btn-sm border-white/20 bg-white/10 text-white" onClick={() => setTopup(true)}><Plus size={14} />Deposit</button>}
                {onEdit && can('master.konsumen', 'ubah') && <button className="btn btn-sm border-white/20 bg-white/10 text-white" onClick={() => onEdit(cu)}><Pencil size={14} />Ubah</button>}
              </div>
            </section>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <Kpi t="orange" l="Total belanja" v={rp(p.kpi.belanja)} s={p.kpi.peringkat ? `peringkat #${p.kpi.peringkat} dari ${p.kpi.jumlah_konsumen} konsumen` : 'belum ada order'} />
                <Kpi t="blue" l="Jumlah order" v={`${nf(p.kpi.nota)} nota`} s={`rata-rata ${rp(p.kpi.rata_nota)} / nota`} />
                <Kpi t="purple" l="Order terakhir" v={p.kpi.hari_sejak == null ? '–' : p.kpi.hari_sejak === 0 ? 'Hari ini' : `${p.kpi.hari_sejak} hari lalu`} s={p.kpi.interval ? `biasanya order setiap ±${p.kpi.interval} hari` : p.kpi.terakhir ? tgl(p.kpi.terakhir) : ''} />
                <Kpi t="rose" l="Piutang berjalan" v={rp(p.kpi.piutang)} s={p.kpi.piutang_nota ? `${p.kpi.piutang_nota} nota · tertua ${p.kpi.piutang_tertua} hari` : 'tidak ada'} bad={p.kpi.piutang > 0} />
                <Kpi t="amber" l="Saldo deposit" v={rp(p.kpi.deposit)} s={p.kpi.deposit_bebas !== p.kpi.deposit ? `${rp(p.kpi.deposit - p.kpi.deposit_bebas)} sedang dicairkan` : 'bisa dipakai di order berikutnya'} brand />
                <Kpi t="green" l="Pembatalan" v={`${p.kpi.batal_dokumen} dokumen`} s={p.kpi.batal_dokumen ? `${rp(p.kpi.batal_nilai)}${p.kpi.belanja ? ` · ${((p.kpi.batal_nilai / (p.kpi.belanja + p.kpi.batal_nilai)) * 100).toFixed(1).replace('.', ',')}%` : ''}${p.kpi.batal_menunggu ? ` · ${p.kpi.batal_menunggu} menunggu` : ''}` : 'tidak ada'} />
              </div>
              <section className="card p-4">
                <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-muted"><span>Rekap {nf(p.kpi.nota)} nota</span><span className="normal-case tracking-normal">status bayar saat ini</span></div>
                <Bar parts={[[p.status.lunas || 0, 'bg-ok'], [p.status.dp || 0, 'bg-warn'], [p.status.belum || 0, 'bg-bad'], [p.status.batal || 0, 'bg-muted']]} />
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <Lg c="bg-ok" l="Lunas" n={p.status.lunas || 0} /><Lg c="bg-warn" l="DP" n={p.status.dp || 0} /><Lg c="bg-bad" l="Belum bayar" n={p.status.belum || 0} /><Lg c="bg-muted" l="Batal" n={p.status.batal || 0} />
                  <span className="ml-auto">Diambil <b className="text-ink">{p.orders.filter((o) => o.status_ambil === 'diambil').length}</b> · belum <b className="text-ink">{p.orders.filter((o) => o.status_ambil !== 'diambil' && o.status_batal !== 'penuh').length}</b></span>
                </div>
              </section>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.6fr_1fr_1fr]">
            <section className="card p-4">
              <div className="mb-3 flex items-center justify-between"><h4 className="text-sm font-bold">Belanja per bulan · {p.tahun}</h4><span className="flex gap-3 text-xs text-muted"><Lg c="bg-ok" l="Cash" /><Lg c="bg-bad" l="Piutang" /></span></div>
              <div className="flex h-36 items-end gap-1.5">
                {p.bulan.map((b, i) => (
                  <div key={i} className="flex flex-1 flex-col-reverse overflow-hidden rounded-t" style={{ height: `${((b.cash + b.piutang) / maxBulan) * 100}%` }} title={`${BLN[i]}: cash ${rp(b.cash)} · piutang ${rp(b.piutang)}${b.batal ? ` · batal ${rp(b.batal)}` : ''}`}>
                    <i className="block bg-ok" style={{ height: `${b.cash + b.piutang ? (b.cash / (b.cash + b.piutang)) * 100 : 0}%` }} /><i className="block bg-bad" style={{ height: `${b.cash + b.piutang ? (b.piutang / (b.cash + b.piutang)) * 100 : 0}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex gap-1.5">{BLN.map((m) => <span key={m} className="flex-1 text-center text-[10px] font-semibold text-muted">{m}</span>)}</div>
            </section>
            <section className="card p-4">
              <h4 className="mb-3 text-sm font-bold">Produk favorit</h4>
              {!p.produk.length ? <p className="text-sm text-muted">Belum ada.</p> : <ol className="flex flex-col gap-2.5">{p.produk.map((x) => (
                <li key={x.nama} className="text-[13px]"><div className="flex justify-between gap-2"><span className="truncate">{x.nama}</span><b className="num">{nf(x.nilai)}</b></div><div className="mt-1 h-1.5 rounded-full bg-sunk"><div className="h-full rounded-full bg-brand" style={{ width: `${(x.nilai / p.produk[0].nilai) * 100}%` }} /></div></li>
              ))}</ol>}
            </section>
            <section className="card flex flex-col gap-2.5 p-4 text-[13px]">
              <h4 className="text-sm font-bold">Kebiasaan</h4>
              <Row l="Hari paling sering order" v={p.kebiasaan.hari.join(' & ') || '–'} />
              <Row l="Jam ramai" v={p.kebiasaan.jam || '–'} />
              <Row l="Rata-rata lama bayar" v={p.kebiasaan.lama_bayar == null ? '–' : `${p.kebiasaan.lama_bayar} hari`} />
              <div><span className="text-muted">Cara bayar</span>
                <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-sunk">{Object.entries(p.kebiasaan.cara).map(([k, v]) => <i key={k} className="block" style={{ width: `${caraTot ? (v / caraTot) * 100 : 0}%`, background: CARA[k]?.[1] || '#999' }} />)}</div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">{Object.entries(p.kebiasaan.cara).map(([k, v]) => <span key={k} className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ background: CARA[k]?.[1] || '#999' }} />{CARA[k]?.[0] || k} {caraTot ? Math.round((v / caraTot) * 100) : 0}%</span>)}</div>
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.75fr_1fr]">
            <section className="card min-w-0">
              <div className="flex flex-wrap gap-1.5 border-b border-line p-3">
                {([['order', 'Riwayat order', p.orders.length], ['piutang', 'Piutang', piutangList.length], ['deposit', 'Deposit', p.deposit.length], ['batal', 'Pembatalan', p.pembatalan.length], ['bayar', 'Pembayaran', p.payments.length]] as const).map(([k, l, n]) => (
                  <button key={k} id={`cc-tab-${k}`} className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${tab === k ? 'border-brand bg-brand text-white' : 'border-line text-muted'}`} onClick={() => setTab(k)}>{l} <span className="opacity-75">{n}</span></button>
                ))}
              </div>
              <div className="overflow-x-auto">
                {(tab === 'order' || tab === 'piutang') && (
                  <table className="tbl w-full min-w-[640px] text-[13px]">
                    <thead><tr><th className="px-3 py-2 text-left">Nota</th><th className="px-3 py-2 text-left">Tanggal</th><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">Sisa</th><th className="px-3 py-2 text-left">Bayar</th></tr></thead>
                    <tbody>{(tab === 'order' ? p.orders : piutangList).slice(0, 100).map((o) => (
                      <tr key={o.id} className="cursor-pointer border-t border-line hover:bg-sunk" onClick={() => setOrder(o.id)}>
                        <td className={`px-3 py-2 font-mono text-xs ${o.status_batal === 'penuh' ? 'text-muted line-through' : ''}`}>{o.nomor}</td>
                        <td className="num px-3 py-2">{tgl(o.tanggal)}{tab === 'piutang' && <span className="block text-xs text-muted">{o.umur} hari</span>}</td>
                        <td className="px-3 py-2">{o.ringkas}</td>
                        <td className="num px-3 py-2 text-right">{nf(o.total)}{o.batal_nilai > 0 && <span className="block text-xs text-bad">batal −{nf(o.batal_nilai)}</span>}</td>
                        <td className={`num px-3 py-2 text-right ${o.sisa > 0 ? 'font-semibold text-bad' : 'text-muted'}`}>{o.sisa > 0 ? nf(o.sisa) : '–'}</td>
                        <td className="px-3 py-2"><span className={`pill ${BAYAR[o.status_bayar]?.[1]}`}>{BAYAR[o.status_bayar]?.[0]}</span>{o.deposit && <span className="pill pill-brand ml-1">Deposit</span>}{o.status_batal === 'sebagian' && <span className="pill pill-mute ml-1">Batal sebagian</span>}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
                {tab === 'deposit' && card && <div className="p-3"><DepositMutasi card={card} toko={toko} /></div>}
                {tab === 'batal' && (
                  <table className="tbl w-full min-w-[560px] text-[13px]">
                    <thead><tr><th className="px-3 py-2 text-left">Dokumen</th><th className="px-3 py-2 text-left">Nota</th><th className="px-3 py-2 text-left">Alasan</th><th className="px-3 py-2 text-right">Batal</th><th className="px-3 py-2 text-left">Status</th></tr></thead>
                    <tbody>{p.pembatalan.map((x) => (
                      <tr key={x.id} className="cursor-pointer border-t border-line hover:bg-sunk" onClick={() => setCn(x.id)}>
                        <td className="px-3 py-2 font-mono text-xs">{x.nomor}<span className="block font-sans text-muted">{tgl(x.tanggal)}</span></td><td className="px-3 py-2 font-mono text-xs">{x.order_nomor}</td>
                        <td className="px-3 py-2">{x.alasan}<span className="block text-xs text-muted">{x.diajukan_nama}</span></td><td className="num px-3 py-2 text-right">{nf(x.nilai_batal || x.nilai_item)}</td>
                        <td className="px-3 py-2"><span className={`pill ${CN_STATUS[x.status]?.[1]}`}>{CN_STATUS[x.status]?.[0]}</span></td>
                      </tr>
                    ))}{!p.pembatalan.length && <tr><td colSpan={5} className="px-3 py-4 text-center text-muted">Tidak ada pembatalan.</td></tr>}</tbody>
                  </table>
                )}
                {tab === 'bayar' && (
                  <table className="tbl w-full min-w-[480px] text-[13px]">
                    <thead><tr><th className="px-3 py-2 text-left">Tanggal</th><th className="px-3 py-2 text-left">Nota</th><th className="px-3 py-2 text-left">Metode</th><th className="px-3 py-2 text-left">Kasir</th><th className="px-3 py-2 text-right">Nominal</th></tr></thead>
                    <tbody>{p.payments.map((x) => <tr key={x.id} className="border-t border-line"><td className="num px-3 py-2">{tgl(x.tanggal)}</td><td className="px-3 py-2 font-mono text-xs">{x.nota}</td><td className="px-3 py-2">{x.metode}</td><td className="px-3 py-2">{x.kasir}</td><td className="num px-3 py-2 text-right font-semibold">{nf(x.nominal)}</td></tr>)}</tbody>
                  </table>
                )}
              </div>
            </section>
            <div className="flex flex-col gap-3">
              <section className="card p-4">
                <div className="mb-3 flex items-center justify-between gap-2"><h4 className="text-sm font-bold">Umur piutang</h4>{tagihWa && cu.telp && cu.telp !== '-' && <a className="btn btn-sm" href={waLink(cu.telp, tagihWa)} target="_blank" rel="noreferrer"><MessageCircle size={13} className="text-[#1F8F4E]" />Kirim tagihan WA</a>}</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Age c="bg-ok/10" l="0–30 hari" v={p.aging.a} n={p.aging.an} /><Age c="bg-warn/10" l="31–60 hari" v={p.aging.b} n={p.aging.bn} /><Age c="bg-bad/10" l="> 60 hari" v={p.aging.c} n={p.aging.cn} />
                </div>
              </section>
              <section className="card p-4">
                <div className="mb-2 flex items-center justify-between"><h4 className="flex items-center gap-1.5 text-sm font-bold"><WalletCards size={15} className="text-brand" />Deposit</h4><b className="num text-brand">{rp(p.kpi.deposit)}</b></div>
                {p.deposit.slice(-4).reverse().map((m) => <div key={m.id} className="flex justify-between border-t border-line py-1.5 text-xs"><span>{tgl(m.tanggal)} · {m.keterangan || m.jenis}</span><b className={m.masuk ? 'text-ok' : 'text-bad'}>{m.masuk ? `+${nf(m.masuk)}` : `−${nf(m.keluar)}`}</b></div>)}
                {!p.deposit.length && <p className="text-xs text-muted">Belum ada deposit.</p>}
                {can('deposit', 'tambah') && p.kpi.deposit_bebas > 0 && <button className="btn btn-sm mt-2 text-bad" onClick={() => setCair(true)}>Cairkan deposit</button>}
              </section>
              <section className="card p-4">
                <h4 className="mb-2 text-sm font-bold">Aktivitas</h4>
                <ol className="flex flex-col gap-2.5">{p.timeline.map((t, i) => (
                  <li key={i} className="flex gap-2.5"><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-current ${TL[t.jenis] || 'text-muted'}`} /><span className="min-w-0"><b className={`block text-[13px] ${TL[t.jenis] || ''}`}>{t.judul}</b><span className="text-xs text-muted">{tglJam(t.waktu)}{t.detail ? ` · ${t.detail}` : ''}</span></span></li>
                ))}</ol>
                {p.kpi.piutang > p.kpi.deposit && p.kpi.piutang > 0 && <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs">Piutang {rp(p.kpi.piutang)} lebih besar dari saldo deposit. Ingatkan untuk menagih saat order berikutnya.</p>}
              </section>
            </div>
          </div>
        </div>
      )}
      {order && <OrderDetailModal orderId={order} onClose={() => setOrder('')} />}
      {cn && <CancelDecideModal id={cn} onClose={() => setCn('')} />}
      {topup && cu && <DepositTopupModal customer={{ id: cu.id, nama: cu.nama }} onClose={() => setTopup(false)} />}
      {cair && cu && p && <DepositCairModal customer={{ id: cu.id, nama: cu.nama }} saldo={p.kpi.deposit_bebas} onClose={() => setCair(false)} />}
    </Modal>
  );
}

function Kpi({ t, l, v, s, bad, brand }: { t: string; l: string; v: string; s: string; bad?: boolean; brand?: boolean }) {
  return <div className={`card tint tint-${t} p-3.5`}><div className="text-[11px] font-bold uppercase tracking-wider text-muted">{l}</div><div className={`num mt-1 text-lg font-extrabold ${bad ? 'text-bad' : brand ? 'text-brand' : ''}`}>{v}</div><div className="mt-0.5 text-xs text-muted">{s}</div></div>;
}
function Bar({ parts }: { parts: [number, string][] }) {
  const t = parts.reduce((a, [n]) => a + n, 0);
  return <div className="mt-2.5 flex h-3 overflow-hidden rounded-full bg-sunk">{parts.map(([n, c], i) => <i key={i} className={`block ${c}`} style={{ width: `${t ? (n / t) * 100 : 0}%` }} />)}</div>;
}
function Lg({ c, l, n }: { c: string; l: string; n?: number }) { return <span className="flex items-center gap-1.5"><i className={`h-2.5 w-2.5 rounded-sm ${c}`} />{l}{n != null && <b className="text-ink">{n}</b>}</span>; }
function Row({ l, v }: { l: string; v: string }) { return <div className="flex justify-between gap-2 border-b border-dashed border-line pb-2"><span className="text-muted">{l}</span><b>{v}</b></div>; }
function Age({ c, l, v, n }: { c: string; l: string; v: number; n: number }) { return <div className={`rounded-xl px-2.5 py-2 ${c}`}>{l}<b className="num mt-0.5 block text-sm">{rp(v)}</b>{n ? `${n} nota` : '–'}</div>; }

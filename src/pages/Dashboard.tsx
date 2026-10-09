import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BarChart3, AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, MonitorSmartphone, Package, Users, Receipt, Wallet, HandCoins, ShoppingCart } from 'lucide-react';
import { TrendBars } from '@/components/TrendBars';
import { PageHeader } from '@/components/ui/Field';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { nf, rp, tgl, ymd } from '@/lib/format';

interface Trx { omzet_hari_ini: number; omzet_kemarin: number; masuk_hari_ini: number; masuk_kemarin: number; nota_hari_ini: number; nota_kemarin: number; piutang_total: number; piutang_nota: number; tren: { tanggal: string; omzet: number; masuk: number }[] }
interface Summary {
  trx: Trx | null;
  produksi: { mesin_id: string; mesin: string; antrian: number; proses: number }[] | null;
  hutang: { total: number; tagihan: number; jatuh_tempo: { id: string; supplier: string; sisa: number; jatuh_tempo: string; nota: string }[] } | null;
  bulan: { omzet: number; omzet_bulan_lalu_sd: number; omzet_bulan_lalu: number; top_produk: { nama: string; omzet: number; qty: number }[] } | null;
  produk_aktif: number; produk_tanpa_harga: number; konsumen: number; reseller: number; perangkat_menunggu: number | null;
  perubahan_harga: { product_id: string; kode: string; nama: string; berlaku_mulai: string; sebelum: number | null; sesudah: number | null; persen: number | null; terjadwal: boolean; catatan: string }[];
}

const STAGES = [
  { n: 1, label: 'Fondasi: login, perangkat, master data, harga matriks', status: 'selesai' },
  { n: 2, label: 'Transaksi inti: front office, kasir, order, piutang, mode offline', status: 'selesai' },
  { n: 4, label: 'Operasional: produksi, mesin, kas', status: 'selesai' },
  { n: 5, label: 'Keuangan & laporan: pengeluaran, hutang supplier, laporan & laba', status: 'selesai' },
  { n: 3, label: 'Aplikasi desktop FO & kasir: installer, printer struk, laci, update otomatis', status: 'jalan' },
  { n: 6, label: 'Migrasi data & go-live', status: 'berikutnya' },
];

export function Dashboard() {
  const { user, can } = useAuth();
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Summary>('dashboard.summary') });
  const d = q.data;
  const hour = new Date().getHours();
  const greet = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';

  const kpis = [
    { label: 'Produk aktif', value: d?.produk_aktif, icon: Package, to: '/master/produk', note: d?.produk_tanpa_harga ? `${d.produk_tanpa_harga} belum punya harga` : 'Semua sudah berharga', warn: !!d?.produk_tanpa_harga, show: can('master.produk') },
    { label: 'Konsumen aktif', value: d?.konsumen, icon: Users, to: '/master/konsumen', note: d ? `${nf(d.reseller)} reseller · ${nf(d.konsumen - d.reseller)} end user` : '', show: can('master.konsumen') },
    { label: 'Harga berubah (30 hari)', value: d?.perubahan_harga.filter((x) => !x.terjadwal).length, icon: ArrowUpRight, to: '/master/produk', note: d ? `${d.perubahan_harga.filter((x) => x.terjadwal).length} terjadwal ke depan` : '', show: can('master.produk') },
    { label: 'Perangkat menunggu', value: d?.perangkat_menunggu ?? undefined, icon: MonitorSmartphone, to: '/pengaturan/perangkat', note: d?.perangkat_menunggu ? 'Perlu disetujui admin' : 'Tidak ada permintaan', warn: !!d?.perangkat_menunggu, show: d?.perangkat_menunggu != null },
  ].filter((k) => k.show);

  return (
    <>
      <PageHeader title={`${greet}, ${user?.nama?.split(' ')[0] || ''}`} desc="Ringkasan hari ini dibanding kemarin, bulan berjalan dibanding bulan lalu di tanggal yang sama." />
      {d?.trx && <TrxPanel t={d.trx} />}
      {(d?.bulan || d?.hutang) && <BulanPanel b={d.bulan} h={d.hutang} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} to={k.to} className="card group p-4 transition hover:border-brand/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">{k.label}</span>
              <k.icon size={18} className="text-muted group-hover:text-brand" />
            </div>
            <div className="num mt-2 text-3xl font-extrabold">{q.isLoading ? '…' : nf(k.value ?? 0)}</div>
            <div className={`mt-1 text-xs ${k.warn ? 'font-semibold text-warn' : 'text-muted'}`}>{k.note}</div>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {can('master.produk') && (
          <section className="card overflow-hidden xl:col-span-2">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-sm font-bold">Perubahan harga jual</h2>
              <span className="text-xs text-muted">30 hari terakhir & terjadwal · kolom reseller banyak</span>
            </div>
            {!d?.perubahan_harga.length ? <div className="p-6 text-sm text-muted">{q.isLoading ? 'Memuat…' : 'Belum ada perubahan harga.'}</div> : (
              <ul className="divide-y divide-line">
                {d.perubahan_harga.map((c) => (
                  <li key={c.product_id + c.berlaku_mulai} className="flex items-center gap-3 px-4 py-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${c.terjadwal ? 'bg-warn/10 text-warn' : (c.persen ?? 0) >= 0 ? 'bg-bad/10 text-bad' : 'bg-ok/10 text-ok'}`}>
                      {c.terjadwal ? <CalendarClock size={17} /> : (c.persen ?? 0) >= 0 ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{c.nama} <span className="font-mono text-xs font-normal text-muted">#{c.kode}</span></div>
                      <div className="text-xs text-muted">{c.terjadwal ? 'Mulai' : 'Sejak'} {tgl(c.berlaku_mulai)}{c.catatan ? ` · ${c.catatan}` : ''}</div>
                    </div>
                    <div className="text-right">
                      <div className="num text-sm font-bold">{nf(c.sebelum)} → {nf(c.sesudah)}</div>
                      {c.persen != null && <div className={`num text-xs font-bold ${c.persen > 0 ? 'text-bad' : 'text-ok'}`}>{c.persen > 0 ? '+' : ''}{c.persen}%</div>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {d?.produksi && (
          <section className="card p-4">
            <div className="flex items-center justify-between"><h2 className="text-sm font-bold">Antrian produksi</h2><Link to="/produksi" className="text-xs font-semibold text-brand">Buka papan</Link></div>
            {!d.produksi.length ? <p className="mt-3 text-sm text-muted">Tidak ada pekerjaan yang menunggu.</p> : (
              <ul className="mt-3 flex flex-col gap-2">
                {d.produksi.map((m) => (
                  <li key={m.mesin_id} className="flex items-center gap-3 text-sm">
                    <span className="w-24 truncate font-semibold">{m.mesin}</span>
                    <span className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-sunk">
                      <span className="h-full bg-brand" style={{ width: `${(m.antrian / Math.max(...d.produksi!.map((x) => x.antrian + x.proses))) * 100}%` }} />
                      <span className="h-full bg-warn" style={{ width: `${(m.proses / Math.max(...d.produksi!.map((x) => x.antrian + x.proses))) * 100}%` }} />
                    </span>
                    <span className="num w-28 text-right text-xs"><b>{m.antrian}</b> antrian · <b>{m.proses}</b> proses</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        <section className="card p-4">
          <h2 className="text-sm font-bold">Progres pembangunan</h2>
          <ol className="mt-3 flex flex-col gap-2.5">
            {STAGES.map((s) => (
              <li key={s.n} className="flex gap-3 text-sm">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${s.status === 'jalan' ? 'bg-brand text-brand-ink' : s.status === 'selesai' ? 'bg-ok text-white' : s.status === 'berikutnya' ? 'border-2 border-brand text-brand' : 'bg-sunk text-muted'}`}>{s.status === 'selesai' ? '✓' : s.n}</span>
                <span className={s.status ? 'font-semibold' : 'text-muted'}>{s.label}{s.status === 'jalan' && <span className="pill pill-brand ml-2">sekarang</span>}</span>
              </li>
            ))}
          </ol>
          {d?.produk_tanpa_harga ? (
            <div className="mt-4 flex gap-2 rounded-lg bg-warn/10 p-3 text-xs text-warn"><AlertTriangle size={15} className="shrink-0" />Ada {d.produk_tanpa_harga} produk aktif tanpa harga. Lengkapi sebelum kasir dipakai.</div>
          ) : null}
        </section>
      </div>
    </>
  );
}

function BulanPanel({ b, h }: { b: Summary['bulan']; h: Summary['hutang'] }) {
  const today = ymd();
  const pctB = b && b.omzet_bulan_lalu_sd ? ((b.omzet - b.omzet_bulan_lalu_sd) / b.omzet_bulan_lalu_sd) * 100 : null;
  const topMax = Math.max(1, ...(b?.top_produk || []).map((x) => x.omzet));
  return (
    <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
      {b && (
        <Link to="/laporan" className="card group p-4 transition hover:border-brand/50">
          <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-muted">Omzet bulan ini</span><BarChart3 size={18} className="text-muted group-hover:text-brand" /></div>
          <div className="num mt-2 text-3xl font-extrabold">{rp(b.omzet)}</div>
          <div className="mt-1 text-xs">
            {pctB == null ? <span className="text-muted">Belum ada pembanding bulan lalu</span> :
              <><span className={`inline-flex items-center gap-0.5 font-bold ${pctB >= 0 ? 'text-ok' : 'text-bad'}`}>{pctB >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(pctB).toFixed(0)}%</span> <span className="text-muted">vs bulan lalu s.d. tanggal {Number(today.slice(8))}</span>
              <div className="num mt-0.5 text-muted">{rp(b.omzet_bulan_lalu_sd)}</div></>}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-sunk" title="Bulan ini dibanding total bulan lalu">
            <div className="h-full rounded-full bg-brand" style={{ width: `${b.omzet_bulan_lalu ? Math.min(100, (b.omzet / b.omzet_bulan_lalu) * 100) : 0}%` }} />
          </div>
          <div className="mt-1 text-xs text-muted">{b.omzet_bulan_lalu ? `${((b.omzet / b.omzet_bulan_lalu) * 100).toFixed(0)}% dari total bulan lalu ${rp(b.omzet_bulan_lalu)}` : 'Bulan lalu belum ada omzet'}</div>
        </Link>
      )}
      {b && (
        <section className="card p-4">
          <div className="flex items-center justify-between"><h2 className="text-sm font-bold">Produk terlaris bulan ini</h2><Link to="/laporan" className="text-xs font-semibold text-brand">Laporan</Link></div>
          {!b.top_produk.length ? <p className="mt-3 text-sm text-muted">Belum ada penjualan bulan ini.</p> : (
            <ol className="mt-3 flex flex-col gap-2">
              {b.top_produk.map((p, i) => (
                <li key={p.nama} className="text-sm">
                  <div className="flex justify-between gap-2"><span className="truncate"><span className="num mr-1.5 text-xs text-muted">{i + 1}</span>{p.nama}</span><span className="num shrink-0 font-semibold">{nf(p.omzet)}</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunk"><div className="h-full rounded-full" style={{ width: `${(p.omzet / topMax) * 100}%`, background: 'var(--chart-1)' }} /></div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
      {h && (
        <section className="card p-4">
          <div className="flex items-center justify-between"><h2 className="text-sm font-bold">Hutang supplier</h2><Link to="/hutang" className="text-xs font-semibold text-brand">Buka</Link></div>
          <div className="num mt-2 text-2xl font-extrabold text-bad">{rp(h.total)}</div>
          <div className="text-xs text-muted">{nf(h.tagihan)} tagihan belum lunas</div>
          {!h.jatuh_tempo.length ? <p className="mt-3 text-xs text-muted">Tidak ada yang jatuh tempo 7 hari ke depan.</p> : (
            <ul className="mt-3 flex flex-col divide-y divide-line">
              {h.jatuh_tempo.map((x) => {
                const late = x.jatuh_tempo && x.jatuh_tempo < today;
                return (
                  <li key={x.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                    <span className="min-w-0"><span className="block truncate font-semibold">{x.supplier || '–'}</span><span className={`text-xs ${late ? 'font-semibold text-bad' : 'text-warn'}`}>{late ? 'Lewat' : 'Jatuh tempo'} {tgl(x.jatuh_tempo)}</span></span>
                    <span className="num shrink-0 font-semibold">{nf(x.sisa)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Delta({ now, before }: { now: number; before: number }) {
  if (!before) return <span className="text-xs text-muted">kemarin {nf(before)}</span>;
  const pct = ((now - before) / before) * 100;
  const up = pct >= 0;
  return <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${up ? 'text-ok' : 'text-bad'}`}>{up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(pct).toFixed(0)}% <span className="font-normal text-muted">vs kemarin</span></span>;
}

function TrxPanel({ t }: { t: Trx }) {
  const tiles = [
    { label: 'Omzet hari ini', value: rp(t.omzet_hari_ini), icon: Receipt, to: '/order', sub: <Delta now={t.omzet_hari_ini} before={t.omzet_kemarin} /> },
    { label: 'Uang masuk hari ini', value: rp(t.masuk_hari_ini), icon: Wallet, to: '/order', sub: <Delta now={t.masuk_hari_ini} before={t.masuk_kemarin} /> },
    { label: 'Nota hari ini', value: nf(t.nota_hari_ini), icon: ShoppingCart, to: '/order', sub: <Delta now={t.nota_hari_ini} before={t.nota_kemarin} /> },
    { label: 'Piutang berjalan', value: rp(t.piutang_total), icon: HandCoins, to: '/piutang', sub: <span className="text-xs text-muted">{nf(t.piutang_nota)} nota belum lunas</span>, bad: true },
  ];
  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((k) => (
          <Link key={k.label} to={k.to} className="card group p-4 transition hover:border-brand/50">
            <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-muted">{k.label}</span><k.icon size={18} className="text-muted group-hover:text-brand" /></div>
            <div className={`num mt-2 text-2xl font-extrabold ${k.bad ? 'text-bad' : ''}`}>{k.value}</div>
            <div className="mt-1">{k.sub}</div>
          </Link>
        ))}
      </div>
      <section className="card p-4">
        <h2 className="mb-3 text-sm font-bold">14 hari terakhir</h2>
        <TrendBars data={t.tren} />
      </section>
    </div>
  );
}

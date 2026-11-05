import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, Package, Truck, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { nf, rp } from '@/lib/format';

interface Top { nama: string; tipe?: string; omzet?: number; nilai?: number; qty?: number; nota?: number; jumlah?: number }
interface Master {
  bulan: string;
  pelanggan: { total: number; aktif: number; nonaktif: number; reseller: number; enduser: number; baru_bulan: number; piutang_konsumen: number; piutang_total: number; top: Top[] };
  suplayer: { total: number; aktif: number; hutang_total: number; hutang_supplier: number; top: Top[] };
  produk: { total: number; aktif: number; nonaktif: number; tanpa_harga: number; kategori: { nama: string; jumlah: number }[]; top: Top[] };
}

const C_PRC = 'rgb(var(--brand))';
const C_EU = '#2E8B57';
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

/** Infografis master data — hanya dirender untuk owner/superadmin (lihat Dashboard). */
export function DashboardMaster() {
  const q = useQuery({ queryKey: ['dashboard', 'master'], queryFn: () => api<Master>('dashboard.master') });
  const d = q.data;
  if (q.isLoading) return <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="card h-64 animate-pulse bg-sunk" />)}</div>;
  if (!d) return null;
  const { pelanggan: p, suplayer: s, produk: pr } = d;
  const maxCust = Math.max(1, ...p.top.map((t) => t.omzet || 0));
  const maxSup = Math.max(1, ...s.top.map((t) => t.nilai || 0));
  const maxProd = Math.max(1, ...pr.top.map((t) => t.omzet || 0));
  const maxKat = Math.max(1, ...pr.kategori.map((k) => k.jumlah));

  return (
    <section aria-label="Infografis master data" className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-bold text-muted"><span className="inline-block h-4 w-1 rounded bg-brand" />Master data</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ---------- PELANGGAN ---------- */}
        <article className="card flex flex-col gap-3 p-4">
          <Head icon={<Users size={17} />} title="Pelanggan" to="/master/konsumen" />
          <div className="flex items-end gap-3">
            <div className="num text-3xl font-extrabold leading-none">{nf(p.total)}</div>
            <div className="mb-0.5 text-xs text-muted">{nf(p.aktif)} aktif{p.nonaktif ? ` · ${nf(p.nonaktif)} nonaktif` : ''}</div>
          </div>
          <Stacked a={p.reseller} b={p.enduser} la="01 · Percetakan" lb="02 · End user" />
          <div className="grid grid-cols-2 gap-2">
            <Mini label="Baru bulan ini" value={`+${nf(p.baru_bulan)}`} tint="green" />
            <Mini label="Punya piutang" value={nf(p.piutang_konsumen)} sub={p.piutang_total ? rp(p.piutang_total) : ''} tint="rose" bad={p.piutang_total > 0} />
          </div>
          <TopList title="Pelanggan teratas" rows={p.top.map((t) => ({ nama: t.nama, nilai: t.omzet || 0, ket: `${nf(t.nota || 0)} nota`, tipe: t.tipe }))} max={maxCust} empty="Belum ada order." />
        </article>

        {/* ---------- SUPPLIER ---------- */}
        <article className="card flex flex-col gap-3 p-4">
          <Head icon={<Truck size={17} />} title="Supplier" to="/master/supplier" />
          <div className="flex items-end gap-3">
            <div className="num text-3xl font-extrabold leading-none">{nf(s.total)}</div>
            <div className="mb-0.5 text-xs text-muted">{nf(s.aktif)} aktif</div>
          </div>
          <div className={`rounded-xl px-3 py-2.5 ${s.hutang_total ? 'bg-bad/10' : 'bg-ok/10'}`}>
            <div className="flex items-center justify-between text-xs"><span className="text-muted">Hutang berjalan</span><span className="text-muted">{nf(s.hutang_supplier)} supplier</span></div>
            <div className={`num mt-0.5 text-xl font-extrabold ${s.hutang_total ? 'text-bad' : 'text-ok'}`}>{rp(s.hutang_total)}</div>
          </div>
          <TopList title="Pembelian terbanyak" rows={s.top.map((t) => ({ nama: t.nama, nilai: t.nilai || 0, ket: `${nf(t.nota || 0)}×` }))} max={maxSup} empty="Belum ada pembelian." money />
        </article>

        {/* ---------- PRODUK ---------- */}
        <article className="card flex flex-col gap-3 p-4">
          <Head icon={<Package size={17} />} title="Produk" to="/master/produk" />
          <div className="flex items-end gap-3">
            <div className="num text-3xl font-extrabold leading-none">{nf(p_aktif(pr))}</div>
            <div className="mb-0.5 text-xs text-muted">aktif{pr.nonaktif ? ` · ${nf(pr.nonaktif)} nonaktif` : ''}</div>
          </div>
          {pr.tanpa_harga > 0 && (
            <Link to="/master/produk" className="flex items-center gap-2 rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">
              <AlertTriangle size={14} className="shrink-0" />{nf(pr.tanpa_harga)} produk aktif belum ada harga
            </Link>
          )}
          <div>
            <div className="mb-1.5 text-xs font-semibold text-muted">Per kategori</div>
            <div className="flex flex-col gap-1.5">
              {pr.kategori.slice(0, 5).map((k) => (
                <div key={k.nama} className="flex items-center gap-2 text-xs">
                  <span className="w-24 shrink-0 truncate" title={k.nama}>{k.nama}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-sunk"><span className="block h-full rounded-full bg-brand" style={{ width: `${pct(k.jumlah, maxKat)}%` }} /></span>
                  <b className="num w-6 text-right">{nf(k.jumlah)}</b>
                </div>
              ))}
              {!pr.kategori.length && <p className="text-xs text-muted">Belum ada produk.</p>}
            </div>
          </div>
          <TopList title="Terlaris bulan ini" rows={pr.top.map((t) => ({ nama: t.nama, nilai: t.omzet || 0, ket: `${nf(t.qty || 0)} pcs` }))} max={maxProd} empty="Belum ada penjualan bulan ini." money />
        </article>
      </div>
    </section>
  );
}

const p_aktif = (pr: Master['produk']) => pr.aktif;

function Head({ icon, title, to }: { icon: React.ReactNode; title: string; to: string }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="flex items-center gap-2 text-sm font-bold"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-canvas">{icon}</span>{title}</h3>
      <Link to={to} className="text-xs font-semibold text-brand hover:underline">Lihat</Link>
    </div>
  );
}

function Stacked({ a, b, la, lb }: { a: number; b: number; la: string; lb: string }) {
  const t = a + b;
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-sunk">
        {t > 0 && <><div style={{ width: `${(a / t) * 100}%`, background: C_PRC }} /><div style={{ width: `${(b / t) * 100}%`, background: C_EU }} /></>}
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: C_PRC }} />{la} <b className="num">{nf(a)}</b><span className="text-muted">{pct(a, t)}%</span></span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: C_EU }} />{lb} <b className="num">{nf(b)}</b><span className="text-muted">{pct(b, t)}%</span></span>
      </div>
    </div>
  );
}

function Mini({ label, value, sub, tint, bad }: { label: string; value: string; sub?: string; tint: string; bad?: boolean }) {
  return (
    <div className={`card tint tint-${tint} p-2.5`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={`num text-lg font-extrabold ${bad ? 'text-bad' : ''}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

function TopList({ title, rows, max, empty, money }: { title: string; rows: { nama: string; nilai: number; ket: string; tipe?: string }[]; max: number; empty: string; money?: boolean }) {
  return (
    <div className="mt-auto">
      <div className="mb-1.5 text-xs font-semibold text-muted">{title}</div>
      {rows.length ? (
        <ol className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <li key={i} className="text-xs">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate"><span className="mr-1 text-muted">{i + 1}</span>{r.nama}{r.tipe && <span className="ml-1 text-[10px] text-muted">{r.tipe === 'reseller' ? '01' : '02'}</span>}</span>
                <b className="num shrink-0">{money ? rp(r.nilai) : nf(r.nilai)}<span className="ml-1 font-normal text-muted">{r.ket}</span></b>
              </div>
              <div className="mt-0.5 h-1 rounded-full bg-sunk"><div className="h-full rounded-full" style={{ width: `${pct(r.nilai, max)}%`, background: r.tipe === 'enduser' ? C_EU : C_PRC }} /></div>
            </li>
          ))}
        </ol>
      ) : <p className="text-xs text-muted">{empty}</p>}
    </div>
  );
}

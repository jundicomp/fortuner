import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Contact, FileDown, FileSpreadsheet, FileText, Moon, Sparkles, UserCheck, UserX, Users } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { nf, rp } from '@/lib/format';
import { DateRangeFilter, periodeLabel, rangeFor, type DateRange, type Preset } from '@/components/table/DateRangeFilter';
import { exportBook } from '@/components/table/exportXlsx';
import { shopOf } from '@/components/Receipt';
import { useAuth } from '@/auth/AuthContext';
import { useSettings } from '@/lib/queries';
import { downloadDoc, printHtml } from '@/lib/customerReport';
import { bulanLabel, konsumenReportHtml, konsumenSheets, type KonsumenStats } from '@/lib/konsumenReport';

type Stats = KonsumenStats;

const C_PRC = 'rgb(var(--brand))';
const C_EU = '#2E8B57';
const LS = 'konsumen-ringkasan';
const LSP = 'konsumen-ringkasan-periode';
const CHIPS: [Preset, string][] = [['bulan_ini', 'Bulan ini'], ['tahun_ini', 'Tahun ini'], ['semua', 'Keseluruhan']];
const bulanNama = () => new Date().toLocaleDateString('id-ID', { month: 'long' });
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

/** Batang dua warna Percetakan vs End user + legenda. */
function Split({ a, b, fmt }: { a: number; b: number; fmt: (n: number) => string }) {
  const t = a + b;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-sunk">
        {t > 0 && <div style={{ width: `${(a / t) * 100}%`, background: C_PRC }} />}
        {t > 0 && <div style={{ width: `${(b / t) * 100}%`, background: C_EU }} />}
      </div>
      <div className="mt-2 flex flex-col gap-1 text-xs sm:flex-row sm:justify-between sm:gap-3">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: C_PRC }} />01 · Percetakan <b className="num whitespace-nowrap">{fmt(a)}</b><span className="text-muted">{pct(a, t)}%</span></span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: C_EU }} />02 · End user <b className="num whitespace-nowrap">{fmt(b)}</b><span className="text-muted">{pct(b, t)}%</span></span>
      </div>
    </div>
  );
}

export function CustomerStats() {
  const { can, user } = useAuth();
  const settings = useSettings();
  const [range, setRange] = useState<DateRange>(() => { try { const v = JSON.parse(localStorage.getItem(LSP) || 'null'); if (v?.preset) return v.preset === 'custom' ? v : rangeFor(v.preset); } catch { /* abaikan */ } return rangeFor('bulan_ini'); });
  const pilih = (r: DateRange) => { setRange(r); try { localStorage.setItem(LSP, JSON.stringify(r)); } catch { /* abaikan */ } };
  const q = useQuery({ queryKey: ['master', 'customers', 'stats', range.from, range.to], queryFn: () => api<Stats>('customers.stats', { from: range.from, to: range.to }) });
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(LS) !== '0'; } catch { return true; } });
  const [semuaTop, setSemuaTop] = useState(false);
  const [busy, setBusy] = useState('');
  const toggle = () => setOpen((o) => { try { localStorage.setItem(LS, o ? '0' : '1'); } catch { /* abaikan */ } return !o; });
  const s = q.data;
  const semua = range.preset === 'semua';
  const per = range.preset === 'bulan_ini' ? `bulan ${bulanNama()}` : range.preset === 'tahun_ini' ? `tahun ${new Date().getFullYear()}` : semua ? 'keseluruhan' : periodeLabel(range.from, range.to).replace(/^Periode /, '').replace(/^Tanggal /, '');
  const judulPeriode = semua ? 'Keseluruhan data' : range.preset === 'bulan_ini' ? `Bulan ${bulanNama()} ${new Date().getFullYear()}` : range.preset === 'tahun_ini' ? `Tahun ${new Date().getFullYear()}` : periodeLabel(range.from, range.to);
  const bisaEkspor = can('master.konsumen', 'ekspor') && !!s;
  const run = async (k: string, f: () => Promise<void> | void) => { setBusy(k); try { await f(); } finally { setBusy(''); } };
  const shop = () => shopOf(settings.data);
  const fileBase = `Laporan Konsumen ${judulPeriode}`;
  const doPdf = () => s && printHtml(konsumenReportHtml(s, shop(), judulPeriode, user?.nama), fileBase);
  const doDoc = () => run('doc', () => (s ? downloadDoc(konsumenReportHtml(s, shop(), judulPeriode, user?.nama), fileBase) : undefined));
  const doXls = () => run('xls', () => (s ? exportBook(konsumenSheets(s), `${fileBase.replace(/[\\/:*?"<>|]+/g, ' ')}.xlsx`, { subtitle: judulPeriode }) : undefined));

  const tiles = s ? [
    { label: 'Konsumen aktif', value: nf(s.aktif), sub: s.nonaktif ? `${nf(s.nonaktif)} nonaktif` : 'semua aktif', icon: Users, tint: 'orange' },
    semua
      ? { label: 'Pernah order', value: nf(s.transaksi), sub: `${pct(s.transaksi, s.aktif)}% dari konsumen aktif`, icon: UserCheck, tint: 'green' }
      : { label: `Baru ${per}`, value: nf(s.baru), sub: `01 · ${nf(s.baru_jenis.reseller)} · 02 · ${nf(s.baru_jenis.enduser)}`, icon: Sparkles, tint: 'blue' },
    semua
      ? { label: 'Belum pernah order', value: nf(s.belum_order), sub: 'konsumen aktif tanpa nota', icon: UserX, tint: 'blue' }
      : { label: `Order ${per}`, value: nf(s.transaksi), sub: `${pct(s.transaksi, s.aktif)}% konsumen aktif order`, icon: UserCheck, tint: 'green' },
    { label: 'Lama tidak order', value: nf(s.tidur), sub: 'order terakhir lebih dari 60 hari', icon: Moon, tint: 'purple' },
  ] : [];
  const maxTop = Math.max(1, ...(s?.top || []).map((t) => t.omzet));

  return (
    <section className="mb-4" aria-label="Ringkasan konsumen">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button id="cust-stats-toggle" onClick={toggle} className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-muted hover:text-ink">
          <ChevronDown size={14} className={`transition ${open ? '' : '-rotate-90'}`} />Ringkasan konsumen
        </button>
        {open && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-line p-0.5" role="group" aria-label="Periode ringkasan">
              {CHIPS.map(([k, l]) => <button key={k} id={`cust-per-${k}`} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${range.preset === k ? 'bg-brand text-white' : 'text-muted hover:text-ink'}`} onClick={() => pilih(rangeFor(k))}>{l}</button>)}
            </div>
            <DateRangeFilter value={range} onChange={pilih} id="cust-per-range" />
            {bisaEkspor && <>
              <button id="cust-rep-xls" className="btn btn-sm" disabled={!!busy} onClick={doXls} title="Ringkasan & rekap per konsumen ke Excel"><FileSpreadsheet size={14} className="text-[#1F8F4E]" />Excel</button>
              <button id="cust-rep-pdf" className="btn btn-sm" onClick={doPdf} title="Laporan konsumen A4: cetak atau Simpan sebagai PDF"><FileDown size={14} />PDF A4</button>
              <button id="cust-rep-doc" className="btn btn-sm" disabled={!!busy} onClick={doDoc} title="Laporan konsumen A4 sebagai Word"><FileText size={14} />Word</button>
            </>}
          </div>
        )}
      </div>
      {open && (q.isLoading ? <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">{[0, 1, 2, 3, 4].map((i) => <div key={i} className={`card h-[120px] animate-pulse bg-sunk ${i ? '' : 'col-span-2'}`} />)}</div>
        : s && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
              <div id="cust-total" className="card col-span-2 flex flex-col p-4">
                <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold uppercase tracking-wider text-muted">Total konsumen</span><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink text-canvas"><Contact size={17} /></span></div>
                <div className="mt-2 flex items-end gap-4">
                  <div className="num text-3xl font-extrabold leading-none">{nf(s.total)}</div>
                  <div className="mb-0.5 flex h-2 flex-1 overflow-hidden rounded-full bg-sunk">
                    {s.total > 0 && <><div style={{ width: `${(s.total_percetakan / s.total) * 100}%`, background: C_PRC }} /><div style={{ width: `${(s.total_enduser / s.total) * 100}%`, background: C_EU }} /></>}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {([['01 · Percetakan', s.total_percetakan, C_PRC], ['02 · End user', s.total_enduser, C_EU]] as const).map(([l, n, col]) => (
                    <div key={l} className="rounded-xl border border-line px-3 py-2" style={{ borderLeft: `4px solid ${col}` }}>
                      <div className="text-xs font-semibold text-muted">{l}</div>
                      <div className="flex items-baseline gap-1.5"><b className="num text-lg">{nf(n)}</b><span className="text-xs text-muted">{pct(n, s.total)}%</span></div>
                    </div>
                  ))}
                </div>
              </div>
              {tiles.map((k) => (
                <div key={k.label} className={`card tint tint-${k.tint} p-4`}>
                  <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold uppercase tracking-wider text-muted">{k.label}</span><span className="tint-chip flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"><k.icon size={17} /></span></div>
                  <div className="num mt-2 text-2xl font-extrabold">{k.value}</div>
                  <div className="mt-1 text-xs text-muted">{k.sub}</div>
                </div>
              ))}
            </div>
            <div className={`grid grid-cols-1 gap-3 ${s.top ? 'lg:grid-cols-2' : ''}`}>
              <div className="card flex flex-col gap-5 p-4">
                <div>
                  <h3 className="mb-3 text-sm font-bold">Jenis konsumen aktif</h3>
                  <Split a={s.percetakan} b={s.enduser} fmt={nf} />
                </div>
                {s.omzet && (
                  <div>
                    <h3 className="mb-3 text-sm font-bold">Omzet {per} per jenis</h3>
                    <Split a={s.omzet.reseller} b={s.omzet.enduser} fmt={rp} />
                  </div>
                )}
                {s.nota && (
                  <div>
                    <h3 className="mb-3 text-sm font-bold">Nota {per} per jenis</h3>
                    <Split a={s.nota.reseller} b={s.nota.enduser} fmt={(n) => `${nf(n)} nota`} />
                  </div>
                )}
                {s.piutang && (
                  <div className="mt-auto flex items-center justify-between rounded-xl border border-dashed border-line px-3 py-2 text-sm">
                    <span className="text-muted">Piutang berjalan · {nf(s.piutang.konsumen)} konsumen</span><b className="num text-bad">{rp(s.piutang.total)}</b>
                  </div>
                )}
              </div>
              {s.top && (
                <div className="card p-4">
                  <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-bold">Top konsumen {per}</h3>{s.top.length > 5 && <button className="text-xs font-semibold text-brand" onClick={() => setSemuaTop(!semuaTop)}>{semuaTop ? 'Top 5' : `Lihat top ${s.top.length}`}</button>}</div>
                  {s.top.length ? (
                    <ol className="flex flex-col gap-3">
                      {s.top.slice(0, semuaTop ? 10 : 5).map((t, i) => (
                        <li key={t.id}>
                          <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="min-w-0 truncate"><span className="mr-1.5 text-muted">{i + 1}</span><b>{t.nama}</b>{t.percetakan && t.percetakan !== t.nama && <span className="text-muted"> · {t.percetakan}</span>}</span>
                            <span className="num shrink-0 font-semibold">{rp(t.omzet)} <span className="text-xs font-normal text-muted">· {nf(t.nota)} nota</span></span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-sunk"><div className="h-full rounded-full" style={{ width: `${(t.omzet / maxTop) * 100}%`, background: t.tipe === 'reseller' ? C_PRC : C_EU }} /></div>
                        </li>
                      ))}
                    </ol>
                  ) : <p className="text-sm text-muted">Belum ada order pada periode ini.</p>}
                </div>
              )}
            </div>
            {s.bulanan && s.bulanan.length > 1 && <Tren rows={s.bulanan} />}
          </div>
        ))}
    </section>
  );
}

/** Omzet per bulan (01 vs 02, bertumpuk) + jumlah konsumen baru, untuk periode lebih dari satu bulan. */
function Tren({ rows }: { rows: NonNullable<Stats['bulanan']> }) {
  const max = Math.max(1, ...rows.map((r) => r.reseller + r.enduser));
  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold">Omzet & konsumen baru per bulan</h3>
        <span className="flex gap-3 text-xs text-muted"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: C_PRC }} />01 · Percetakan</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: C_EU }} />02 · End user</span></span>
      </div>
      <div className="overflow-x-auto">
        <div className="flex h-44 min-w-full items-end gap-2" style={{ width: rows.length > 12 ? rows.length * 44 : undefined }}>
          {rows.map((r) => {
            const t = r.reseller + r.enduser;
            return (
              <div key={r.bulan} className="flex h-full min-w-[32px] flex-1 flex-col items-center justify-end gap-1" title={`${bulanLabel(r.bulan)}: ${rp(t)} · ${nf(r.nota)} nota · ${nf(r.baru)} konsumen baru`}>
                <span className="num text-[10px] font-semibold text-muted">{t >= 1e6 ? `${(t / 1e6).toFixed(1).replace('.', ',')}jt` : t ? `${Math.round(t / 1e3)}rb` : ''}</span>
                <div className="flex w-full max-w-[40px] flex-col-reverse overflow-hidden rounded-t" style={{ height: `${(t / max) * 100}%`, minHeight: t ? 2 : 0 }}>
                  <i className="block" style={{ height: `${t ? (r.reseller / t) * 100 : 0}%`, background: C_PRC }} /><i className="block" style={{ height: `${t ? (r.enduser / t) * 100 : 0}%`, background: C_EU }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex min-w-full gap-2" style={{ width: rows.length > 12 ? rows.length * 44 : undefined }}>
          {rows.map((r) => <div key={r.bulan} className="min-w-[32px] flex-1 text-center text-[10px] leading-tight text-muted"><b className="block text-ink">{bulanLabel(r.bulan).split(' ')[0]}</b>{r.bulan.slice(2, 4)}{r.baru ? <span className="block text-brand">+{r.baru}</span> : <span className="block">&nbsp;</span>}</div>)}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">Angka oranye di bawah bulan = konsumen baru terdaftar.</p>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ErrorBox, PageHeader } from '@/components/ui/Field';
import { exportBook } from '@/components/table/exportXlsx';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { nf, rp } from '@/lib/format';

interface Hari { omzet: number; piutang: number; nota: number }
interface Res { tahun: string; today: string; hari: Record<string, Hari>; tahun_tersedia: string[] }
type Mode = 'split' | 'omzet' | 'nota';
interface Cell { omzet: number; cash: number; piutang: number; nota: number; dow: number; fut: boolean }

const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const BLN_L = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const pad = (n: number) => String(n).padStart(2, '0');
const rb = (n: number) => nf(n / 1000);
const C_CASH = '34,128,74', C_PIU = '200,40,40';
const heat = (rgb: string, v: number, max: number) => (max && v ? `rgba(${rgb},${(0.06 + 0.44 * (v / max)).toFixed(3)})` : undefined);

/** Matriks tanggal (baris) × bulan (kolom) untuk satu tahun. */
function useGrid(d?: Res) {
  return useMemo(() => {
    if (!d) return null;
    const y = Number(d.tahun);
    const grid: (Cell | null)[][] = [];
    const bulan = Array.from({ length: 12 }, () => ({ omzet: 0, cash: 0, piutang: 0, nota: 0, hari: 0, jalan: false }));
    let best = { v: 0, m: 0, d: 0 };
    for (let m = 0; m < 12; m++) {
      grid[m] = [];
      const dim = new Date(y, m + 1, 0).getDate();
      for (let day = 1; day <= 31; day++) {
        if (day > dim) { grid[m][day] = null; continue; }
        const key = `${y}-${pad(m + 1)}-${pad(day)}`;
        const h = d.hari[key] || { omzet: 0, piutang: 0, nota: 0 };
        const fut = key > d.today;
        const c: Cell = { omzet: h.omzet, piutang: h.piutang, cash: h.omzet - h.piutang, nota: h.nota, dow: new Date(y, m, day).getDay(), fut };
        grid[m][day] = c;
        if (!fut) { const b = bulan[m]; b.jalan = true; b.hari++; b.omzet += c.omzet; b.cash += c.cash; b.piutang += c.piutang; b.nota += c.nota; }
        if (c.omzet > best.v) best = { v: c.omzet, m, d: day };
      }
    }
    const tot = bulan.reduce((a, b) => ({ omzet: a.omzet + b.omzet, cash: a.cash + b.cash, piutang: a.piutang + b.piutang, nota: a.nota + b.nota }), { omzet: 0, cash: 0, piutang: 0, nota: 0 });
    const jalan = bulan.filter((b) => b.omzet > 0).length; // rata-rata hanya dari bulan yang ada omzetnya
    const bestM = bulan.reduce((a, b, i) => (b.omzet > a.v ? { v: b.omzet, m: i } : a), { v: 0, m: -1 });
    let maxC = 0, maxP = 0, maxO = 0, maxN = 0;
    grid.forEach((col) => col.forEach((c) => { if (c && !c.fut) { maxC = Math.max(maxC, c.cash); maxP = Math.max(maxP, c.piutang); maxO = Math.max(maxO, c.omzet); maxN = Math.max(maxN, c.nota); } }));
    return { y, grid, bulan, tot, jalan, best, bestM, max: { cash: maxC, piutang: maxP, omzet: maxO, nota: maxN } };
  }, [d]);
}

export function OmzetHarianPage() {
  const toast = useToast();
  const { can } = useAuth();
  const [tahun, setTahun] = useState(String(new Date().getFullYear()));
  const [mode, setMode] = useState<Mode>('split');
  const [sel, setSel] = useState<{ m: number; d: number } | null>(null);
  const q = useQuery({ queryKey: ['report', 'daily_year', tahun], queryFn: () => api<Res>('report.daily_year', { tahun }) });
  const g = useGrid(q.data);
  const today = q.data?.today || '';
  const curM = g && today.slice(0, 4) === String(g.y) ? Number(today.slice(5, 7)) - 1 : -1;
  const isToday = (m: number, d: number) => g && today === `${g.y}-${pad(m + 1)}-${pad(d)}`;
  const def = curM >= 0 ? { m: curM, d: Number(today.slice(8, 10)) } : null;
  const cur = sel || def;
  const selCell = g && cur ? g.grid[cur.m][cur.d] : null;
  const pc = g && g.tot.omzet ? Math.round((g.tot.cash / g.tot.omzet) * 100) : 0;

  const doExport = () => {
    if (!g) return;
    const rowsSplit = [], rowsO = [], rowsN = [];
    for (let d = 1; d <= 31; d++) {
      const a: Record<string, unknown> = { Tgl: d }, o: Record<string, unknown> = { Tgl: d }, n: Record<string, unknown> = { Tgl: d };
      BLN.forEach((b, m) => { const c = g.grid[m][d]; const ok = c && !c.fut; a[`${b} Cash`] = ok ? c.cash : ''; a[`${b} Piutang`] = ok ? c.piutang : ''; o[b] = ok ? c.omzet : ''; n[b] = ok ? c.nota : ''; });
      rowsSplit.push(a); rowsO.push(o); rowsN.push(n);
    }
    const tS: Record<string, unknown> = { Tgl: 'Total' }, tO: Record<string, unknown> = { Tgl: 'Total' }, tN: Record<string, unknown> = { Tgl: 'Total' };
    g.bulan.forEach((b, m) => { tS[`${BLN[m]} Cash`] = b.cash; tS[`${BLN[m]} Piutang`] = b.piutang; tO[BLN[m]] = b.omzet; tN[BLN[m]] = b.nota; });
    const moneyS = BLN.flatMap((b) => [`${b} Cash`, `${b} Piutang`]);
    exportBook([
      { name: 'Cash & Piutang', rows: rowsSplit, money: moneyS, totals: tS },
      { name: 'Omzet', rows: rowsO, money: BLN, totals: tO },
      { name: 'Nota', rows: rowsN, totals: tN },
    ], `Omzet_Harian_${g.y}.xlsx`, { subtitle: `Tahun ${g.y} · nota tidak termasuk batal · cash = sudah dibayar, piutang = sisa per ${today}` })
      .catch((e) => toast('Gagal export: ' + ((e as Error)?.message || e), 'err'));
  };

  return (
    <>
      <PageHeader title="Omzet Harian" desc="Omzet per tanggal dari nota yang dibuat (tidak termasuk batal), dibagi Cash (sudah dibayar: tunai, transfer, DP) dan Piutang (sisa belum dibayar). Angka di tabel dalam ribuan rupiah."
        actions={<div className="flex flex-wrap items-center gap-2">
          <select id="omz-tahun" className="input w-auto" value={tahun} onChange={(e) => { setTahun(e.target.value); setSel(null); }}>
            {(q.data?.tahun_tersedia || [tahun]).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="inline-flex rounded-xl border border-line bg-surface p-0.5" role="group" aria-label="Tampilkan">
            {([['split', 'Cash & Piutang'], ['omzet', 'Omzet'], ['nota', 'Nota']] as const).map(([k, l]) => (
              <button key={k} id={`omz-mode-${k}`} aria-pressed={mode === k} onClick={() => setMode(k)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${mode === k ? 'bg-brand text-white' : 'text-muted hover:text-ink'}`}>{l}</button>
            ))}
          </div>
          {can('laporan', 'ekspor') && <button className="btn btn-excel" onClick={doExport} disabled={!g}><Download size={16} />Excel</button>}
        </div>} />
      <ErrorBox error={q.error} />

      {g && (
        <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <div className="card tint tint-orange p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-muted">Omzet {g.y}</div>
            <div className="num mt-1.5 text-xl font-extrabold sm:text-2xl">{rp(g.tot.omzet)}</div>
            <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-sunk"><div className="bg-ok" style={{ width: `${pc}%` }} /><div className="bg-bad" style={{ width: `${g.tot.omzet ? 100 - pc : 0}%` }} /></div>
            <div className="mt-1.5 flex justify-between text-xs"><span className="text-ok">Cash {pc}%</span><b className="num text-ok">{rp(g.tot.cash)}</b></div>
            <div className="flex justify-between text-xs"><span className="text-bad">Piutang {g.tot.omzet ? 100 - pc : 0}%</span><b className="num text-bad">{rp(g.tot.piutang)}</b></div>
          </div>
          <div className="card p-4"><div className="text-xs font-bold uppercase tracking-wider text-muted">Rata-rata per bulan</div><div className="num mt-1.5 text-xl font-extrabold">{rp(g.jalan ? g.tot.omzet / g.jalan : 0)}</div><div className="mt-0.5 text-xs text-muted">{g.jalan} bulan dengan omzet · {nf(g.tot.nota)} nota</div></div>
          <div className="card p-4"><div className="text-xs font-bold uppercase tracking-wider text-muted">Bulan terbaik</div><div className="mt-1.5 text-xl font-extrabold">{g.bestM.m >= 0 && g.bestM.v ? BLN_L[g.bestM.m] : '–'}</div><div className="num mt-0.5 text-xs text-muted">{g.bestM.v ? rp(g.bestM.v) : 'belum ada omzet'}</div></div>
          <div className="card p-4"><div className="text-xs font-bold uppercase tracking-wider text-muted">Hari terbaik</div><div className="mt-1.5 text-xl font-extrabold">{g.best.v ? `${g.best.d} ${BLN[g.best.m]}` : '–'}</div><div className="num mt-0.5 text-xs text-muted">{g.best.v ? `${rp(g.best.v)} · ${HARI[g.grid[g.best.m][g.best.d]!.dow]}` : 'belum ada omzet'}</div></div>
        </div>
      )}

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 text-xs text-muted">
          <span>{mode === 'nota' ? 'Jumlah nota per tanggal' : mode === 'split' ? 'Cash & piutang · ribuan rupiah (2.808 = Rp 2.808.000) · cash + piutang = omzet' : 'Omzet · ribuan rupiah (2.808 = Rp 2.808.000)'}</span>
          <span className="flex flex-wrap items-center gap-3">
            {mode === 'split' ? <>
              <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm" style={{ background: `rgba(${C_CASH},.4)` }} />cash</span>
              <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm" style={{ background: `rgba(${C_PIU},.4)` }} />piutang</span>
            </> : <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-brand/50" />makin tua = makin besar</span>}
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm border-2 border-brand" />hari ini</span>
          </span>
        </div>
        {q.isLoading || !g ? <div className="h-96 animate-pulse bg-sunk" /> : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="omz" style={{ minWidth: mode === 'split' ? 1900 : 1100 }} aria-label={`Omzet harian ${g.y}`}>
              <thead>
                <tr>
                  <th className="tgl" rowSpan={mode === 'split' ? 2 : 1}>Tgl</th>
                  {BLN.map((b, m) => <th key={b} colSpan={mode === 'split' ? 2 : 1} className={m === curM ? 'cur' : ''}>{b}</th>)}
                </tr>
                {mode === 'split' && <tr className="r2">{BLN.map((b, m) => <FragmentTh key={b} cur={m === curM} />)}</tr>}
              </thead>
              <tbody>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <tr key={d}>
                    <td className="tgl">{d}</td>
                    {BLN.map((b, m) => {
                      const c = g.grid[m][d];
                      const span = mode === 'split' ? 2 : 1;
                      if (!c) return span === 2 ? [<td key={b + 'a'} className="v na" />, <td key={b + 'b'} className="v na pt" />] : <td key={b} className="v na" />;
                      const base = `v ${c.dow === 0 ? 'wk' : ''} ${isToday(m, d) ? 'today' : ''} ${sel?.m === m && sel?.d === d ? 'sel' : ''}`;
                      const pick = () => !c.fut && setSel({ m, d });
                      const title = `${HARI[c.dow]}, ${d} ${BLN_L[m]}`;
                      if (c.fut) return span === 2 ? [<td key={b + 'a'} className={base + ' fut'}>–</td>, <td key={b + 'b'} className={base + ' fut pt'}>–</td>] : <td key={b} className={base + ' fut'}>–</td>;
                      if (mode === 'split') return [
                        <td key={b + 'a'} className={`${base} num${c.cash ? '' : ' zero'}`} style={{ background: heat(C_CASH, c.cash, g.max.cash) }} title={`${title} · cash ${rp(c.cash)}`} onClick={pick}>{c.nota ? rb(c.cash) : '·'}</td>,
                        <td key={b + 'b'} className={`${base} num pt${c.piutang ? '' : ' zero'}`} style={{ background: heat(C_PIU, c.piutang, g.max.piutang) }} title={`${title} · piutang ${rp(c.piutang)}`} onClick={pick}>{c.nota ? rb(c.piutang) : '·'}</td>,
                      ];
                      const v = mode === 'omzet' ? c.omzet : c.nota;
                      return <td key={b} className={`${base} num${v ? '' : ' zero'}`} style={{ background: v ? `rgb(var(--brand) / ${(0.06 + 0.44 * (v / (mode === 'omzet' ? g.max.omzet : g.max.nota))).toFixed(3)})` : undefined }} title={`${title} · ${mode === 'omzet' ? rp(v) : v + ' nota'}`} onClick={pick}>{v ? (mode === 'omzet' ? rb(v) : nf(v)) : '·'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {(mode === 'split' ? [
                  ['total', 'Total', (m: number) => [rb(g.bulan[m].cash), rb(g.bulan[m].piutang)]],
                  ['', 'Persen', (m: number) => { const b = g.bulan[m]; return b.omzet ? [`${Math.round((b.cash / b.omzet) * 100)}%`, `${Math.round((b.piutang / b.omzet) * 100)}%`] : ['–', '–']; }],
                  ['', 'Omzet', (m: number) => rb(g.bulan[m].omzet)],
                  ['', 'Nota', (m: number) => nf(g.bulan[m].nota)],
                ] : [
                  ['total', mode === 'omzet' ? 'Total omzet' : 'Total nota', (m: number) => (mode === 'omzet' ? rb(g.bulan[m].omzet) : nf(g.bulan[m].nota))],
                  ['', 'Rata-rata / hari', (m: number) => { const b = g.bulan[m]; return b.hari ? (mode === 'omzet' ? rb(b.omzet / b.hari) : (b.nota / b.hari).toFixed(1).replace('.', ',')) : '–'; }],
                  ['c', 'Cash', (m: number) => rb(g.bulan[m].cash)],
                  ['p', 'Piutang', (m: number) => rb(g.bulan[m].piutang)],
                ]).map(([cls, label, f], i, arr) => {
                  const bottom = (arr.length - 1 - i) * 30;
                  return (
                    <tr key={label as string} className={cls === 'total' ? 'total' : ''}>
                      <td className="tgl" style={{ bottom }}>{label as string}</td>
                      {BLN.map((b, m) => {
                        const v = g.bulan[m].jalan ? (f as (m: number) => string | string[])(m) : (mode === 'split' && i < 2 ? ['–', '–'] : '–');
                        if (Array.isArray(v)) return [<td key={b + 'a'} className={`num ${cls === 'total' ? '' : 'c'}`} style={{ bottom }}>{v[0]}</td>, <td key={b + 'b'} className={`num pt ${cls === 'total' ? '' : 'p'}`} style={{ bottom }}>{v[1]}</td>];
                        return <td key={b} colSpan={mode === 'split' ? 2 : 1} className={`num ${mode === 'split' ? 'pt' : ''} ${cls === 'c' ? 'c' : cls === 'p' ? 'p' : ''}`} style={{ bottom }}>{v}</td>;
                      })}
                    </tr>
                  );
                })}
              </tfoot>
            </table>
          </div>
        )}
        <div className="flex min-h-[46px] flex-wrap items-baseline gap-x-5 gap-y-1 border-t border-line px-4 py-3 text-sm">
          {selCell && cur && g ? <>
            <b>{HARI[selCell.dow]}, {cur.d} {BLN_L[cur.m]} {g.y}</b>
            <span>Omzet <b className="num">{rp(selCell.omzet)}</b></span>
            <span className="text-ok">Cash <b className="num">{rp(selCell.cash)}</b></span>
            <span className="text-bad">Piutang <b className="num">{rp(selCell.piutang)}</b></span>
            <span>{nf(selCell.nota)} nota</span>
            {selCell.nota > 0 && <span className="text-muted">rata-rata {rp(selCell.omzet / selCell.nota)} / nota</span>}
          </> : <span className="text-muted">Klik salah satu tanggal untuk melihat omzet, cash, piutang, dan jumlah nota hari itu.</span>}
        </div>
      </section>
      <p className="mt-3 text-xs text-muted">Piutang mengikuti kondisi terkini: kalau nota lama dilunasi, angka cash di tanggal nota itu ikut naik dan piutangnya turun.</p>
    </>
  );
}

function FragmentTh({ cur }: { cur: boolean }) {
  return <><th className={`cs ${cur ? 'cur' : ''}`}>Cash</th><th className={`pt ${cur ? 'cur' : ''}`}>Piutang</th></>;
}

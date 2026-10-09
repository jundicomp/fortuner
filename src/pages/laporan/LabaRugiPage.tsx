import { useQuery } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, Download, Info } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DateRangeFilter, rangeFor, type DateRange } from '@/components/table/DateRangeFilter';
import { exportBook } from '@/components/table/exportXlsx';
import { ErrorBox, PageHeader } from '@/components/ui/Field';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { nf, rp, tgl, ymd } from '@/lib/format';
import { persen, type Pnl, type PnlReport } from './akuntansi';

/** Laba rugi dari buku besar: pendapatan, komponen HPP (bahan, klik, selisih opname), beban per kategori, dibanding periode sebelumnya. */
export function LabaRugiPage() {
  const { can } = useAuth();
  const nav = useNavigate();
  const [range, setRange] = useState<DateRange>(rangeFor('bulan_ini'));
  const to = range.to || ymd();
  const from = range.from || '2000-01-01';
  const q = useQuery({ queryKey: ['pnl', from, to], queryFn: () => api<PnlReport>('report.pnl', { from, to }) });
  const d = q.data;
  const a = d?.sekarang, b = d?.sebelumnya;
  const open = (akun: string) => nav(`/laporan/buku-besar?akun=${encodeURIComponent(akun)}&from=${d?.from}&to=${d?.to}`);

  const bebanAll = [...(a?.beban || []), ...(b?.beban || []).filter((x) => !a?.beban.some((y) => y.kode === x.kode))];
  const rows = (p: Pnl): [string, string, number, 'head' | 'row' | 'sub' | 'total', string?][] => [
    ['pend', 'Pendapatan penjualan', p.pendapatan, 'row', '4100'],
    ...(p.pendapatan_lain ? [['lain', 'Pendapatan lain', p.pendapatan_lain, 'row', '4900'] as [string, string, number, 'row', string]] : []),
    ['h1', 'Harga pokok penjualan (HPP)', 0, 'head'],
    ...p.hpp.filter((h) => h.nilai || ['5100', '5110'].includes(h.kode) || (b?.hpp.find((x) => x.kode === h.kode)?.nilai ?? 0)).map((h) => [h.kode, h.nama, -h.nilai || 0, 'row', h.kode] as [string, string, number, 'row', string]),
    ['thpp', 'Total HPP', -p.total_hpp || 0, 'sub'],
    ['lk', 'Laba kotor', p.laba_kotor, 'total'],
    ['h2', 'Beban usaha', 0, 'head'],
    ...bebanAll.map((x) => [x.kode, x.nama, -(p.beban.find((y) => y.kode === x.kode)?.nilai || 0) || 0, 'row', x.kode] as [string, string, number, 'row', string]),
    ['tb', 'Total beban', -p.total_beban || 0, 'sub'],
    ['lb', 'Laba bersih', p.laba_bersih, 'total'],
  ];
  const prevMap = b ? Object.fromEntries(rows(b).map((r) => [r[0], r[2]])) : {};

  const exportIt = () => {
    if (!a || !d) return;
    exportBook([{ name: 'Laba Rugi', rows: rows(a).filter((r) => r[3] !== 'head').map((r) => ({ Pos: r[1], [`${d.from} s/d ${d.to}`]: r[2], [`${d.sebelumnya.from} s/d ${d.sebelumnya.to}`]: prevMap[r[0]] ?? 0 })) }], `LabaRugi_${d.from}_sd_${d.to}.xlsx`);
  };

  return (
    <>
      <PageHeader title="Laba Rugi" desc="Disusun otomatis dari buku besar: penjualan dari nota, HPP dari pemakaian bahan (harga rata-rata) + biaya klik mesin + selisih opname, beban dari pengeluaran dan kas kecil."
        actions={<div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter value={range} onChange={setRange} id="pnl-range" />
          {can('laporan.laba', 'ekspor') && <button className="btn" onClick={exportIt} disabled={!a}><Download size={15} />Excel</button>}
        </div>} />
      <ErrorBox error={q.error} />
      {a && b && d && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Pendapatan" v={a.pendapatan + a.pendapatan_lain} prev={b.pendapatan + b.pendapatan_lain} tint="tint-blue" />
            <Kpi label="Total HPP" v={a.total_hpp} prev={b.total_hpp} tint="tint-amber" sub={persen(a.total_hpp, a.pendapatan) + ' dari penjualan'} inverse />
            <Kpi label="Laba kotor" v={a.laba_kotor} prev={b.laba_kotor} tint="tint-teal" sub={'margin ' + persen(a.laba_kotor, a.pendapatan)} />
            <Kpi label="Laba bersih" v={a.laba_bersih} prev={b.laba_bersih} tint={a.laba_bersih >= 0 ? 'tint-green' : 'tint-rose'} sub={'margin ' + persen(a.laba_bersih, a.pendapatan)} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
            <section className="card overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="border-b border-line text-left text-xs text-muted">
                  <tr><th className="px-4 py-2.5">Pos</th><th className="px-3 text-right">{tgl(d.from)} – {tgl(d.to)}</th><th className="px-3 text-right">Periode sebelumnya</th><th className="px-4 text-right">%</th></tr>
                </thead>
                <tbody>
                  {rows(a).map(([k, label, v, kind, akun]) => {
                    const pv = prevMap[k] ?? 0;
                    if (kind === 'head') return <tr key={k}><td colSpan={4} className="px-4 pb-1 pt-4 text-xs font-bold uppercase tracking-wider text-muted">{label}</td></tr>;
                    const cls = kind === 'total' ? 'border-t-2 border-line bg-sunk/60 font-extrabold' : kind === 'sub' ? 'border-t border-line font-bold' : '';
                    return (
                      <tr key={k} className={`${cls} ${akun ? 'cursor-pointer hover:bg-sunk' : ''}`} onClick={akun ? () => open(akun) : undefined} title={akun ? 'Buka buku besar akun ini' : undefined}>
                        <td className={`py-2 ${kind === 'row' ? 'pl-7 pr-4' : 'px-4'}`}>{label}</td>
                        <td className={`num px-3 text-right ${v < 0 ? 'text-bad' : ''}`}>{nf(v)}</td>
                        <td className="num px-3 text-right text-muted">{nf(pv)}</td>
                        <td className="num px-4 text-right text-xs text-muted">{kind === 'row' || kind === 'sub' ? persen(Math.abs(v), a.pendapatan) : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
            <aside className="flex flex-col gap-3">
              <section className="card p-4 text-sm">
                <h3 className="mb-2 font-bold">Komposisi HPP</h3>
                {a.hpp.filter((h) => h.nilai).map((h) => (
                  <div key={h.kode} className="mb-2">
                    <div className="flex justify-between text-xs"><span>{h.nama}</span><span className="num font-semibold">{nf(h.nilai)}</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunk"><div className="h-full rounded-full bg-brand" style={{ width: `${a.total_hpp ? Math.max(2, (Math.abs(h.nilai) / a.total_hpp) * 100) : 0}%` }} /></div>
                  </div>
                ))}
                {!a.total_hpp && <p className="text-xs text-muted">Belum ada HPP di periode ini.</p>}
              </section>
              {d.belum_hpp.item > 0 && (
                <section className="flex gap-2 rounded-xl border border-warn/40 bg-warn/5 p-3 text-xs"><Info size={15} className="mt-0.5 shrink-0 text-warn" />
                  <span><b>{d.belum_hpp.item} item</b> senilai {rp(d.belum_hpp.nilai_jual)} di periode ini belum dipotong stok (belum selesai/dibayar), jadi HPP-nya belum masuk. Laba kotor akan turun sedikit setelah item itu selesai.</span></section>
              )}
              <section className="card p-4 text-xs">
                <h3 className="mb-1 text-sm font-bold">Biaya klik mesin</h3>
                <div className="flex justify-between"><span>HPP klik (dari produksi)</span><span className="num font-semibold">{nf(a.hpp.find((h) => h.kode === '5110')?.nilai || 0)}</span></div>
                <div className="flex justify-between"><span>Tagihan klik dibayar</span><span className="num font-semibold">{nf(d.tagihan_klik)}</span></div>
                <p className="mt-2 text-muted">Tagihan vendor klik dicatat di Pengeluaran dengan kategori jenis <b>Klik mesin</b>; mengurangi Hutang biaya klik, bukan dihitung dua kali.</p>
              </section>
            </aside>
          </div>
        </>
      )}
      {q.isLoading && <div className="card p-6 text-sm text-muted">Menghitung…</div>}
    </>
  );
}

function Kpi({ label, v, prev, tint, sub, inverse }: { label: string; v: number; prev: number; tint: string; sub?: string; inverse?: boolean }) {
  const ch = prev ? ((v - prev) / Math.abs(prev)) * 100 : null;
  const good = ch == null ? null : inverse ? ch <= 0 : ch >= 0;
  return (
    <section className={`card tint ${tint} p-4`}>
      <div className="text-xs font-bold uppercase tracking-wider text-muted">{label}</div>
      <div className={`num mt-1 text-xl font-extrabold sm:text-2xl ${v < 0 ? 'text-bad' : ''}`}>{rp(v)}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
        {ch != null && <span className={`inline-flex items-center font-semibold ${good ? 'text-ok' : 'text-bad'}`}>{ch >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(ch).toFixed(1).replace('.', ',')}%</span>}
        {sub && <span>{sub}</span>}
      </div>
    </section>
  );
}

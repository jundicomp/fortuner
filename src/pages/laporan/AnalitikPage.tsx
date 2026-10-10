import { useQuery } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, Crown, Download, Minus, Table2, TrendingUp } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { LineChart, rpShort, type LineSeries } from '@/components/LineChart';
import { exportBook } from '@/components/table/exportXlsx';
import { ErrorBox, PageHeader } from '@/components/ui/Field';
import { Money } from '@/components/ui/Money';
import { api } from '@/lib/api';
import { addDays, nf, rp, tgl, ymd } from '@/lib/format';

type Grain = 'hari' | 'bulan';
interface Analytics {
  from: string; to: string; grain: Grain; keys: string[]; lihat_laba: boolean; product_id: string; material_id: string; months: string[];
  penjualan: { key: string; omzet: number; hpp: number | null; laba: number | null; qty: number; nota: number }[];
  pembelian: { key: string; total: number; transaksi: number }[] | null;
  saldo: { key: string; piutang: number; hutang: number | null }[];
  pelanggan: { rank: number; id: string; nama: string; tipe: string; omzet: number; nota: number; terbayar: number; sisa: number; porsi: number; bulanan: Record<string, number>; terakhir: string }[];
  ringkasan: {
    omzet: number; laba: number | null; margin: number | null; nota: number; pembelian: number | null; piutang: number; piutang_awal: number; hutang: number | null; hutang_awal: number | null;
    sebelumnya: { from: string; to: string; omzet: number; laba: number | null; pembelian: number | null };
  };
  produk: { id: string; kode: string; nama: string; qty: number; nota: number; omzet: number; hpp: number | null; laba: number | null; margin: number | null }[];
  bahan: { id: string; nama: string; satuan: string; qty: number; total: number }[];
}

const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const lblShort = (k: string) => (k.length === 7 ? `${BLN[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}` : `${Number(k.slice(8, 10))} ${BLN[Number(k.slice(5, 7)) - 1]}`);
const lblLong = (k: string) => (k.length === 7 ? `${BULAN[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}` : tgl(k));

const monthStart = (d: string, back: number) => { const dt = new Date(d + 'T00:00:00'); dt.setDate(1); dt.setMonth(dt.getMonth() - back); return ymd(dt); };
const PRESETS: Record<Grain, { id: string; label: string; range: () => [string, string] }[]> = {
  hari: [
    { id: '7', label: '7 hari', range: () => [addDays(ymd(), -6), ymd()] },
    { id: '30', label: '30 hari', range: () => [addDays(ymd(), -29), ymd()] },
    { id: 'bln', label: 'Bulan ini', range: () => [monthStart(ymd(), 0), ymd()] },
    { id: 'lalu', label: 'Bulan lalu', range: () => [monthStart(ymd(), 1), addDays(monthStart(ymd(), 0), -1)] },
  ],
  bulan: [
    { id: '6', label: '6 bulan', range: () => [monthStart(ymd(), 5), ymd()] },
    { id: '12', label: '12 bulan', range: () => [monthStart(ymd(), 11), ymd()] },
    { id: 'thn', label: 'Tahun ini', range: () => [`${ymd().slice(0, 4)}-01-01`, ymd()] },
    { id: 'thl', label: 'Tahun lalu', range: () => { const y = Number(ymd().slice(0, 4)) - 1; return [`${y}-01-01`, `${y}-12-31`]; } },
  ],
};

/** Analitik: kurva penjualan & laba, pembelian, saldo hutang/piutang harian/bulanan, dan top pelanggan. */
export function AnalitikPage() {
  const [grain, setGrain] = useState<Grain>('hari');
  const [preset, setPreset] = useState('30');
  const [[from, to], setRange] = useState<[string, string]>(PRESETS.hari[1].range());
  const [productId, setProductId] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [topN, setTopN] = useState(10);
  const q = useQuery({
    queryKey: ['analytics', grain, from, to, productId, materialId, topN],
    queryFn: () => api<Analytics>('analytics.get', { grain, from, to, product_id: productId, material_id: materialId, top: topN }),
    placeholderData: (prev) => prev,
  });
  const d = q.data;
  const r = d?.ringkasan;
  const periode = d ? `${tgl(d.from)} – ${tgl(d.to)}` : '';
  const prodName = d?.produk.find((p) => p.id === productId)?.nama;
  // kolom bulan di tabel pelanggan: mulai dari bulan pertama yang ada belanja, maksimal 12 bulan terakhir
  const bulanCols = useMemo(() => { if (!d) return []; const i = d.months.findIndex((m) => d.pelanggan.some((c) => c.bulanan[m])); return i < 0 ? [] : d.months.slice(i).slice(-12); }, [d]);
  const matName = d?.bahan.find((b) => b.id === materialId)?.nama;

  const pickGrain = (g: Grain) => { setGrain(g); const p = PRESETS[g][1]; setPreset(p.id); setRange(p.range()); };
  const pickPreset = (id: string) => { const p = PRESETS[grain].find((x) => x.id === id)!; setPreset(id); setRange(p.range()); };

  const exportAll = () => {
    if (!d) return;
    const sheets: Parameters<typeof exportBook>[0] = [
      { name: 'Penjualan', title: `Penjualan${prodName ? ` · ${prodName}` : ''}`, money: ['Omzet', 'HPP', 'Laba kotor'], rows: d.penjualan.map((x) => ({ [grain === 'hari' ? 'Tanggal' : 'Bulan']: lblLong(x.key), Nota: x.nota, Qty: x.qty, Omzet: x.omzet, ...(d.lihat_laba ? { HPP: x.hpp, 'Laba kotor': x.laba } : {}) })) },
      ...(d.pembelian ? [{ name: 'Pembelian', title: `Pembelian bahan${matName ? ` · ${matName}` : ''}`, money: ['Pembelian'], rows: d.pembelian.map((x) => ({ [grain === 'hari' ? 'Tanggal' : 'Bulan']: lblLong(x.key), Transaksi: x.transaksi, Pembelian: x.total })) }] : []),
      { name: 'Hutang Piutang', title: 'Saldo piutang & hutang (akhir periode)', money: ['Piutang', 'Hutang'], rows: d.saldo.map((x) => ({ [grain === 'hari' ? 'Tanggal' : 'Bulan']: lblLong(x.key), Piutang: x.piutang, ...(x.hutang != null ? { Hutang: x.hutang } : {}) })) },
      { name: `Top ${topN} Pelanggan`, money: ['Total belanja', 'Terbayar', 'Sisa', ...d.months.map(lblLong)], rows: d.pelanggan.map((c) => ({ Peringkat: c.rank, Pelanggan: c.nama, Tipe: c.tipe === 'reseller' ? 'Reseller' : 'End user', Nota: c.nota, 'Total belanja': c.omzet, 'Porsi (%)': c.porsi, Terbayar: c.terbayar, Sisa: c.sisa, ...Object.fromEntries(d.months.map((m) => [lblLong(m), c.bulanan[m] || 0])) })) },
      { name: 'Produk', money: ['Omzet', 'Laba kotor'], rows: d.produk.map((p) => ({ Kode: p.kode, Produk: p.nama, Nota: p.nota, Qty: p.qty, Omzet: p.omzet, ...(d.lihat_laba ? { 'Laba kotor': p.laba, 'Margin (%)': p.margin } : {}) })) },
    ];
    exportBook(sheets, `Analitik_${d.from}_sd_${d.to}.xlsx`, { subtitle: `Periode ${periode} · ${grain === 'hari' ? 'harian' : 'bulanan'}` });
  };

  const salesSeries: LineSeries[] = d?.lihat_laba
    ? [{ key: 'omzet', label: 'Penjualan', color: 'var(--series-1)' }, { key: 'laba', label: 'Laba kotor', color: 'var(--series-3)' }]
    : [{ key: 'omzet', label: 'Penjualan', color: 'var(--series-1)' }];
  const saldoSeries: LineSeries[] = d?.lihat_laba
    ? [{ key: 'piutang', label: 'Piutang', color: 'var(--series-1)' }, { key: 'hutang', label: 'Hutang', color: 'var(--series-2)' }]
    : [{ key: 'piutang', label: 'Piutang', color: 'var(--series-1)' }];

  return (
    <>
      <PageHeader title="Analitik" desc="Perkembangan penjualan, laba, pembelian, serta hutang & piutang dari hari ke hari atau bulan ke bulan, dan pelanggan dengan belanja terbesar."
        actions={<button className="btn btn-excel" onClick={exportAll} disabled={!d}><Download size={16} />Excel</button>} />

      {/* filter dalam satu baris */}
      <div className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="flex rounded-lg bg-sunk p-1" role="tablist" aria-label="Satuan waktu">
          {(['hari', 'bulan'] as Grain[]).map((g) => (
            <button key={g} role="tab" aria-selected={grain === g} onClick={() => pickGrain(g)} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${grain === g ? 'bg-ink text-canvas' : 'text-muted'}`}>{g === 'hari' ? 'Harian' : 'Bulanan'}</button>
          ))}
        </div>
        {PRESETS[grain].map((p) => (
          <button key={p.id} className={`chip ${preset === p.id ? 'border-ink bg-ink text-canvas' : 'hover:border-muted'}`} onClick={() => pickPreset(p.id)}>{p.label}</button>
        ))}
        <div className="flex items-center gap-1 text-xs">
          <input type="date" aria-label="Dari tanggal" className="input w-[140px] py-1.5 text-xs" value={from} max={to} onChange={(e) => { if (e.target.value) { setPreset('custom'); setRange([e.target.value, to]); } }} />
          <span className="text-muted">–</span>
          <input type="date" aria-label="Sampai tanggal" className="input w-[140px] py-1.5 text-xs" value={to} min={from} onChange={(e) => { if (e.target.value) { setPreset('custom'); setRange([from, e.target.value]); } }} />
        </div>
        <select id="an-produk" aria-label="Produk" className="input ml-auto w-auto min-w-[200px] py-1.5 text-sm" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Semua produk (global)</option>
          {(d?.produk || []).map((p) => <option key={p.id} value={p.id}>{p.kode ? `${p.kode} · ` : ''}{p.nama}</option>)}
        </select>
        {q.isFetching && <span className="text-xs text-muted">Memuat…</span>}
      </div>
      <ErrorBox error={q.error} />

      {d && r && (
        <div className="flex flex-col gap-4">
          {/* ringkasan */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label={prodName ? `Penjualan · ${prodName}` : 'Penjualan'} value={r.omzet} prev={r.sebelumnya.omzet} sub={`${nf(r.nota)} nota`} />
            {d.lihat_laba && <Kpi label="Laba kotor" value={r.laba ?? 0} prev={r.sebelumnya.laba ?? 0} sub={r.margin != null ? `margin ${String(r.margin).replace('.', ',')}%` : ''} />}
            {d.lihat_laba && <Kpi label="Pembelian bahan" value={r.pembelian ?? 0} prev={r.sebelumnya.pembelian ?? 0} upIsBad sub="dibanding periode sebelumnya" />}
            <Kpi label="Piutang (saldo akhir)" value={r.piutang} prev={r.piutang_awal} upIsBad sub="dibanding awal periode" />
            {d.lihat_laba && r.hutang != null && <Kpi label="Hutang (saldo akhir)" value={r.hutang} prev={r.hutang_awal ?? 0} upIsBad sub="dibanding awal periode" />}
          </div>

          <ChartCard title={prodName ? `Penjualan & laba kotor · ${prodName}` : 'Penjualan & laba kotor · semua produk'} sub={`Total ${rp(r.omzet)}${r.laba != null ? ` · laba kotor ${rp(r.laba)}` : ''}`}
            note={d.lihat_laba ? 'Laba kotor = penjualan − HPP (bahan dari stok + biaya klik; item yang belum dipotong stok memakai taksiran resep).' : undefined}
            table={<SeriesTable rows={d.penjualan} cols={[['omzet', 'Penjualan'], ...(d.lihat_laba ? [['hpp', 'HPP'], ['laba', 'Laba kotor']] as [string, string][] : []), ['nota', 'Nota', true]]} />}>
            <LineChart data={d.penjualan} xKey="key" series={salesSeries} xLabel={lblShort} xLabelLong={lblLong} ariaLabel="Grafik penjualan dan laba kotor" />
          </ChartCard>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {d.pembelian && (
              <ChartCard title={matName ? `Pembelian · ${matName}` : 'Pembelian bahan · semua bahan'} sub={`Total ${rp(d.pembelian.reduce((a, x) => a + x.total, 0))} · ${nf(d.pembelian.reduce((a, x) => a + x.transaksi, 0))} transaksi`}
                action={<select aria-label="Bahan" className="input w-auto py-1 text-xs" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
                  <option value="">Semua bahan</option>{d.bahan.map((b) => <option key={b.id} value={b.id}>{b.nama}</option>)}
                </select>}
                table={<SeriesTable rows={d.pembelian} cols={[['total', 'Pembelian'], ['transaksi', 'Transaksi', true]]} />}>
                <LineChart data={d.pembelian} xKey="key" series={[{ key: 'total', label: 'Pembelian', color: 'var(--series-2)' }]} xLabel={lblShort} xLabelLong={lblLong} height={220} ariaLabel="Grafik pembelian bahan" />
              </ChartCard>
            )}
            <ChartCard title={d.lihat_laba ? 'Saldo piutang & hutang' : 'Saldo piutang'} sub={`Piutang ${rp(r.piutang)}${r.hutang != null ? ` · hutang ${rp(r.hutang)}` : ''} di akhir periode`}
              note="Saldo di akhir tiap hari/bulan: naik berarti tagihan bertambah, turun berarti sudah banyak dilunasi."
              table={<SeriesTable rows={d.saldo} cols={[['piutang', 'Piutang'], ...(d.lihat_laba ? [['hutang', 'Hutang']] as [string, string][] : [])]} />}>
              <LineChart data={d.saldo} xKey="key" series={saldoSeries} xLabel={lblShort} xLabelLong={lblLong} height={220} ariaLabel="Grafik saldo piutang dan hutang" />
            </ChartCard>
          </div>

          {/* top pelanggan */}
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <Crown size={18} className="text-brand" />
              <h2 className="text-sm font-bold">Top {topN} pelanggan</h2>
              <span className="text-xs text-muted">· total belanja {periode}{bulanCols.length > 1 ? ', dengan capaian per bulan' : ''} (pelanggan umum/walk-in tidak dihitung)</span>
              <select aria-label="Jumlah pelanggan" className="input ml-auto w-auto py-1 text-xs" value={topN} onChange={(e) => setTopN(Number(e.target.value))}>
                {[10, 20, 50].map((n) => <option key={n} value={n}>Top {n}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="tbl w-full text-sm" style={{ minWidth: 760 + (bulanCols.length > 1 ? bulanCols.length * 70 : 0) }}>
                <thead><tr>
                  <th className="w-10 px-2 py-2 text-[11px]">#</th>
                  <th className="px-2 py-2 text-[11px]">PELANGGAN</th>
                  <th className="w-14 px-2 py-2 text-[11px]">NOTA</th>
                  <th className="w-44 px-2 py-2 text-[11px]">TOTAL BELANJA</th>
                  {bulanCols.length > 1 && bulanCols.map((m) => <th key={m} className="px-2 py-2 text-[11px]">{lblShort(m).toUpperCase()}</th>)}
                  <th className="w-28 px-2 py-2 text-[11px]">SISA</th>
                </tr></thead>
                <tbody>
                  {!d.pelanggan.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">Belum ada transaksi pada periode ini.</td></tr>}
                  {d.pelanggan.map((c) => {
                    const max = d.pelanggan[0]?.omzet || 1;
                    const peak = Math.max(1, ...bulanCols.map((m) => c.bulanan[m] || 0));
                    return (
                      <tr key={c.id}>
                        <td className="px-2 py-2 text-center font-bold">{c.rank <= 3 ? <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${c.rank === 1 ? 'bg-ink text-canvas' : 'bg-sunk'}`}>{c.rank}</span> : c.rank}</td>
                        <td className="min-w-[220px] px-2.5 py-2"><span className="font-semibold">{c.nama}</span> <span className={`pill ${c.tipe === 'reseller' ? 'pill-brand' : 'pill-mute'}`}>{c.tipe === 'reseller' ? 'Reseller' : 'End user'}</span>
                          <div className="text-[11px] text-muted">terakhir order {tgl(c.terakhir)} · rata-rata {rp(Math.round(c.omzet / Math.max(1, c.nota)))}/nota</div></td>
                        <td className="num px-2 py-2 text-right">{nf(c.nota)}</td>
                        <td className="px-2 py-2">
                          <Money v={c.omzet} className="font-bold" />
                          <div className="mt-1 flex items-center gap-1.5"><div className="h-1.5 flex-1 rounded-full bg-sunk"><div className="h-1.5 rounded-full" style={{ width: `${(c.omzet / max) * 100}%`, background: 'var(--series-1)' }} /></div><span className="num w-11 text-right text-[11px] text-muted">{String(c.porsi).replace('.', ',')}%</span></div>
                        </td>
                        {bulanCols.length > 1 && bulanCols.map((m) => {
                          const v = c.bulanan[m] || 0;
                          return <td key={m} className="px-2 py-2 text-right" title={`${lblLong(m)}: ${rp(v)}`}>
                            <div className="num text-xs font-semibold">{v ? rpShort(v) : '–'}</div>
                            <div className="ml-auto mt-1 h-1 rounded-full" style={{ width: `${(v / peak) * 100}%`, background: 'var(--series-1)', opacity: 0.55 }} />
                          </td>;
                        })}
                        <td className={`px-2 py-2 ${c.sisa > 0 ? 'text-bad' : 'text-muted'}`}>{c.sisa > 0 ? <Money v={c.sisa} /> : 'Lunas'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* produk terlaris */}
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <TrendingUp size={18} className="text-brand" /><h2 className="text-sm font-bold">Produk terjual</h2>
              <span className="text-xs text-muted">· klik baris untuk melihat kurva penjualan produk itu</span>
              {productId && <button className="btn btn-sm ml-auto" onClick={() => setProductId('')}>Kembali ke semua produk</button>}
            </div>
            <div className="max-h-[420px] overflow-auto">
              <table className="tbl w-full min-w-[640px] text-sm">
                <thead className="sticky top-0"><tr>
                  <th className="w-14 px-2 py-2 text-[11px]">KODE</th><th className="px-2 py-2 text-[11px]">PRODUK</th><th className="w-16 px-2 py-2 text-[11px]">NOTA</th><th className="w-20 px-2 py-2 text-[11px]">QTY</th>
                  <th className="w-36 px-2 py-2 text-[11px]">PENJUALAN</th>{d.lihat_laba && <><th className="w-36 px-2 py-2 text-[11px]">LABA KOTOR</th><th className="w-20 px-2 py-2 text-[11px]">MARGIN</th></>}
                </tr></thead>
                <tbody>
                  {d.produk.map((p) => (
                    <tr key={p.id} className={`cursor-pointer ${p.id === productId ? 'bg-brand/10' : 'hover:bg-sunk'}`} onClick={() => { setProductId(p.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                      <td className="px-2 py-1.5 text-center font-mono text-xs">{p.kode || '–'}</td>
                      <td className="px-2.5 py-1.5 font-semibold">{p.nama}</td>
                      <td className="num px-2 py-1.5 text-right">{nf(p.nota)}</td>
                      <td className="num px-2 py-1.5 text-right">{nf(p.qty)}</td>
                      <td className="px-2 py-1.5"><Money v={p.omzet} /></td>
                      {d.lihat_laba && <><td className={`px-2 py-1.5 ${(p.laba ?? 0) < 0 ? 'text-bad' : ''}`}><Money v={p.laba} /></td><td className="num px-2 py-1.5 text-right">{p.margin != null ? `${String(p.margin).replace('.', ',')}%` : '–'}</td></>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function Kpi({ label, value, prev, sub, upIsBad }: { label: string; value: number; prev: number; sub?: string; upIsBad?: boolean }) {
  const diff = value - prev;
  const pct = prev ? Math.round((diff / Math.abs(prev)) * 1000) / 10 : null;
  const good = upIsBad ? diff < 0 : diff > 0;
  const Icon = diff === 0 ? Minus : diff > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="card p-4">
      <div className="truncate text-xs font-semibold text-muted" title={label}>{label}</div>
      <div className="num mt-1 text-xl font-extrabold tracking-tight">{rp(value)}</div>
      <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px]">
        <span className={`inline-flex items-center gap-0.5 font-bold ${diff === 0 ? 'text-muted' : good ? 'text-ok' : 'text-bad'}`}>
          <Icon size={13} aria-hidden />{pct != null ? `${pct > 0 ? '+' : ''}${String(pct).replace('.', ',')}%` : diff ? rpShort(diff) : '0'}
          <span className="sr-only">{diff > 0 ? 'naik' : diff < 0 ? 'turun' : 'tetap'}</span>
        </span>
        <span className="text-muted">{sub}</span>
      </div>
    </div>
  );
}

function ChartCard({ title, sub, note, action, table, children }: { title: string; sub?: string; note?: string; action?: ReactNode; table: ReactNode; children: ReactNode }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className="card p-4">
      <div className="mb-3 flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1"><h2 className="text-sm font-bold">{title}</h2>{sub && <div className="num text-xs text-muted">{sub}</div>}</div>
        {action}
        <button className={`btn btn-sm ${showTable ? 'border-ink' : ''}`} onClick={() => setShowTable((s) => !s)} aria-pressed={showTable}><Table2 size={14} />{showTable ? 'Grafik' : 'Tabel'}</button>
      </div>
      {showTable ? table : children}
      {note && <p className="mt-2 text-[11px] text-muted">{note}</p>}
    </section>
  );
}

function SeriesTable({ rows, cols }: { rows: Record<string, unknown>[]; cols: [string, string, boolean?][] }) {
  const sums = useMemo(() => Object.fromEntries(cols.map(([k]) => [k, rows.reduce((a, r) => a + (Number(r[k]) || 0), 0)])), [rows, cols]);
  return (
    <div className="max-h-[300px] overflow-auto">
      <table className="tbl w-full text-sm">
        <thead className="sticky top-0"><tr><th className="px-2 py-1.5 text-[11px]">PERIODE</th>{cols.map(([k, l]) => <th key={k} className="px-2 py-1.5 text-[11px]">{l.toUpperCase()}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r.key)}><td className="px-2 py-1">{lblLong(String(r.key))}</td>{cols.map(([k, , plain]) => <td key={k} className="px-2 py-1 text-right">{plain ? <span className="num">{nf(Number(r[k]))}</span> : r[k] == null ? '–' : <Money v={Number(r[k])} />}</td>)}</tr>
          ))}
        </tbody>
        {!cols.some(([k]) => k === 'piutang') && <tfoot><tr><td className="px-2 py-1.5 font-bold">Total</td>{cols.map(([k, , plain]) => <td key={k} className="px-2 py-1.5 text-right font-bold">{plain ? nf(sums[k]) : <Money v={sums[k]} />}</td>)}</tr></tfoot>}
      </table>
    </div>
  );
}

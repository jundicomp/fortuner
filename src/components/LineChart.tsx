import { useEffect, useMemo, useRef, useState } from 'react';
import { nf } from '@/lib/format';

export interface LineSeries { key: string; label: string; color: string /* var(--series-n) */; dashed?: boolean }
interface Props {
  data: Record<string, number | string | null>[];
  xKey: string;
  series: LineSeries[];
  xLabel: (k: string) => string;
  xLabelLong?: (k: string) => string;
  height?: number;
  ariaLabel: string;
}

/** 1.250.000 → "1,25jt" · 61.000 → "61rb" (sumbu & label ringkas). */
export const rpShort = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? '−' : '';
  if (a >= 1e9) return `${s}${(a / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })}M`;
  if (a >= 1e6) return `${s}${(a / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })}jt`;
  if (a >= 1e3) return `${s}${(a / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 0 })}rb`;
  return `${s}${nf(a)}`;
};

function niceTicks(min: number, max: number, n = 4) {
  if (max === min) { max = min + 1; }
  const raw = (max - min) / n;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) || raw;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const t: number[] = []; for (let v = lo; v <= hi + step / 2; v += step) t.push(Math.round(v));
  return t;
}

/**
 * Grafik garis satu sumbu (Rupiah) dengan crosshair + tooltip semua seri, legenda (≥2 seri),
 * dan label langsung di ujung kanan. Warna diambil dari variabel CSS --series-n (terang & gelap).
 */
export function LineChart({ data, xKey, series, xLabel, xLabelLong, height = 260, ariaLabel }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const pad = { l: 52, r: series.length > 1 ? 86 : 16, t: 12, b: 28 };
  const iw = w - pad.l - pad.r, ih = height - pad.t - pad.b;
  const vals = data.flatMap((d) => series.map((s) => d[s.key])).filter((v): v is number => typeof v === 'number');
  const ticks = useMemo(() => niceTicks(Math.min(0, ...vals), Math.max(0, ...vals)), [vals.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const x = (i: number) => pad.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - ((v - y0) / (y1 - y0 || 1)) * ih;
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(iw / 64))));

  const paths = series.map((s) => {
    let d = '', pen = false;
    data.forEach((r, i) => { const v = r[s.key]; if (typeof v !== 'number') { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true; });
    return d;
  });
  // label ujung kanan: geser supaya tidak bertumpuk
  const ends = series.map((s, si) => { const last = [...data].reverse().find((r) => typeof r[s.key] === 'number'); return { si, y: last ? y(last[s.key] as number) : pad.t }; }).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = data.length <= 1 ? 0 : Math.round((px / r.width) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  const hv = hover != null ? data[hover] : null;
  const tipLeft = hover != null ? Math.min(Math.max(x(hover) + 12, 8), w - 210) : 0;

  return (
    <div ref={box} className="relative w-full select-none">
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-hidden>
          {series.map((s) => <span key={s.key} className="inline-flex items-center gap-1.5"><svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dashed ? '4 3' : undefined} strokeLinecap="round" /></svg>{s.label}</span>)}
        </div>
      )}
      <svg width={w} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={pad.l + iw} y1={y(t)} y2={y(t)} className={t === 0 ? 'stroke-line' : 'stroke-line/50'} strokeWidth={1} strokeDasharray={t === 0 ? undefined : '2 4'} />
            <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px]">{rpShort(t)}</text>
          </g>
        ))}
        {data.map((r, i) => ((i % every === 0 && (data.length - 1 - i >= every * 0.6 || i === 0)) || i === data.length - 1) && (
          <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} className="fill-muted text-[11px]">{xLabel(String(r[xKey]))}</text>
        ))}
        {paths.map((d, si) => <path key={series[si].key} d={d} fill="none" stroke={series[si].color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={series[si].dashed ? '5 4' : undefined} />)}
        {data.length <= 45 && series.map((s) => data.map((r, i) => typeof r[s.key] === 'number' && (
          <circle key={`${s.key}${i}`} cx={x(i)} cy={y(r[s.key] as number)} r={2.2} fill={s.color} />
        )))}
        {series.length > 1 && ends.map((e) => (
          <text key={e.si} x={pad.l + iw + 8} y={e.y} dy="0.32em" className="fill-ink text-[11px] font-semibold">{series[e.si].label}</text>
        ))}
        {hover != null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="stroke-muted" strokeWidth={1} />
            {series.map((s) => typeof data[hover][s.key] === 'number' && (
              <circle key={s.key} cx={x(hover)} cy={y(data[hover][s.key] as number)} r={4.5} fill={s.color} className="stroke-surface" strokeWidth={2} />
            ))}
          </g>
        )}
        <rect x={pad.l} y={pad.t} width={Math.max(1, iw)} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hv && (
        <div className="pointer-events-none absolute z-10 min-w-[180px] rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg" style={{ left: tipLeft, top: series.length > 1 ? 28 : 4 }}>
          <div className="mb-1 font-semibold text-muted">{(xLabelLong || xLabel)(String(hv[xKey]))}</div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <svg width="12" height="4" aria-hidden><line x1="0" y1="2" x2="12" y2="2" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" /></svg>
              <span className="num ml-auto font-bold">{typeof hv[s.key] === 'number' ? `Rp ${nf(hv[s.key] as number)}` : '–'}</span>
              <span className="w-20 text-muted">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

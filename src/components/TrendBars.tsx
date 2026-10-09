import { useState } from 'react';
import { nf, rp } from '@/lib/format';

interface Point { tanggal: string; omzet: number; masuk: number }
const SERIES = [
  { key: 'omzet' as const, label: 'Omzet (nota dibuat)', color: 'var(--chart-1)' },
  { key: 'masuk' as const, label: 'Uang masuk', color: 'var(--chart-2)' },
];

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
const short = (v: number) => (v >= 1e6 ? `${nf(v / 1e6)} jt` : v >= 1e3 ? `${nf(v / 1e3)} rb` : nf(v));

/** Batang berpasangan per hari, satu sumbu rupiah. Hover/sentuh menampilkan nilai. */
export function TrendBars({ data, tick, label: labelFn, height = 'h-44' }: { data: Point[]; tick?: (s: string) => string; label?: (s: string) => string; height?: string }) {
  const [hi, setHi] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.omzet, d.masuk)), 0));
  const ticks = [0, 0.5, 1].map((t) => t * max);
  const h = hi == null ? null : data[hi];
  const day = tick || ((s: string) => String(Number(s.slice(8))));
  const step = Math.max(1, Math.ceil(data.length / 16));
  const label = labelFn || ((s: string) => new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {SERIES.map((s) => <span key={s.key} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</span>)}
        <span className="ml-auto min-h-[16px] text-ink">
          {h ? <><b>{label(h.tanggal)}</b> · omzet <b className="num">{rp(h.omzet)}</b> · masuk <b className="num">{rp(h.masuk)}</b></> : <span className="text-muted">Arahkan ke batang untuk melihat angka</span>}
        </span>
      </div>
      <div className="grid grid-cols-[44px_1fr] gap-2">
        <div className={`relative ${height} text-right text-[10.5px] text-muted`}>
          {ticks.map((t) => <span key={t} className="num absolute right-0 -translate-y-1/2" style={{ top: `${100 - (t / max) * 100}%` }}>{short(t)}</span>)}
        </div>
        <div className={`relative ${height}`}>
          {ticks.map((t) => <div key={t} className="absolute inset-x-0 border-t border-line" style={{ top: `${100 - (t / max) * 100}%` }} />)}
          <div className="absolute inset-0 flex items-end gap-[3px] sm:gap-1.5" onMouseLeave={() => setHi(null)}>
            {data.map((d, i) => (
              <button key={d.tanggal} type="button" aria-label={`${label(d.tanggal)}: omzet ${rp(d.omzet)}, uang masuk ${rp(d.masuk)}`}
                className={`flex h-full flex-1 items-end justify-center gap-[2px] rounded-sm px-[1px] ${hi === i ? 'bg-sunk' : ''}`}
                onMouseEnter={() => setHi(i)} onFocus={() => setHi(i)} onClick={() => setHi(i)}>
                {SERIES.map((s) => (
                  <span key={s.key} className="w-full max-w-[14px] rounded-t-[3px]" style={{ height: `${(d[s.key] / max) * 100}%`, minHeight: d[s.key] ? 2 : 0, background: s.color, opacity: hi == null || hi === i ? 1 : 0.45 }} />
                ))}
              </button>
            ))}
          </div>
        </div>
        <div />
        <div className="flex gap-[3px] text-center text-[10.5px] text-muted sm:gap-1.5">
          {data.map((d, i) => <span key={d.tanggal} className={`num flex-1 ${i === data.length - 1 ? 'font-bold text-ink' : ''} ${i % step ? 'invisible' : i % (step * 2) && data.length > 10 ? 'max-sm:invisible' : ''}`}>{day(d.tanggal)}</span>)}
        </div>
      </div>
    </div>
  );
}

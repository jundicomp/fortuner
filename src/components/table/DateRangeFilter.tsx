import { CalendarDays } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { addDays, tgl, ymd } from '@/lib/format';

export type Preset = 'semua' | 'hari_ini' | 'kemarin' | '7_hari' | '30_hari' | 'bulan_ini' | 'bulan_lalu' | 'tahun_ini' | 'custom';
export interface DateRange { preset: Preset; from: string; to: string }

const LABEL: Record<Preset, string> = {
  semua: 'Semua tanggal', hari_ini: 'Hari ini', kemarin: 'Kemarin', '7_hari': '7 hari terakhir', '30_hari': '30 hari terakhir',
  bulan_ini: 'Bulan ini', bulan_lalu: 'Bulan lalu', tahun_ini: 'Tahun ini', custom: 'Pilih tanggal',
};

export function rangeFor(p: Preset): DateRange {
  const t = ymd();
  const d = new Date();
  switch (p) {
    case 'hari_ini': return { preset: p, from: t, to: t };
    case 'kemarin': { const k = addDays(t, -1); return { preset: p, from: k, to: k }; }
    case '7_hari': return { preset: p, from: addDays(t, -6), to: t };
    case '30_hari': return { preset: p, from: addDays(t, -29), to: t };
    case 'bulan_ini': return { preset: p, from: ymd(new Date(d.getFullYear(), d.getMonth(), 1)), to: t };
    case 'bulan_lalu': return { preset: p, from: ymd(new Date(d.getFullYear(), d.getMonth() - 1, 1)), to: ymd(new Date(d.getFullYear(), d.getMonth(), 0)) };
    case 'tahun_ini': return { preset: p, from: `${d.getFullYear()}-01-01`, to: t };
    default: return { preset: p === 'custom' ? 'custom' : 'semua', from: '', to: '' };
  }
}

export function DateRangeFilter({ value, onChange, id }: { value: DateRange; onChange: (r: DateRange) => void; id: string }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState(value.to);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  useEffect(() => { setFrom(value.from); setTo(value.to); }, [value]);

  const active = value.from || value.to;
  const text = value.preset === 'custom' ? `${value.from ? tgl(value.from) : '…'} – ${value.to ? tgl(value.to) : '…'}` : LABEL[value.preset];

  return (
    <div className="relative" ref={ref}>
      <button id={id} className={`btn ${active ? 'border-brand text-brand' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <CalendarDays size={16} /><span className="max-w-[170px] truncate">{text}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-line bg-surface p-3 shadow-xl">
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(LABEL) as Preset[]).filter((p) => p !== 'custom').map((p) => (
              <button key={p} className={`rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold ${value.preset === p ? 'bg-brand text-brand-ink' : 'hover:bg-sunk'}`}
                onClick={() => { onChange(rangeFor(p)); setOpen(false); }}>{LABEL[p]}</button>
            ))}
          </div>
          <div className="mt-3 border-t border-line pt-3">
            <div className="mb-2 text-xs font-bold text-muted">Rentang sendiri</div>
            <div className="grid grid-cols-2 gap-2">
              <input id={`${id}-from`} type="date" className="input px-2 py-1.5 text-xs" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="Dari tanggal" />
              <input id={`${id}-to`} type="date" className="input px-2 py-1.5 text-xs" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="Sampai tanggal" />
            </div>
            <button className="btn btn-primary btn-sm mt-2 w-full" disabled={!from && !to} onClick={() => { onChange({ preset: 'custom', from, to }); setOpen(false); }}>Terapkan</button>
          </div>
        </div>
      )}
    </div>
  );
}

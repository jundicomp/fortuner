import { CUT_KEYS, CUT_SIZES, type TierKey } from '@/lib/pricing';
import { nf } from '@/lib/format';
import type { JenisHarga, PriceRow } from '@/types';

type Vals = Partial<Record<TierKey, number | null>>;

/** Sedikit dulu (oranye), lalu Banyak (hijau). */
const COLS: { key: 'rs' | 'rb'; e: TierKey; label: string; sub: (m: number) => string; head: string; bg: string }[] = [
  { key: 'rs', e: 'es', label: 'Sedikit', sub: (m) => `< ${m}`, head: '#B45309', bg: 'rgb(180 83 9 / 0.07)' },
  { key: 'rb', e: 'eb', label: 'Banyak', sub: (m) => `≥ ${m}`, head: '#14532D', bg: 'rgb(21 128 61 / 0.07)' },
];

interface Cost { modal?: number | null; marginMin?: number }

/** Laba kotor per unit & persentasenya dari harga jual; hijau aman, kuning tipis, merah rugi. */
export function Laba({ harga, modal, marginMin = 20 }: { harga?: number | null; modal?: number | null; marginMin?: number }) {
  if (!harga || modal == null || !(modal > 0)) return null;
  const laba = harga - modal;
  const pct = (laba / harga) * 100;
  const cls = laba < 0 ? 'text-bad' : pct < marginMin ? 'text-warn' : 'text-ok';
  return (
    <div className={`num mt-0.5 flex justify-between gap-1 text-[10.5px] font-bold ${cls}`}>
      <span>{laba >= 0 ? '+' : '−'}{nf(Math.abs(laba))}</span><span>{pct.toFixed(1).replace('.', ',')}%{laba < 0 ? ' rugi' : pct < marginMin ? ' tipis' : ''}</span>
    </div>
  );
}

function Cell({ k, vals, before, onChange, idPrefix, modal, marginMin }: { k: TierKey; vals: Vals; before?: Vals | null; onChange?: (k: TierKey, v: number | null) => void; idPrefix: string } & Cost) {
  const v = vals[k];
  const b = before?.[k];
  const pct = b && v != null && v !== b ? ((v - b) / b) * 100 : null;
  if (!onChange) return <div><span className="num font-semibold">{v == null ? <span className="text-muted/60">–</span> : nf(v)}</span><Laba harga={v} modal={modal} marginMin={marginMin} /></div>;
  return (
    <div className="flex flex-col">
      <input id={`${idPrefix}-${k}`} className="input num px-2 py-1.5 text-right font-bold" inputMode="numeric" value={v == null ? '' : nf(v)} placeholder="–"
        onChange={(e) => { const s = e.target.value.replace(/[^\d]/g, ''); onChange(k, s === '' ? null : Number(s)); }} />
      {pct != null && <span className={`num text-right text-[10.5px] font-bold ${pct > 0 ? 'text-bad' : 'text-ok'}`}>{pct > 0 ? '+' : ''}{pct.toFixed(1)}% dari harga lama</span>}
      <Laba harga={v} modal={modal} marginMin={marginMin} />
    </div>
  );
}

/** Tampilan/isian harga sesuai jenis harga produk. `modal` = modal per unit untuk menampilkan laba kotor. */
export function PriceGrid({ jenis, vals, before, onChange, minQty = 26, idPrefix = 'price', sisi, modal, marginMin }: { jenis: JenisHarga; vals: Vals | PriceRow; before?: Vals | PriceRow | null; onChange?: (k: TierKey, v: number | null) => void; minQty?: number; idPrefix?: string; sisi?: number } & Cost) {
  const V = vals as Vals, B = before as Vals | null | undefined;
  const cp = { vals: V, before: B, onChange, idPrefix, modal, marginMin };
  if (jenis === 'manual') return <p className="text-sm text-muted">Harga produk ini diisi CS saat transaksi.</p>;
  if (jenis === 'tetap') {
    return (
      <div className="max-w-[220px]">
        <div className="mb-1 text-xs font-semibold text-muted">Harga untuk semua konsumen</div>
        <Cell k="rb" {...cp} />
      </div>
    );
  }
  if (jenis === 'cutting') {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CUT_KEYS.map((k, i) => (
          <div key={k}><div className="mb-1 text-xs font-semibold text-muted">{CUT_SIZES[i]}</div><Cell k={k} {...cp} /></div>
        ))}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      {sisi != null && modal == null && <div className="mb-1.5 text-xs text-muted">Harga per lembar untuk cetak <b className="text-ink">{Number(sisi) === 2 ? '2 sisi (BB)' : '1 sisi'}</b>.</div>}
      <table className="w-full min-w-[300px] border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="w-[84px]" />
            {COLS.map((c, i) => (
              <th key={c.key} className={`px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-white ${i === 0 ? 'rounded-tl-lg' : 'rounded-tr-lg'}`} style={{ background: c.head }}>
                {c.label} {c.sub(minQty)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(['r', 'e'] as const).map((t) => (
            <tr key={t}>
              <td className="border border-line py-2 pl-2 pr-1 font-semibold">{t === 'r' ? 'Reseller' : 'End user'}</td>
              {COLS.map((c) => {
                const k = (t === 'r' ? c.key : c.e) as TierKey;
                return <td key={k} className="border border-line px-1.5 py-1.5 align-top" style={{ background: c.bg }}><Cell k={k} {...cp} /></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Ringkasan satu baris untuk tabel produk. */
export function priceSummary(jenis: JenisHarga, h?: PriceRow | null) {
  if (jenis === 'manual') return 'Manual';
  if (!h) return '';
  if (jenis === 'tetap') return nf(h.rb);
  if (jenis === 'cutting') return CUT_KEYS.map((k) => nf(h[k])).join(' / ');
  return `R ${nf(h.rb)} · E ${nf(h.eb ?? h.rb)}`;
}

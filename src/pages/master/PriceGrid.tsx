import { CUT_KEYS, CUT_SIZES, type TierKey } from '@/lib/pricing';
import { nf } from '@/lib/format';
import type { JenisHarga, PriceRow } from '@/types';

type Vals = Partial<Record<TierKey, number | null>>;

const ROWS: { label: string; keys: [TierKey, TierKey, TierKey, TierKey] }[] = [
  { label: 'Reseller', keys: ['rb', 'rb_bb', 'rs', 'rs_bb'] },
  { label: 'End user', keys: ['eb', 'eb_bb', 'es', 'es_bb'] },
];

function Cell({ k, vals, before, onChange, idPrefix }: { k: TierKey; vals: Vals; before?: Vals | null; onChange?: (k: TierKey, v: number | null) => void; idPrefix: string }) {
  const v = vals[k];
  const b = before?.[k];
  const pct = b && v != null && v !== b ? ((v - b) / b) * 100 : null;
  if (!onChange) return <span className="num">{v == null ? <span className="text-muted/60">–</span> : nf(v)}</span>;
  return (
    <div className="flex flex-col gap-0.5">
      <input id={`${idPrefix}-${k}`} className="input num px-2 py-1.5 text-right" inputMode="numeric" value={v ?? ''} placeholder="–"
        onChange={(e) => { const s = e.target.value.replace(/[^\d]/g, ''); onChange(k, s === '' ? null : Number(s)); }} />
      {pct != null && <span className={`num text-right text-[10.5px] font-bold ${pct > 0 ? 'text-bad' : 'text-ok'}`}>{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</span>}
    </div>
  );
}

/** Tampilan/isian harga sesuai jenis harga produk. */
export function PriceGrid({ jenis, vals, before, onChange, minQty = 26, idPrefix = 'price' }: { jenis: JenisHarga; vals: Vals | PriceRow; before?: Vals | PriceRow | null; onChange?: (k: TierKey, v: number | null) => void; minQty?: number; idPrefix?: string }) {
  const V = vals as Vals, B = before as Vals | null | undefined;
  if (jenis === 'manual') return <p className="text-sm text-muted">Harga produk ini diisi CS saat transaksi.</p>;
  if (jenis === 'tetap') {
    return (
      <div className="max-w-[220px]">
        <div className="mb-1 text-xs font-semibold text-muted">Harga untuk semua konsumen</div>
        <Cell k="rb" vals={V} before={B} onChange={onChange} idPrefix={idPrefix} />
      </div>
    );
  }
  if (jenis === 'cutting') {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CUT_KEYS.map((k, i) => (
          <div key={k}><div className="mb-1 text-xs font-semibold text-muted">{CUT_SIZES[i]}</div><Cell k={k} vals={V} before={B} onChange={onChange} idPrefix={idPrefix} /></div>
        ))}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="tbl w-full min-w-[420px] border-collapse text-[13px]">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-muted">
            <th className="py-1.5 pr-2 text-left font-bold" />
            <th className="px-1.5 py-1.5 text-right font-bold">Banyak<div className="normal-case tracking-normal text-muted/70">≥ {minQty}</div></th>
            <th className="px-1.5 py-1.5 text-right font-bold">Banyak BB<div className="normal-case tracking-normal text-muted/70">2 sisi</div></th>
            <th className="px-1.5 py-1.5 text-right font-bold">Sedikit<div className="normal-case tracking-normal text-muted/70">&lt; {minQty}</div></th>
            <th className="px-1.5 py-1.5 text-right font-bold">Sedikit BB<div className="normal-case tracking-normal text-muted/70">2 sisi</div></th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.label} className="border-t border-line">
              <td className="py-2 pr-2 font-semibold">{r.label}</td>
              {r.keys.map((k) => <td key={k} className="px-1.5 py-2 text-right align-top"><Cell k={k} vals={V} before={B} onChange={onChange} idPrefix={idPrefix} /></td>)}
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

import { rp } from '@/lib/format';

/**
 * Omzet = total nota yang dibuat. Dibagi dua: yang sudah dibayar (tunai/transfer/DP, posisi saat ini)
 * dan yang masih jadi piutang (sisa nota tersebut). Cash + piutang = omzet.
 */
export function OmzetSplit({ omzet, sisa, className = '' }: { omzet: number; sisa: number; className?: string }) {
  const piutang = Math.max(0, Math.min(omzet, sisa || 0));
  const cash = Math.max(0, omzet - piutang);
  const p = (n: number) => (omzet > 0 ? Math.round((n / omzet) * 100) : 0);
  return (
    <div className={`rounded-lg bg-canvas/60 px-2.5 py-2 ${className}`}>
      <div className="mb-1.5 flex h-1.5 overflow-hidden rounded-full bg-sunk">
        <div className="bg-ok" style={{ width: `${p(cash)}%` }} />
        <div className="bg-bad" style={{ width: `${omzet > 0 ? 100 - p(cash) : 0}%` }} />
      </div>
      <div className="flex items-center gap-1.5 text-xs" title="Bagian omzet yang sudah dibayar konsumen (tunai, transfer, DP)">
        <i className="h-2 w-2 shrink-0 rounded-full bg-ok" /><span className="text-muted">Cash</span><span className="text-[10px] text-muted">{p(cash)}%</span>
        <b className="num ml-auto whitespace-nowrap">{rp(cash)}</b>
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-xs" title="Sisa yang belum dibayar dari nota tersebut">
        <i className="h-2 w-2 shrink-0 rounded-full bg-bad" /><span className="text-muted">Piutang</span><span className="text-[10px] text-muted">{p(piutang)}%</span>
        <b className={`num ml-auto whitespace-nowrap ${piutang ? 'text-bad' : ''}`}>{rp(piutang)}</b>
      </div>
    </div>
  );
}

import { rp } from '@/lib/format';

/**
 * Omzet = total nota yang dibuat. Dibagi: yang sudah dibayar (tunai/transfer/DP/deposit, posisi saat ini),
 * yang masih jadi piutang, dan yang dibatalkan lewat dokumen pembatalan. Cash + piutang + batal = omzet.
 */
export function OmzetSplit({ omzet, sisa, batal = 0, className = '' }: { omzet: number; sisa: number; batal?: number; className?: string }) {
  const bt = Math.max(0, Math.min(omzet, batal || 0));
  const net = omzet - bt;
  const piutang = Math.max(0, Math.min(net, sisa || 0));
  const cash = Math.max(0, net - piutang);
  const p = (n: number) => (omzet > 0 ? Math.round((n / omzet) * 100) : 0);
  const row = (dot: string, label: string, v: number, cls = '', title = '') => (
    <div className="mt-0.5 flex items-center gap-1.5 text-xs first:mt-0" title={title}>
      <i className={`h-2 w-2 shrink-0 rounded-full ${dot}`} /><span className="text-muted">{label}</span><span className="text-[10px] text-muted">{p(v)}%</span>
      <b className={`num ml-auto whitespace-nowrap ${cls}`}>{rp(v)}</b>
    </div>
  );
  return (
    <div className={`rounded-lg bg-canvas/60 px-2.5 py-2 ${className}`}>
      <div className="mb-1.5 flex h-1.5 overflow-hidden rounded-full bg-sunk">
        <div className="bg-ok" style={{ width: `${omzet > 0 ? (cash / omzet) * 100 : 0}%` }} />
        <div className="bg-bad" style={{ width: `${omzet > 0 ? (piutang / omzet) * 100 : 0}%` }} />
        <div className="bg-muted/50" style={{ width: `${omzet > 0 ? (bt / omzet) * 100 : 0}%` }} />
      </div>
      {row('bg-ok', 'Cash', cash, '', 'Bagian omzet yang sudah dibayar konsumen (tunai, transfer, DP, deposit)')}
      {row('bg-bad', 'Piutang', piutang, piutang ? 'text-bad' : '', 'Sisa yang belum dibayar dari nota tersebut')}
      {bt > 0 && row('bg-muted/50', 'Batal', bt, 'text-muted', 'Nilai yang dibatalkan lewat dokumen pembatalan (BTL)')}
    </div>
  );
}

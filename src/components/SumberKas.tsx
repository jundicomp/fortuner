import { useQuery } from '@tanstack/react-query';
import { Banknote, CreditCard, Landmark } from 'lucide-react';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { nf } from '@/lib/format';

export interface KasSaldo { id: string; nama: string; jenis: string; saldo: number }
export const useKasSaldo = () => useQuery({ queryKey: ['kas-saldo'], queryFn: () => api<KasSaldo[]>('kas.saldo'), staleTime: 15e3 });

/**
 * Pilih sumber pembayaran (kas tunai / rekening bank) dalam bentuk daftar pilihan, lengkap dengan saldo
 * saat ini dan sisa saldo setelah pembayaran ini.
 */
export function SumberKas({ value, onChange, nominal, id = 'sumber-kas', label = 'Sumber pembayaran' }: { value: string; onChange: (id: string) => void; nominal: number; id?: string; label?: string }) {
  const q = useKasSaldo();
  const list = (q.data || []).filter((m) => m.jenis !== 'edc'); // EDC = terima kartu, bukan sumber bayar
  useEffect(() => { if (!value && list.length) onChange((list.find((m) => m.jenis === 'tunai') || list[0]).id); }, [list.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = list.find((m) => m.id === value);
  const sisa = sel ? sel.saldo - nominal : 0;
  return (
    <label className="flex flex-col gap-1.5" htmlFor={id}>
      <span className="text-xs font-semibold text-muted">{label}</span>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} disabled={q.isLoading}>
        {q.isLoading && <option>Memuat saldo…</option>}
        {list.map((m) => <option key={m.id} value={m.id}>{m.nama} — saldo Rp {nf(m.saldo)}</option>)}
      </select>
      {sel && nominal > 0 && (
        <span className={`flex justify-between text-xs ${sisa < 0 ? 'font-semibold text-bad' : 'text-muted'}`}>
          <span>Saldo {sel.nama} setelah bayar</span>
          <b className="num">Rp {nf(sisa)}{sisa < 0 ? ' · tidak cukup' : ''}</b>
        </span>
      )}
    </label>
  );
}

/** Warna & ikon kartu saldo per kas/rekening. */
function styleOf(m: KasSaldo) {
  const n = m.nama.toLowerCase();
  if (m.jenis === 'tunai') return { bg: 'linear-gradient(135deg,#15803d,#166534)', Icon: Banknote };
  if (n.includes('bca')) return { bg: 'linear-gradient(135deg,#1d4ed8,#1e3a8a)', Icon: Landmark };
  if (n.includes('mandiri')) return { bg: 'linear-gradient(135deg,#1e3a8a,#0f1f4d)', Icon: Landmark, accent: '#facc15' };
  if (n.includes('bni')) return { bg: 'linear-gradient(135deg,#f26b1d,#c2410c)', Icon: Landmark };
  if (n.includes('bsi')) return { bg: 'linear-gradient(135deg,#0f766e,#115e59)', Icon: Landmark };
  if (n.includes('bri')) return { bg: 'linear-gradient(135deg,#0369a1,#075985)', Icon: Landmark };
  if (m.jenis === 'edc') return { bg: 'linear-gradient(135deg,#475569,#1e293b)', Icon: CreditCard };
  return { bg: 'linear-gradient(135deg,#27272a,#09090b)', Icon: Landmark };
}

/** Deretan kartu saldo berwarna (Tunai + tiap rekening bank). */
export function KasCards({ className = '' }: { className?: string }) {
  const q = useKasSaldo();
  const list = (q.data || []).filter((m) => m.jenis !== 'edc');
  if (!list.length) return null;
  return (
    <section className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 ${className}`} aria-label="Saldo kas & rekening">
      {list.map((m) => {
        const s = styleOf(m);
        return (
          <div key={m.id} className="relative overflow-hidden rounded-xl p-3.5 text-white shadow-sm" style={{ background: s.bg }}>
            <s.Icon size={64} className="pointer-events-none absolute -bottom-3 -right-2 opacity-15" aria-hidden />
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/20" style={s.accent ? { color: s.accent } : undefined}><s.Icon size={17} /></span>
              <span className="text-sm font-bold tracking-wide">{m.nama}</span>
            </div>
            <div className="mt-2.5 text-[11px] uppercase tracking-wider text-white/70">Saldo</div>
            <div className={`num text-lg font-extrabold leading-tight ${m.saldo < 0 ? 'text-red-200' : ''}`}>Rp {nf(m.saldo)}</div>
          </div>
        );
      })}
    </section>
  );
}

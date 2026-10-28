import { useQuery } from '@tanstack/react-query';
import { CreditCard, Inbox, Landmark, Users, Vault, Wallet } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { nf } from '@/lib/format';

export interface KasSaldo { id: string; nama: string; jenis: string; saldo: number; user_id?: string; plafon?: number }
export const useKasSaldo = () => useQuery({ queryKey: ['kas-saldo'], queryFn: () => api<KasSaldo[]>('kas.saldo'), staleTime: 15e3 });

/**
 * Pilih sumber pembayaran (kas tunai / rekening bank) dalam bentuk daftar pilihan, lengkap dengan saldo
 * saat ini dan sisa saldo setelah pembayaran ini.
 */
export function SumberKas({ value, onChange, nominal, id = 'sumber-kas', label = 'Sumber pembayaran' }: { value: string; onChange: (id: string) => void; nominal: number; id?: string; label?: string }) {
  const q = useKasSaldo();
  const list = (q.data || []).filter((m) => m.jenis === 'tunai' || m.jenis === 'transfer'); // kas besar & rekening. Laci kasir / kas kecil dipindah dulu lewat Pindah Dana
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
  if (m.jenis === 'tunai') return { bg: 'linear-gradient(135deg,#15803d,#14532d)', Icon: Vault };
  if (m.jenis === 'laci') return { bg: 'linear-gradient(135deg,#10b981,#047857)', Icon: Inbox };
  if (m.jenis === 'kas_kecil') return { bg: 'linear-gradient(135deg,#d97706,#b45309)', Icon: Wallet };
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
  const { user } = useAuth();
  const all = (q.data || []).filter((m) => m.jenis !== 'edc');
  const me = String(user?.id || '');
  // Kasir (punya laci sendiri): laci rekan tampil sebagai kotak terpisah bergaya garis (hanya lihat).
  const isKasir = all.some((m) => m.jenis === 'laci' && m.user_id === me);
  const rekan = isKasir ? all.filter((m) => m.jenis === 'laci' && m.user_id !== me) : [];
  const list = all.filter((m) => !rekan.includes(m));
  if (!all.length) return null;
  return (
    <div className={className}>
      <KasGrid list={list} />
      {rekan.length > 0 && (
        <section className="mt-3 rounded-xl border border-dashed border-emerald-400/70 bg-emerald-50/40 p-3 dark:bg-emerald-500/5" aria-label="Laci kasir lain">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300"><Users size={13} />Laci rekan kasir · hanya lihat</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {rekan.map((m) => (
              <div key={m.id} className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-surface px-3 py-2 dark:border-emerald-500/30">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><Inbox size={16} /></span>
                <span className="min-w-0"><span className="block truncate text-xs font-semibold text-muted">{m.nama}</span><b className={`num block text-base ${m.saldo < 0 ? 'text-bad' : ''}`}>Rp {nf(m.saldo)}</b></span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function KasGrid({ list, className = '' }: { list: KasSaldo[]; className?: string }) {
  return (
    <section className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${list.length > 6 ? 'lg:grid-cols-4' : list.length > 5 ? 'lg:grid-cols-6' : list.length > 2 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} ${className}`} aria-label="Saldo kas & rekening">
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
            {m.jenis === 'kas_kecil' && !!m.plafon && (
              <div className="mt-1.5"><div className="h-1.5 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-white" style={{ width: `${Math.max(0, Math.min(100, (m.saldo / m.plafon) * 100))}%` }} /></div>
                <div className="mt-0.5 text-[10.5px] text-white/80">plafon Rp {nf(m.plafon)}{m.saldo < m.plafon * 0.25 ? ' · menipis' : ''}</div></div>
            )}
          </div>
        );
      })}
    </section>
  );
}

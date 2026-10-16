import { useQuery } from '@tanstack/react-query';
import { Banknote, CreditCard, Landmark } from 'lucide-react';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { nf } from '@/lib/format';

export interface KasSaldo { id: string; nama: string; jenis: string; saldo: number }
export const useKasSaldo = () => useQuery({ queryKey: ['kas-saldo'], queryFn: () => api<KasSaldo[]>('kas.saldo'), staleTime: 15e3 });
const ICON: Record<string, typeof Banknote> = { tunai: Banknote, transfer: Landmark, edc: CreditCard };

/**
 * Pilih sumber dana pembayaran (kas tunai / rekening bank) sambil melihat saldonya saat ini
 * dan sisa saldo setelah pembayaran ini.
 */
export function SumberKas({ value, onChange, nominal, id = 'sumber-kas', label = 'Sumber dana' }: { value: string; onChange: (id: string) => void; nominal: number; id?: string; label?: string }) {
  const q = useKasSaldo();
  const list = (q.data || []).filter((m) => m.jenis !== 'edc'); // EDC = terima kartu, bukan sumber bayar
  useEffect(() => { if (!value && list.length) onChange((list.find((m) => m.jenis === 'tunai') || list[0]).id); }, [list.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const sel = list.find((m) => m.id === value);
  const sisa = sel ? sel.saldo - nominal : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted">{label}</span>
      {q.isLoading && <span className="text-xs text-muted">Memuat saldo…</span>}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" role="radiogroup" aria-label={label}>
        {list.map((m) => {
          const Icon = ICON[m.jenis] || Landmark;
          const on = m.id === value;
          return (
            <button key={m.id} id={`${id}-${m.id}`} type="button" role="radio" aria-checked={on} onClick={() => onChange(m.id)}
              className={`flex flex-col items-start rounded-lg border px-2.5 py-2 text-left transition ${on ? 'border-ink bg-ink text-canvas' : 'border-line bg-surface hover:border-muted'}`}>
              <span className="flex items-center gap-1.5 text-xs font-semibold"><Icon size={13} />{m.nama}</span>
              <span className={`num text-sm font-extrabold ${!on && m.saldo < 0 ? 'text-bad' : ''}`}>Rp {nf(m.saldo)}</span>
            </button>
          );
        })}
      </div>
      {sel && nominal > 0 && (
        <div className={`flex justify-between rounded-lg px-3 py-1.5 text-xs ${sisa < 0 ? 'bg-bad/10 text-bad' : 'bg-sunk'}`}>
          <span>Saldo {sel.nama} setelah bayar</span>
          <b className="num">Rp {nf(sisa)}{sisa < 0 ? ' · saldo tidak cukup' : ''}</b>
        </div>
      )}
    </div>
  );
}

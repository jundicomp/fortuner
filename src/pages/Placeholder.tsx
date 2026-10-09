import { Construction } from 'lucide-react';
import type { MenuItem } from '@/layout/menu';
import { PageHeader } from '@/components/ui/Field';

const TAHAP: Record<number, string> = { 2: 'Transaksi inti', 3: 'Desktop FO & kasir', 4: 'Operasional', 5: 'Keuangan & laporan' };

export function Placeholder({ item }: { item: MenuItem }) {
  return (
    <>
      <PageHeader title={item.label} />
      <div className="card flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand"><Construction size={24} /></div>
        <div>
          <div className="text-sm font-bold">Dibangun di Tahap {item.tahap}: {TAHAP[item.tahap || 0]}</div>
          <p className="mt-1 max-w-xl text-sm text-muted">{item.desc}</p>
        </div>
      </div>
    </>
  );
}

export function Forbidden() {
  return <div className="card p-6 text-sm text-muted">Anda tidak punya akses ke halaman ini. Hubungi admin bila perlu.</div>;
}

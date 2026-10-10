import type { ReactNode } from 'react';
import { nf } from '@/lib/format';

/** Gaya akuntansi: "Rp" rata kiri, angka rata kanan dalam satu sel. */
export function Money({ v, children, className = '' }: { v?: number | null; children?: ReactNode; className?: string }) {
  const body = children ?? (v == null ? '–' : nf(v));
  return (
    <span className={`money ${className}`}>
      <span className="money-rp">Rp</span>
      <span className="num">{body}</span>
    </span>
  );
}

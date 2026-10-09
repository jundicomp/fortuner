import type { ReactNode } from 'react';

export function Field({ label, hint, children, className = '' }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`label ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <span className="font-normal text-muted">{hint}</span>}
    </label>
  );
}

export function Switch({ checked, onChange, label, id, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; id: string; disabled?: boolean }) {
  return (
    <label htmlFor={id} className={`flex items-center gap-3 text-sm ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <button id={id} type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-brand' : 'bg-line'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
      <span>{label}</span>
    </label>
  );
}

export function PageHeader({ title, desc, actions }: { title: ReactNode; desc?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h1>
        {desc && <p className="mt-1 max-w-2xl text-sm text-muted">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return <div className="rounded-lg border border-bad/30 bg-bad/5 px-3 py-2 text-sm text-bad">{(error as Error).message || String(error)}</div>;
}

export function StatusPill({ aktif }: { aktif: boolean }) {
  return aktif ? <span className="pill pill-ok">Aktif</span> : <span className="pill pill-mute">Nonaktif</span>;
}

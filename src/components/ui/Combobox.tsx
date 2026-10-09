import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';

export interface ComboItem { value: string; label: string; hint?: string; search: string; right?: ReactNode }

interface Props {
  id: string;
  items: ComboItem[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  footer?: ReactNode;
  autoFocusNext?: () => void; // dipanggil setelah memilih (mis. pindah fokus ke qty)
}
export interface ComboHandle { focus: () => void }

/** Pilihan dengan pencarian, bisa dipakai penuh dengan keyboard (↑ ↓ Enter Esc). */
export const Combobox = forwardRef<ComboHandle, Props>(function Combobox({ id, items, value, onChange, placeholder = 'Cari…', emptyText = 'Tidak ditemukan.', footer, autoFocusNext }, ref) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => { setOpen(true); setTimeout(() => input.current?.focus(), 0); } }));

  const selected = items.find((i) => i.value === value);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items.slice(0, 200);
    const words = t.split(/\s+/);
    return items.filter((i) => words.every((w) => i.search.includes(w))).slice(0, 200);
  }, [items, q]);
  useEffect(() => setHi(0), [q, open]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  useEffect(() => { list.current?.querySelector(`[data-i="${hi}"]`)?.scrollIntoView({ block: 'nearest' }); }, [hi]);

  const choose = (v: string) => { onChange(v); setOpen(false); setQ(''); autoFocusNext?.(); };

  return (
    <div className="relative" ref={wrap}>
      {!open ? (
        <button id={id} type="button" className="input flex items-center gap-2 text-left" onClick={() => { setOpen(true); setTimeout(() => input.current?.focus(), 0); }}
          onKeyDown={(e) => { if (e.key.length === 1 || e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); setOpen(true); if (e.key.length === 1) setQ(e.key); setTimeout(() => input.current?.focus(), 0); } }}>
          <span className={`min-w-0 flex-1 truncate ${selected ? 'font-semibold' : 'text-muted/70'}`}>{selected ? selected.label : placeholder}</span>
          {selected?.right}
          <ChevronsUpDown size={15} className="shrink-0 text-muted" />
        </button>
      ) : (
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input ref={input} id={id} className="input pl-9" placeholder={placeholder} value={q} autoComplete="off" role="combobox" aria-expanded="true" aria-controls={`${id}-list`}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, filtered.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); if (filtered[hi]) choose(filtered[hi].value); }
              else if (e.key === 'Escape') { setOpen(false); setQ(''); }
              else if (e.key === 'Tab') setOpen(false);
            }} />
        </div>
      )}
      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          <ul ref={list} id={`${id}-list`} role="listbox" className="max-h-72 overflow-y-auto py-1">
            {!filtered.length && <li className="px-3 py-3 text-sm text-muted">{emptyText}</li>}
            {filtered.map((i, idx) => (
              <li key={i.value} data-i={idx} role="option" aria-selected={i.value === value}
                className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${idx === hi ? 'bg-sunk' : ''}`}
                onMouseEnter={() => setHi(idx)} onMouseDown={(e) => { e.preventDefault(); choose(i.value); }}>
                <Check size={14} className={`shrink-0 ${i.value === value ? 'text-brand' : 'opacity-0'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{i.label}</span>
                  {i.hint && <span className="block truncate text-xs text-muted">{i.hint}</span>}
                </span>
                {i.right}
              </li>
            ))}
          </ul>
          {footer && <div className="border-t border-line p-2">{footer}</div>}
        </div>
      )}
    </div>
  );
});

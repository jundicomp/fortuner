import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/table/DataTable';
import { Modal } from '@/components/ui/Modal';
import { ErrorBox, Field, PageHeader, StatusPill, Switch } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import type { MasterTable } from '@/types';

export interface FieldDef {
  key: string; label: string; type?: 'text' | 'tel' | 'number' | 'textarea' | 'select' | 'switch' | 'choice' | 'info'; required?: boolean; hint?: string;
  options?: { value: string; label: string }[]; placeholder?: string; full?: boolean;
  /** tampilkan field hanya bila kondisi terpenuhi (mis. nama percetakan hanya untuk jenis Percetakan) */
  show?: (rec: Record<string, unknown>) => boolean;
  /** type 'info': isi teks hanya-baca yang dihitung dari data form */
  render?: (rec: Record<string, unknown>) => React.ReactNode;
}

interface Props<T> {
  table: MasterTable; perm: string; title: string; desc: string; noun: string;
  columns: ColumnDef<T, any>[]; fields: FieldDef[]; defaults: Partial<T>; cardTitle?: (r: T) => React.ReactNode;
  actions?: React.ReactNode;
  /** konten di antara judul halaman dan tabel (mis. ringkasan) */
  top?: React.ReactNode;
  /** ganti aksi klik baris (default: buka form ubah). openEdit membuka form ubah. */
  onRowClick?: (row: T, openEdit: (row: T) => void) => void;
}

export function MasterPage<T extends { id: string; aktif: boolean }>({ table, perm, title, desc, noun, columns, fields, defaults, cardTitle, actions, top, onRowClick }: Props<T>) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['master', table], queryFn: () => api<T[]>('master.list', { table }) });
  const [edit, setEdit] = useState<Partial<T> | null>(null);
  const save = useMutation({
    mutationFn: (record: Partial<T>) => api<T>('master.save', { table, record }),
    onSuccess: (_r, rec) => { qc.invalidateQueries({ queryKey: ['master', table] }); toast(`${noun} ${rec.id ? 'diperbarui' : 'ditambahkan'}`); setEdit(null); },
  });

  const statusCol: ColumnDef<T, any> = {
    id: 'aktif', accessorFn: (r) => (r.aktif ? 'Aktif' : 'Nonaktif'), header: 'Status', meta: { filter: 'select' },
    cell: (c) => <StatusPill aktif={c.row.original.aktif} />,
  };
  const canEdit = can(perm, 'ubah');
  const set = (k: string, v: unknown) => setEdit((e) => ({ ...(e || {}), [k]: v }) as Partial<T>);

  return (
    <>
      <PageHeader title={title} desc={desc} actions={actions} />
      {top}
      <DataTable<T>
        data={q.data || []}
        loading={q.isLoading}
        columns={[...columns, statusCol]}
        title={title}
        storageKey={`master-${table}`}
        canExport={can(perm, 'ekspor')}
        cardTitle={cardTitle}
        onRowClick={onRowClick ? (r) => onRowClick(r, (x) => { save.reset(); setEdit(x); }) : canEdit ? (r) => { save.reset(); setEdit(r); } : undefined}
        toolbar={can(perm, 'tambah') && <button className="btn btn-primary" onClick={() => { save.reset(); setEdit({ ...defaults, aktif: true } as Partial<T>); }}><Plus size={16} />Tambah</button>}
        emptyText={`Belum ada ${noun.toLowerCase()}.`}
      />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Ubah ${noun.toLowerCase()}` : `Tambah ${noun.toLowerCase()}`}
        footer={<><button className="btn" onClick={() => setEdit(null)}>Batal</button><button className="btn btn-primary" disabled={save.isPending} onClick={() => edit && save.mutate(edit)}>{save.isPending ? 'Menyimpan…' : 'Simpan'}</button></>}>
        {edit && (
          <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(edit); }}>
            {fields.map((f) => {
              const v = (edit as Record<string, unknown>)[f.key];
              const id = `${table}-${f.key}`;
              const rec = edit as Record<string, unknown>;
              if (f.show && !f.show(rec)) return null;
              const cls = f.full || f.type === 'textarea' || f.type === 'choice' ? 'sm:col-span-2' : '';
              if (f.type === 'info') return <Field key={f.key} label={f.label} hint={f.hint} className={cls}><div id={id} className="input flex items-center bg-sunk text-muted">{f.render?.(rec)}</div></Field>;
              if (f.type === 'choice') return (
                <Field key={f.key} label={<>{f.label}{f.required && <span className="text-bad"> *</span>}</>} hint={f.hint} className={cls}>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup">
                    {f.options!.map((o) => {
                      const on = String(v ?? '') === o.value;
                      return <button key={o.value} type="button" role="radio" aria-checked={on} id={`${id}-${o.value}`} onClick={() => set(f.key, o.value)}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${on ? 'border-brand bg-brand/10 text-brand' : 'border-line hover:bg-sunk'}`}>
                        <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-brand' : 'border-line'}`}>{on && <span className="h-2 w-2 rounded-full bg-brand" />}</span>{o.label}
                      </button>;
                    })}
                  </div>
                </Field>
              );
              if (f.type === 'switch') return <div key={f.key} className="sm:col-span-2"><Switch id={id} checked={!!v} onChange={(x) => set(f.key, x)} label={f.label} /></div>;
              return (
                <Field key={f.key} label={<>{f.label}{f.required && <span className="text-bad"> *</span>}</>} hint={f.hint} className={cls}>
                  {f.type === 'select' ? (
                    <select id={id} className="input" value={String(v ?? '')} onChange={(e) => set(f.key, e.target.value)}>{f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                  ) : f.type === 'textarea' ? (
                    <textarea id={id} className="input min-h-[80px]" value={String(v ?? '')} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} />
                  ) : (
                    <input id={id} className={`input${f.type === 'number' ? ' num text-right' : ''}`} type={f.type === 'tel' ? 'tel' : 'text'} inputMode={f.type === 'tel' ? 'tel' : f.type === 'number' ? 'decimal' : undefined} value={String(v ?? '')} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} required={f.required} />
                  )}
                </Field>
              );
            })}
            <div className="sm:col-span-2"><Switch id={`${table}-aktif`} checked={edit.aktif !== false} onChange={(x) => set('aktif', x)} label="Aktif (nonaktif = disembunyikan dari pilihan, data lama tetap ada)" /></div>
            <div className="sm:col-span-2"><ErrorBox error={save.error} /></div>
            <button type="submit" hidden />
          </form>
        )}
      </Modal>
    </>
  );
}

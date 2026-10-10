import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useEffect, useState } from 'react';
import { ErrorBox, PageHeader } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { MODULES, OPS } from '@/lib/modules';
import { ROLES, type PermissionMap, type Role } from '@/types';

const OP_LABEL: Record<string, string> = { lihat: 'Lihat', tambah: 'Tambah', ubah: 'Ubah', hapus: 'Hapus', ekspor: 'Export' };

export function RolesPage() {
  const { can, user, refresh } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['roles'], queryFn: () => api<Record<Role, PermissionMap>>('roles.get') });
  const [role, setRole] = useState<Role>('cs');
  const [draft, setDraft] = useState<PermissionMap>({});
  useEffect(() => { if (q.data) setDraft(JSON.parse(JSON.stringify(q.data[role] || {}))); }, [q.data, role]);
  const save = useMutation({
    mutationFn: () => api('roles.save', { role, permissions: draft }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); toast('Hak akses disimpan'); if (user?.role === role) refresh(); },
  });
  const locked = role === 'owner' || (role === 'admin' && user?.role !== 'owner') || !can('pengaturan.role', 'ubah');
  const dirty = q.data && JSON.stringify(q.data[role]) !== JSON.stringify(draft);
  const groups = Array.from(new Set(MODULES.map((m) => m.group)));

  const toggle = (key: string, op: string) => setDraft((d) => {
    const cur = { ...(d[key] || {}) } as Record<string, boolean>;
    cur[op] = !cur[op];
    if (op === 'lihat' && !cur.lihat) OPS.forEach((o) => (cur[o] = false)); // tanpa lihat, yang lain tidak berarti
    if (op !== 'lihat' && cur[op]) cur.lihat = true;
    return { ...d, [key]: cur };
  });

  return (
    <>
      <PageHeader title="Hak Akses" desc="Atur apa yang boleh dilihat dan dikerjakan tiap role. Owner selalu punya akses penuh; hak akses admin hanya bisa diubah owner." />
      <div className="mb-4 flex flex-wrap gap-2">
        {ROLES.map((r) => <button key={r.value} className={`chip ${role === r.value ? 'border-ink bg-ink text-canvas' : 'hover:border-muted'}`} onClick={() => setRole(r.value)}>{r.label}</button>)}
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl w-full min-w-[560px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-sunk text-[11px] uppercase tracking-wider text-muted">
              <th className="px-4 py-2.5 text-left font-bold">Modul</th>
              {OPS.map((o) => <th key={o} className="px-2 py-2.5 text-center font-bold">{OP_LABEL[o]}</th>)}
            </tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={6} className="p-6 text-center text-muted">Memuat…</td></tr>}
            {q.data && groups.map((g) => (
              <Fragment key={g}>
                <tr><td colSpan={6} className="border-t border-line bg-canvas px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">{g}</td></tr>
                {MODULES.filter((m) => m.group === g).map((m) => (
                  <tr key={m.key} className="border-t border-line">
                    <td className="px-4 py-2 font-semibold">{m.label}</td>
                    {OPS.map((o) => (
                      <td key={o} className="px-2 py-2 text-center">
                        <input type="checkbox" aria-label={`${m.label} ${OP_LABEL[o]}`} className="h-4 w-4 accent-[rgb(var(--brand))]" disabled={locked}
                          checked={!!draft[m.key]?.[o]} onChange={() => toggle(m.key, o)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        <ErrorBox error={save.error} />
        {locked ? <span className="text-sm text-muted">{role === 'owner' ? 'Owner selalu akses penuh.' : 'Anda tidak bisa mengubah role ini.'}</span>
          : <button className="btn btn-primary" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Menyimpan…' : 'Simpan hak akses'}</button>}
      </div>
    </>
  );
}

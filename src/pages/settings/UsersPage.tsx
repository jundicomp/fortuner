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
import { tglJam } from '@/lib/format';
import { ROLES, type User } from '@/types';

const roleLabel = (r: unknown) => ROLES.find((x) => x.value === r)?.label || String(r);
const OFFICE_ROLES = ['cs', 'kasir'];

export function UsersPage() {
  const { can, user: me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['users'], queryFn: () => api<User[]>('users.list') });
  const [edit, setEdit] = useState<(Partial<User> & { password?: string }) | null>(null);
  const save = useMutation({
    mutationFn: () => { const { password, ...user } = edit!; return api<User>('users.save', { user, password }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast(edit?.id ? 'User diperbarui' : 'User ditambahkan'); setEdit(null); },
  });
  const set = (k: string, v: unknown) => setEdit((e) => ({ ...(e || {}), [k]: v }));

  const columns: ColumnDef<User, any>[] = [
    { accessorKey: 'nama', header: 'Nama', cell: (c) => <span className="font-semibold">{c.getValue()}</span> },
    { accessorKey: 'username', header: 'Username', meta: { className: 'font-mono text-xs' } },
    { accessorKey: 'role', header: 'Role', meta: { filter: 'select', filterLabel: roleLabel }, cell: (c) => roleLabel(c.getValue()) },
    {
      id: 'akses', accessorFn: (r) => (r.khusus_kantor ? 'Perangkat kantor' : 'Dari mana saja'), header: 'Login dari', meta: { filter: 'select' },
      cell: (c) => c.row.original.khusus_kantor ? <span className="pill pill-brand">Perangkat kantor</span> : <span className="pill pill-mute">Dari mana saja</span>,
    },
    { id: 'jam', accessorFn: (r) => (r.jam_login_dari && r.jam_login_sampai ? `${r.jam_login_dari}–${r.jam_login_sampai}` : 'Bebas'), header: 'Jam login' },
    { id: 'aktif', accessorFn: (r) => (r.aktif ? 'Aktif' : 'Nonaktif'), header: 'Status', meta: { filter: 'select' }, cell: (c) => <StatusPill aktif={c.row.original.aktif} /> },
    { accessorKey: 'created_at', header: 'Dibuat', cell: (c) => <span className="text-xs text-muted">{tglJam(c.getValue())}</span>, meta: { hideOnCard: true } },
  ];

  return (
    <>
      <PageHeader title="User" desc="CS dan kasir sebaiknya ditandai “khusus perangkat kantor”: mereka hanya bisa login dari PC yang disetujui di menu Perangkat. User baru dan reset password wajib ganti password saat login." />
      <DataTable<User>
        data={q.data || []} loading={q.isLoading} columns={columns} title="User" storageKey="settings-users"
        canExport={can('pengaturan.user', 'ekspor')}
        onRowClick={can('pengaturan.user', 'ubah') ? (r) => { save.reset(); setEdit({ ...r, password: '' }); } : undefined}
        toolbar={can('pengaturan.user', 'tambah') && <button className="btn btn-primary" onClick={() => { save.reset(); setEdit({ role: 'cs', khusus_kantor: true, aktif: true, jam_login_dari: '', jam_login_sampai: '', password: '' }); }}><Plus size={16} />Tambah</button>}
      />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Ubah ${edit.nama}` : 'Tambah user'}
        footer={<><button className="btn" onClick={() => setEdit(null)}>Batal</button><button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Menyimpan…' : 'Simpan'}</button></>}>
        {edit && (
          <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <Field label="Nama"><input id="usr-nama" className="input" value={edit.nama || ''} onChange={(e) => set('nama', e.target.value)} /></Field>
            <Field label="Username" hint="Huruf kecil, angka, titik."><input id="usr-username" className="input font-mono" autoCapitalize="none" value={edit.username || ''} onChange={(e) => set('username', e.target.value.toLowerCase())} /></Field>
            <Field label="Role">
              <select id="usr-role" className="input" value={edit.role} onChange={(e) => { set('role', e.target.value); if (!edit.id) set('khusus_kantor', OFFICE_ROLES.includes(e.target.value)); }}>
                {ROLES.filter((r) => r.value !== 'owner' || me?.role === 'owner').map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
            <Field label={edit.id ? 'Reset password' : 'Password awal'} hint={edit.id ? 'Kosongkan bila tidak diganti.' : 'Minimal 6 karakter. User wajib menggantinya saat login.'}>
              <input id="usr-password" className="input" type="text" autoComplete="new-password" value={edit.password || ''} onChange={(e) => set('password', e.target.value)} />
            </Field>
            <div className="sm:col-span-2"><Switch id="usr-kantor" checked={!!edit.khusus_kantor} onChange={(v) => set('khusus_kantor', v)} label="Khusus perangkat kantor (hanya bisa login dari PC yang disetujui)" /></div>
            <Field label="Jam login dari" hint="Kosongkan = bebas."><input id="usr-jam-dari" type="time" className="input" value={edit.jam_login_dari || ''} onChange={(e) => set('jam_login_dari', e.target.value)} /></Field>
            <Field label="Jam login sampai"><input id="usr-jam-sampai" type="time" className="input" value={edit.jam_login_sampai || ''} onChange={(e) => set('jam_login_sampai', e.target.value)} /></Field>
            <div className="sm:col-span-2"><Switch id="usr-aktif" checked={edit.aktif !== false} onChange={(v) => set('aktif', v)} label="Aktif (nonaktif = langsung keluar dari semua perangkat)" /></div>
            <div className="sm:col-span-2"><ErrorBox error={save.error} /></div>
            <button type="submit" hidden />
          </form>
        )}
      </Modal>
    </>
  );
}

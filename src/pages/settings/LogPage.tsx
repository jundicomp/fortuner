import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/table/DataTable';
import { PageHeader } from '@/components/ui/Field';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { tglJam } from '@/lib/format';
import type { LogRow } from '@/types';

const AKSI: Record<string, string> = {
  login: 'Login', tambah: 'Tambah', ubah: 'Ubah', import: 'Import', harga_baru: 'Harga baru', koreksi_harga: 'Koreksi harga', ganti_password: 'Ganti password',
  daftar_perangkat: 'Daftar perangkat', ubah_perangkat: 'Ubah perangkat', ubah_hak_akses: 'Ubah hak akses', ubah_pengaturan: 'Ubah pengaturan',
};

export function LogPage() {
  const { can } = useAuth();
  const q = useQuery({ queryKey: ['log'], queryFn: () => api<LogRow[]>('log.list', {}) });
  const columns: ColumnDef<LogRow, any>[] = [
    { accessorKey: 'waktu', header: 'Waktu', cell: (c) => <span className="num whitespace-nowrap text-xs">{tglJam(c.getValue())}</span>, meta: { exportValue: (r: LogRow) => r.waktu } },
    { accessorKey: 'user_nama', header: 'User', meta: { filter: 'select' } },
    { accessorKey: 'aksi', header: 'Aksi', meta: { filter: 'select', filterLabel: (v) => AKSI[String(v)] || String(v) }, cell: (c) => <span className="pill pill-mute">{AKSI[c.getValue()] || c.getValue()}</span> },
    { accessorKey: 'ringkasan', header: 'Keterangan' },
    { accessorKey: 'alasan', header: 'Alasan', meta: { hideOnCard: true } },
  ];
  return (
    <>
      <PageHeader title="Log Aktivitas" desc="Semua perubahan penting tercatat: login, perubahan harga, user, perangkat, dan pengaturan." />
      <DataTable<LogRow> data={q.data || []} loading={q.isLoading} columns={columns} title="Log_aktivitas" storageKey="settings-log" dateField="waktu"
        initialSort={[{ id: 'waktu', desc: true }]} canExport={can('pengaturan.log', 'ekspor')} />
    </>
  );
}

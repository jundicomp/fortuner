import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from './api';

export interface MaintStatus {
  aktif: boolean; judul?: string; pesan?: string; selesai?: string; kontak?: string; progres?: boolean; manual?: boolean; auto_off?: boolean;
  sejak?: string; oleh?: string; nama_usaha?: string; sekarang?: string;
}

/** Status mode perbaikan; dicek ulang tiap 30 detik dan langsung saat server menolak dengan kode MAINTENANCE. */
export function useMaintenance() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['maintenance', 'status'],
    queryFn: () => api<MaintStatus>('maintenance.status'),
    refetchInterval: 30_000, refetchOnWindowFocus: true, retry: false, staleTime: 10_000,
  });
  useEffect(() => {
    const on = () => void qc.invalidateQueries({ queryKey: ['maintenance', 'status'] });
    window.addEventListener('fortuner:maintenance', on);
    return () => window.removeEventListener('fortuner:maintenance', on);
  }, [qc]);
  return q;
}

/** "2026-11-02T13:00" (waktu Jakarta) → Date. */
export const lokalKeDate = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? new Date(`${s}:00+07:00`) : null);

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
/** "Senin, 2 Nov 2026 · 13.00 WIB" */
export function labelSelesai(s?: string) {
  if (!s || s.length < 16) return '';
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  const hari = HARI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${hari}, ${d} ${BLN[m - 1]} ${y} · ${s.slice(11, 16).replace(':', '.')} WIB`;
}
/** "sekitar 4 jam lagi" / "sekitar 25 menit lagi" / "sebentar lagi" */
export function sisaWaktu(selesai?: string, now = new Date()) {
  const t = lokalKeDate(selesai);
  if (!t) return '';
  const mnt = Math.round((t.getTime() - now.getTime()) / 60000);
  if (mnt <= 1) return 'sebentar lagi';
  if (mnt < 60) return `sekitar ${mnt} menit lagi`;
  const j = Math.floor(mnt / 60), r = mnt % 60;
  if (j < 24) return `sekitar ${j} jam${r >= 10 ? ` ${r} menit` : ''} lagi`;
  return `sekitar ${Math.round(j / 24)} hari lagi`;
}
/** Persen jalan dari mulai sampai perkiraan selesai (null = tidak diketahui). */
export function progresOf(sejak?: string, selesai?: string, now = new Date()) {
  const a = sejak ? new Date(sejak) : null, b = lokalKeDate(selesai);
  if (!a || !b || isNaN(a.getTime()) || b <= a) return null;
  return Math.max(4, Math.min(96, ((now.getTime() - a.getTime()) / (b.getTime() - a.getTime())) * 100));
}

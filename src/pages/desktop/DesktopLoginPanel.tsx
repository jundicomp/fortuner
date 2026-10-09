import { useQuery } from '@tanstack/react-query';
import { MonitorCheck, Server } from 'lucide-react';
import { useState } from 'react';
import { api, IS_DEMO, serverEverOk } from '@/lib/api';
import { machineInfo, pcReg } from '@/platform/desktop';
import { Modal } from '@/components/ui/Modal';
import { ServerForm } from './PcPage';

const STATUS: Record<string, [string, string]> = { menunggu: ['Menunggu persetujuan admin', 'pill-warn'], disetujui: ['Disetujui', 'pill-ok'], dicabut: ['Akses dicabut', 'pill-bad'] };

/**
 * Panel "PC ini" di layar login aplikasi desktop.
 * Kode PC & lokasi usulan ikut terkirim saat login, jadi admin tinggal menyetujui permintaan di Pengaturan → Perangkat.
 */
export function DesktopLoginPanel() {
  const m = useQuery({ queryKey: ['machine'], queryFn: machineInfo, staleTime: Infinity });
  const st = useQuery({ queryKey: ['device-check'], queryFn: () => api<{ terdaftar: boolean; status?: string; kode_pc?: string; lokasi?: string }>('device.check'), retry: 0, refetchInterval: 20e3 });
  const [reg, setReg] = useState(pcReg.get());
  const [srv, setSrv] = useState(false);
  const save = (r: typeof reg) => { setReg(r); pcReg.set(r); };
  const s = st.data?.status ? STATUS[st.data.status] : null;
  const approved = st.data?.status === 'disetujui';
  const canSetServer = !IS_DEMO && !serverEverOk();

  return (
    <div id="pc-panel" className="mt-6 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand"><MonitorCheck size={18} /></div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">{m.data?.hostname || 'PC ini'}</div>
          <div className="mt-0.5 text-xs">
            {st.isLoading ? <span className="text-muted">Memeriksa…</span>
              : st.error ? <span className="text-muted">Status belum bisa dicek (offline?)</span>
              : !st.data?.terdaftar ? <span className="pill pill-mute">Belum terdaftar</span>
              : <><span id="pc-status" className={`pill ${s?.[1]}`}>{s?.[0]}</span>{st.data.kode_pc && <span className="ml-1.5 font-mono font-bold">{st.data.kode_pc}</span>}</>}
          </div>
        </div>
      </div>
      {!approved && (
        <>
          <div className="mt-3 grid grid-cols-[80px_1fr] gap-2">
            <label className="label text-xs">Kode PC<input id="pc-kode" className="input font-mono uppercase" maxLength={4} placeholder="K1" value={reg.kode} onChange={(e) => save({ ...reg, kode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} /></label>
            <label className="label text-xs">Lokasi<input id="pc-lokasi" className="input" placeholder="mis. Meja kasir depan" value={reg.lokasi} onChange={(e) => save({ ...reg, lokasi: e.target.value })} /></label>
          </div>
          <p className="mt-2 text-xs text-muted">Akun kasir/CS: login sekali untuk mengirim permintaan. Owner/admin menyetujuinya di Pengaturan → Perangkat (bisa dari HP), lalu login lagi. Owner/admin yang login di sini bisa langsung mendaftarkan PC ini.</p>
        </>
      )}
      {canSetServer && (
        <button id="pc-set-server" className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline" onClick={() => setSrv(true)}><Server size={13} />Atur alamat server</button>
      )}
      <Modal open={srv} onClose={() => setSrv(false)} size="sm" title="Alamat server" subtitle="Hanya bisa diubah dari sini selama PC ini belum pernah tersambung. Setelah itu, ubah lewat menu Aplikasi PC Ini (owner/admin).">
        <ServerForm onDone={() => setSrv(false)} />
      </Modal>
    </div>
  );
}

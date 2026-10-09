import { AlertTriangle, CloudOff, Loader2, RefreshCw, Trash2, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { sync, useSync } from '@/lib/offline';
import { IS_DEMO, simOffline } from '@/lib/api';
import { isTauri, simDesktop } from '@/platform/desktop';
import { rp, tglJam } from '@/lib/format';
import { useAuth } from '@/auth/AuthContext';

/** Status koneksi + antrian kirim di header. */
export function SyncStatus() {
  const s = useSync();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [sim, setSim] = useState(simOffline.get());
  const [confirmDel, setConfirmDel] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  useEffect(() => { if (s.notice) setOpen(true); }, [s.notice]);

  const n = s.outbox.length;
  const failed = s.outbox.filter((o) => o.status === 'failed').length;
  const tone = !s.online ? 'pill-bad' : failed ? 'pill-warn' : n ? 'pill-brand' : 'pill-ok';
  const Icon = s.syncing ? Loader2 : !s.online ? WifiOff : failed ? AlertTriangle : Wifi;
  const text = s.syncing ? 'Mengirim…' : !s.online ? (n ? `Offline · ${n} belum terkirim` : 'Offline') : failed ? `${failed} gagal terkirim` : n ? `${n} menunggu` : 'Online';
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  return (
    <div className="relative" ref={ref}>
      <button className={`pill ${tone} cursor-pointer py-1`} onClick={() => setOpen((o) => !o)} aria-expanded={open} title="Status koneksi & sinkron">
        <Icon size={13} className={s.syncing ? 'animate-spin' : ''} /><span className={n || !s.online ? '' : 'hidden sm:inline'}>{text}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[min(92vw,380px)] rounded-xl border border-line bg-surface shadow-xl">
          <div className="flex items-start gap-3 border-b border-line p-4">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${s.online ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad'}`}>{s.online ? <Wifi size={18} /> : <CloudOff size={18} />}</div>
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-bold">{s.online ? 'Terhubung ke server' : 'Tidak terhubung'}</div>
              <div className="text-xs text-muted">{s.online ? 'Nota langsung tersimpan di server.' : 'Kasir tetap bisa membuat nota di perangkat terdaftar; nota dikirim otomatis saat internet kembali.'}</div>
              <div className="mt-1 text-[11px] text-muted">Terakhir terkirim: {s.lastSync ? tglJam(s.lastSync) : '–'} · cek tiap 30 detik</div>
            </div>
          </div>
          {s.notice && (
            <div className="flex gap-2 border-b border-line bg-warn/10 px-4 py-3 text-xs text-warn">
              <AlertTriangle size={15} className="shrink-0" /><span className="flex-1">{s.notice}</span>
              <button className="font-bold underline" onClick={() => sync.clearNotice()}>OK</button>
            </div>
          )}
          <div className="max-h-64 overflow-y-auto">
            {!n && <div className="px-4 py-5 text-center text-sm text-muted">Tidak ada data yang menunggu dikirim.</div>}
            {s.outbox.map((o) => (
              <div key={o.id} className="border-b border-line px-4 py-2.5 text-sm last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`pill ${o.status === 'failed' ? 'pill-bad' : 'pill-brand'}`}>{o.kind === 'orders.create' ? 'Nota' : 'Bayar'}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{o.label}</span>
                  {o.total != null && <span className="num text-xs">{rp(o.total)}</span>}
                </div>
                <div className="mt-1 text-[11px] text-muted">{tglJam(o.created_at)}</div>
                {o.status === 'failed' && (
                  <div className="mt-1.5 rounded-md bg-bad/5 px-2 py-1.5 text-xs text-bad">
                    {o.error}
                    <div className="mt-1.5 flex gap-2">
                      <button className="btn btn-sm" onClick={() => sync.retry(o.id)}><RefreshCw size={12} />Coba lagi</button>
                      {isAdmin && (confirmDel === o.id
                        ? <button className="btn btn-sm btn-danger" onClick={() => { sync.remove(o.id); setConfirmDel(''); }}>Yakin hapus?</button>
                        : <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDel(o.id)}><Trash2 size={12} />Hapus</button>)}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line p-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted" title="Untuk mencoba mode offline tanpa mencabut internet">
              <input type="checkbox" className="accent-[rgb(var(--brand))]" checked={sim} onChange={(e) => { simOffline.set(e.target.checked); setSim(e.target.checked); void sync.check(); }} />
              Simulasi internet mati
            </label>
            {IS_DEMO && !isTauri && (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted" title="Mencoba fitur aplikasi desktop (printer & laci) dengan printer virtual">
                <input id="sim-desktop" type="checkbox" className="accent-[rgb(var(--brand))]" checked={simDesktop.get()} onChange={(e) => { simDesktop.set(e.target.checked); location.reload(); }} />
                Simulasi aplikasi PC
              </label>
            )}
            <button className="btn btn-primary btn-sm" disabled={s.syncing} onClick={async () => { const ok = await sync.check(); if (ok) await sync.flush(); }}>
              <RefreshCw size={14} className={s.syncing ? 'animate-spin' : ''} />Sinkron sekarang
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

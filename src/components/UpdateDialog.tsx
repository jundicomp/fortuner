import { useEffect, useState } from 'react';
import { CloudDownload, Loader2, Rocket } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useSync } from '@/lib/offline';
import { checkUpdate, updateErrorText, type UpdateInfo } from '@/platform/updater';
import { isTauri } from '@/platform/desktop';

/** Dialog pembaruan. Pembaruan ditahan selama masih ada data offline yang belum terkirim. */
export function UpdateDialog({ info, onClose }: { info: UpdateInfo; onClose: () => void }) {
  const s = useSync();
  const [pct, setPct] = useState<number | null | undefined>(undefined);
  const [err, setErr] = useState('');
  const pending = s.outbox.length;
  const busy = pct !== undefined;
  const go = async () => {
    setErr(''); setPct(null);
    try { await info.install(setPct); } catch (e) { setErr(updateErrorText(e)); setPct(undefined); }
  };
  return (
    <Modal open onClose={busy ? () => {} : onClose} size="sm" title="Pembaruan tersedia"
      footer={<>
        <button className="btn" disabled={busy} onClick={onClose}>Nanti</button>
        <button id="update-install" className="btn btn-primary" disabled={busy || pending > 0} onClick={go}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}Perbarui &amp; buka ulang</button>
      </>}>
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand"><CloudDownload size={20} /></div>
          <div><div className="font-bold">Fortuner POS {info.version}</div><div className="text-xs text-muted">Versi di PC ini {info.current}</div></div>
        </div>
        {info.notes && <div className="whitespace-pre-line rounded-lg bg-sunk px-3 py-2 text-[13px]">{info.notes}</div>}
        {pending > 0 && <div id="update-blocked" className="rounded-lg bg-warn/10 px-3 py-2 text-xs font-semibold text-warn">Menunggu {pending} data offline terkirim dulu. Klik Sinkron sekarang di header, lalu coba lagi.</div>}
        {busy && (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-sunk"><div className={`h-full bg-brand transition-all ${pct == null ? 'w-1/3 animate-pulse' : ''}`} style={pct != null ? { width: `${pct}%` } : undefined} /></div>
            <div className="mt-1 text-xs text-muted">{pct == null ? 'Mengunduh…' : `Mengunduh ${pct}%`} · aplikasi akan terbuka ulang sendiri</div>
          </div>
        )}
        {err && <div className="rounded-lg bg-bad/5 px-3 py-2 text-xs text-bad">{err}</div>}
      </div>
    </Modal>
  );
}

/** Cek otomatis di aplikasi desktop asli: 15 detik setelah dibuka, lalu tiap 6 jam. Menampilkan tombol kecil di header. */
export function UpdateNotifier() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!isTauri) return;
    const run = () => checkUpdate().then(setInfo).catch(() => { /* offline / belum dikonfigurasi: diam saja */ });
    const t = setTimeout(run, 15e3);
    const i = setInterval(run, 6 * 3600e3);
    return () => { clearTimeout(t); clearInterval(i); };
  }, []);
  if (!info) return null;
  return (
    <>
      <button className="pill pill-brand cursor-pointer py-1" onClick={() => setOpen(true)} title="Ada versi baru aplikasi"><Rocket size={13} />Versi {info.version}</button>
      {open && <UpdateDialog info={info} onClose={() => setOpen(false)} />}
    </>
  );
}

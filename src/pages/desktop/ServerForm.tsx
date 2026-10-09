import { CheckCircle2, Link2, Plug, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { ErrorBox, Field } from '@/components/ui/Field';
import { API_URL, apiUrlOverride, BUILD_API_URL, isValidApiUrl, pingServer } from '@/lib/api';
import { useSync } from '@/lib/offline';

export const maskUrl = (u: string) => (u ? u.replace(/(\/macros\/s\/)([^/]{6})[^/]*([^/]{4})(\/exec)/, '$1$2…$3$4') : '');

/** Ganti alamat Apps Script. Data lokal milik server lama (termasuk data demo) dibuang otomatis setelah pindah. */
export function ServerForm({ onDone }: { onDone?: () => void }) {
  const s = useSync();
  const [url, setUrl] = useState(apiUrlOverride.get() || BUILD_API_URL);
  const [tested, setTested] = useState<{ url: string; nama: string } | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const pending = s.outbox.length;
  const same = url.trim() === API_URL;
  const test = async () => {
    setErr(null); setTested(null); setBusy(true);
    try { const r = await pingServer(url); setTested({ url: url.trim(), nama: r.nama_usaha }); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const apply = (v: string) => { apiUrlOverride.set(v === BUILD_API_URL ? '' : v); onDone?.(); location.reload(); };
  return (
    <div className="flex flex-col gap-3">
      <Field label="Alamat Apps Script (/exec)" hint="Dari Apps Script: Deploy → Manage deployments → salin Web app URL.">
        <input id="srv-url" className="input font-mono text-xs" value={url} placeholder="https://script.google.com/macros/s/…/exec" onChange={(e) => { setUrl(e.target.value); setTested(null); }} />
      </Field>
      {url && !isValidApiUrl(url) && <p className="text-xs text-bad">Alamat harus diawali https://script.google.com/</p>}
      {tested && tested.url === url.trim() && <div id="srv-ok" className="flex items-center gap-2 rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok"><CheckCircle2 size={16} />Terhubung ke <b>{tested.nama}</b></div>}
      <ErrorBox error={err} />
      {pending > 0 && !same && <div className="rounded-lg bg-warn/10 px-3 py-2 text-xs font-semibold text-warn">Masih ada {pending} data offline untuk server sekarang. Kirim dulu (Sinkron sekarang) sebelum pindah server, atau data itu ikut terbuang.</div>}
      <div className="flex flex-wrap gap-2">
        <button id="srv-test" className="btn" disabled={busy || !isValidApiUrl(url)} onClick={test}><Plug size={15} />{busy ? 'Mengetes…' : 'Tes koneksi'}</button>
        <button id="srv-save" className="btn btn-primary" disabled={same || !tested || tested.url !== url.trim() || pending > 0} onClick={() => apply(url.trim())}><Link2 size={15} />Simpan &amp; muat ulang</button>
        {apiUrlOverride.get() && <button id="srv-reset" className="btn btn-ghost" disabled={pending > 0} onClick={() => apply(BUILD_API_URL)}><RotateCcw size={15} />{BUILD_API_URL ? 'Kembali ke alamat bawaan' : 'Kembali ke mode demo'}</button>}
      </div>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CloudDownload, Info, Link2, MonitorCog, Plug, RotateCcw, Server } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ErrorBox, Field, PageHeader, Switch } from '@/components/ui/Field';
import { useAuth } from '@/auth/AuthContext';
import { api, API_URL, apiUrlOverride, BUILD_API_URL, IS_DEMO, isValidApiUrl, pingServer } from '@/lib/api';
import { useSync } from '@/lib/offline';
import { getDeviceId } from '@/platform/device';
import { autostartGet, autostartSet, machineInfo, simDesktop } from '@/platform/desktop';
import { ROLES } from '@/types';

const STATUS: Record<string, [string, string]> = { menunggu: ['Menunggu persetujuan', 'pill-warn'], disetujui: ['Disetujui', 'pill-ok'], dicabut: ['Dicabut', 'pill-bad'] };
export const maskUrl = (u: string) => (u ? u.replace(/(\/macros\/s\/)([^/]{6})[^/]*([^/]{4})(\/exec)/, '$1$2…$3$4') : '');

/** Info aplikasi desktop di PC ini: identitas, jalan otomatis, pembaruan, dan koneksi server (owner/admin). */
export function PcPage() {
  const { can } = useAuth();
  const m = useQuery({ queryKey: ['machine'], queryFn: machineInfo, staleTime: Infinity });
  const dev = useQuery({ queryKey: ['device-status'], queryFn: () => api<{ terdaftar: boolean; status?: string; kode_pc?: string; nama?: string; lokasi?: string; role_izin?: string[] }>('device.status'), retry: 0 });
  const [auto, setAuto] = useState<boolean | null>(null);
  useEffect(() => { void autostartGet().then(setAuto); }, []);
  const st = dev.data?.status ? STATUS[dev.data.status] : null;


  return (
    <>
      <PageHeader title="Aplikasi PC Ini" desc="Identitas PC, pembaruan aplikasi, dan sambungan ke server." />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><MonitorCog size={16} />PC ini</h2>
          <dl className="grid grid-cols-[130px_1fr] gap-y-2 text-sm">
            <dt className="text-muted">Nama komputer</dt><dd className="font-mono">{m.data?.hostname || '–'}</dd>
            <dt className="text-muted">Status</dt><dd>{dev.isLoading ? '…' : !dev.data?.terdaftar ? <span className="pill pill-mute">Belum terdaftar</span> : <><span className={`pill ${st?.[1]}`}>{st?.[0]}</span> <span className="ml-1 font-mono font-bold">{dev.data.kode_pc}</span></>}</dd>
            {dev.data?.lokasi && <><dt className="text-muted">Lokasi</dt><dd>{dev.data.lokasi}</dd></>}
            <dt className="text-muted">Boleh dipakai</dt><dd>{dev.data?.role_izin?.length ? dev.data.role_izin.map((r) => ROLES.find((x) => x.value === r)?.label || r).join(', ') : 'Semua role'}</dd>
            <dt className="text-muted">ID perangkat</dt><dd className="font-mono text-xs">{getDeviceId().slice(0, 12)}…</dd>
            <dt className="text-muted">Versi aplikasi</dt><dd className="font-mono">{m.data?.version || '–'}{simDesktop.get() && <span className="pill pill-brand ml-2">simulasi</span>}</dd>
          </dl>
          <ErrorBox error={dev.error} />
          <div className="mt-4 border-t border-line pt-4">
            {auto === null
              ? <p className="text-xs text-muted">Jalan otomatis saat Windows menyala diatur dari aplikasi desktop asli.</p>
              : <Switch id="pc-autostart" checked={auto} onChange={async (v) => { await autostartSet(v); setAuto(await autostartGet()); }} label="Buka Fortuner POS otomatis saat Windows menyala" />}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><CloudDownload size={16} />Versi &amp; pembaruan</h2>
          <p className="text-sm text-muted">Versi aplikasi, catatan pembaruan, dan tombol cek pembaruan ada di menu <b className="text-ink">Tentang Aplikasi</b>.</p>
          <Link to="/pengaturan/tentang" className="btn mt-3"><Info size={15} />Buka Tentang Aplikasi</Link>
        </section>

        {can('pengaturan.umum', 'ubah') && <ServerCard />}
      </div>
          </>
  );
}

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

function ServerCard() {
  return (
    <section className="card p-5 xl:col-span-2">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-bold"><Server size={16} />Koneksi server</h2>
      <p className="mb-4 text-sm text-muted">
        Sekarang: {IS_DEMO ? <b>mode demo</b> : <span className="font-mono text-xs">{maskUrl(API_URL)}</span>}
        {apiUrlOverride.get() ? ' (diatur manual di PC ini)' : ' (bawaan installer)'}.
        {' '}Pindah server membuang data lokal milik server lama: antrian offline, cache, sesi, dan data demo. Pengaturan printer tetap.
      </p>
      <ServerForm />
    </section>
  );
}

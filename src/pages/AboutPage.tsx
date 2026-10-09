import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ChevronDown, CloudDownload, Globe, Loader2, MonitorCog, Rocket, Server } from 'lucide-react';
import { PageHeader, Switch } from '@/components/ui/Field';
import { UpdateDialog } from '@/components/UpdateDialog';
import { Logo } from '@/layout/Sidebar';
import { useAuth } from '@/auth/AuthContext';
import { useSettings } from '@/lib/queries';
import { api, API_URL, apiUrlOverride, IS_DEMO } from '@/lib/api';
import { APP_VERSION, autostartGet, autostartSet, isDesktop, isTauri, machineInfo, simDesktop } from '@/platform/desktop';
import { checkUpdate, updateErrorText, type UpdateInfo } from '@/platform/updater';
import { ServerForm, maskUrl } from '@/pages/desktop/ServerForm';
import { ROLES } from '@/types';
import changelog from '@/changelog.json';

type Cek = { state: 'idle' | 'cek' | 'terbaru' | 'ada' | 'gagal'; info?: UpdateInfo; msg?: string };
const STATUS: Record<string, [string, string]> = { menunggu: ['Menunggu persetujuan', 'pill-warn'], disetujui: ['Disetujui', 'pill-ok'], dicabut: ['Dicabut', 'pill-bad'] };

/** Satu halaman untuk versi, pembaruan, identitas PC (aplikasi desktop), koneksi server, dan catatan pembaruan. */
export function AboutPage() {
  const { can } = useAuth();
  const settings = useSettings();
  const desktop = isDesktop();
  const canCheck = isTauri || simDesktop.get();
  const [cek, setCek] = useState<Cek>({ state: 'idle' });
  const [open, setOpen] = useState(false);
  const [semua, setSemua] = useState(false);
  const run = async () => {
    setCek({ state: 'cek' });
    try { const u = await checkUpdate(); setCek(u ? { state: 'ada', info: u } : { state: 'terbaru' }); }
    catch (e) { setCek({ state: 'gagal', msg: updateErrorText(e) }); }
  };
  useEffect(() => { if (canCheck) void run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const log = semua ? changelog : changelog.slice(0, 2);

  return (
    <>
      <PageHeader title="Tentang Aplikasi" desc={desktop ? 'Versi, pembaruan, dan pengaturan aplikasi di PC ini.' : 'Versi aplikasi dan catatan pembaruan.'} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-4">
          <section className="card p-5">
            <div className="flex items-center gap-4">
              <Logo size={52} />
              <div className="min-w-0">
                <div className="text-xl font-extrabold">Fortuner POS</div>
                <div className="text-sm text-muted">{settings.data?.nama_usaha || 'Sistem percetakan'}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span id="about-version" className="pill pill-brand font-mono">v{APP_VERSION}</span>
                  <span className="pill pill-mute">{desktop ? <><MonitorCog size={12} />Aplikasi PC</> : <><Globe size={12} />Versi web</>}</span>
                  <span className={`pill ${IS_DEMO ? 'pill-warn' : 'pill-ok'}`}>{IS_DEMO ? 'Mode demo' : 'Terhubung ke server'}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 border-t border-line pt-4">
              {!canCheck ? (
                <p className="text-sm text-muted">Versi web selalu yang terbaru. Muat ulang halaman (F5) untuk mendapat pembaruan.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <div id="about-update" className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                    {cek.state === 'cek' && <><Loader2 size={16} className="animate-spin text-muted" />Mengecek pembaruan…</>}
                    {cek.state === 'terbaru' && <><CheckCircle2 size={16} className="text-ok" />Sudah versi terbaru.</>}
                    {cek.state === 'ada' && <><Rocket size={16} className="text-brand" /><span>Versi <b>{cek.info?.version}</b> tersedia.</span></>}
                    {cek.state === 'gagal' && <span className="text-muted">{cek.msg}</span>}
                    {cek.state === 'idle' && <span className="text-muted">Belum dicek.</span>}
                  </div>
                  {cek.state === 'ada'
                    ? <button id="about-install" className="btn btn-primary" onClick={() => setOpen(true)}><Rocket size={15} />Perbarui</button>
                    : <button id="about-check" className="btn" disabled={cek.state === 'cek'} onClick={run}><CloudDownload size={15} />Cek pembaruan</button>}
                </div>
              )}
            </div>
          </section>

          {desktop && <PcCard />}
          {desktop && can('pengaturan.umum', 'ubah') && <ServerCard />}
        </div>

        <section className="card p-5">
          <h2 className="mb-4 text-sm font-bold">Catatan pembaruan</h2>
          <ol className="flex flex-col gap-5">
            {log.map((c) => (
              <li key={c.version} className="border-l-2 border-line pl-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold">v{c.version}</span>
                  <span className="text-xs text-muted">{new Date(c.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  {c.version === APP_VERSION && <span className="pill pill-ok">terpasang</span>}
                </div>
                <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-sm">{c.catatan.map((t) => <li key={t}>{t}</li>)}</ul>
              </li>
            ))}
          </ol>
          {changelog.length > 2 && <button className="btn btn-ghost btn-sm mt-3" onClick={() => setSemua((v) => !v)}>{semua ? 'Ringkas' : `Lihat semua (${changelog.length} versi)`}</button>}
        </section>
      </div>
      {open && cek.info && <UpdateDialog info={cek.info} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Identitas PC ini + jalan otomatis saat Windows menyala. */
function PcCard() {
  const m = useQuery({ queryKey: ['machine'], queryFn: machineInfo, staleTime: Infinity });
  const dev = useQuery({ queryKey: ['device-status'], queryFn: () => api<{ terdaftar: boolean; status?: string; kode_pc?: string; lokasi?: string; role_izin?: string[] }>('device.status'), retry: 0 });
  const [auto, setAuto] = useState<boolean | null>(null);
  useEffect(() => { void autostartGet().then(setAuto); }, []);
  const st = dev.data?.status ? STATUS[dev.data.status] : null;
  return (
    <section className="card p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><MonitorCog size={16} />PC ini</h2>
      <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
        <dt className="text-muted">Komputer</dt><dd className="font-mono">{m.data?.hostname || '–'}</dd>
        <dt className="text-muted">Status</dt>
        <dd>{dev.isLoading ? '…' : !dev.data?.terdaftar ? <span className="pill pill-mute">Belum terdaftar</span> : <><span className={`pill ${st?.[1]}`}>{st?.[0]}</span> <b className="ml-1 font-mono">{dev.data.kode_pc}</b>{dev.data.lokasi ? <span className="text-muted"> · {dev.data.lokasi}</span> : null}</>}</dd>
        <dt className="text-muted">Boleh dipakai</dt><dd>{dev.data?.role_izin?.length ? dev.data.role_izin.map((r) => ROLES.find((x) => x.value === r)?.label || r).join(', ') : 'Semua role'}</dd>
      </dl>
      {auto !== null && <div className="mt-4 border-t border-line pt-4"><Switch id="pc-autostart" checked={auto} onChange={async (v) => { await autostartSet(v); setAuto(await autostartGet()); }} label="Buka otomatis saat Windows menyala" /></div>}
    </section>
  );
}

/** Ganti alamat server (owner/admin). Tertutup secara bawaan supaya tidak terubah tanpa sengaja. */
function ServerCard() {
  const [show, setShow] = useState(false);
  return (
    <section className="card p-5">
      <button id="srv-toggle" className="flex w-full items-center gap-2 text-left text-sm font-bold" onClick={() => setShow((v) => !v)}>
        <Server size={16} />Koneksi server
        <span className="ml-2 min-w-0 flex-1 truncate font-normal text-muted">{IS_DEMO ? 'mode demo' : <span className="font-mono text-xs">{maskUrl(API_URL)}</span>}{apiUrlOverride.get() ? ' · diatur manual' : ''}</span>
        <ChevronDown size={16} className={`transition ${show ? 'rotate-180' : ''}`} />
      </button>
      {show && (
        <div className="mt-4">
          <p className="mb-3 text-xs text-muted">Pindah server membuang data lokal milik server lama (antrian offline, cache, sesi, data demo). Pengaturan printer tetap.</p>
          <ServerForm />
        </div>
      )}
    </section>
  );
}

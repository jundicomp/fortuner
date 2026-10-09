import { useEffect, useState } from 'react';
import { CheckCircle2, CloudDownload, Loader2, MonitorCog, Rocket, Globe } from 'lucide-react';
import { PageHeader } from '@/components/ui/Field';
import { UpdateDialog } from '@/components/UpdateDialog';
import { Logo } from '@/layout/Sidebar';
import { useSettings } from '@/lib/queries';
import { IS_DEMO } from '@/lib/api';
import { APP_VERSION, isDesktop, isTauri, simDesktop } from '@/platform/desktop';
import { checkUpdate, updateErrorText, type UpdateInfo } from '@/platform/updater';
import changelog from '@/changelog.json';

type Cek = { state: 'idle' | 'cek' | 'terbaru' | 'ada' | 'gagal'; info?: UpdateInfo; msg?: string };

/** Tentang aplikasi: versi yang terpasang, status pembaruan, dan catatan pembaruan. */
export function AboutPage() {
  const settings = useSettings();
  const desktop = isDesktop();
  const canCheck = isTauri || simDesktop.get();
  const [cek, setCek] = useState<Cek>({ state: 'idle' });
  const [open, setOpen] = useState(false);
  const run = async () => {
    setCek({ state: 'cek' });
    try { const u = await checkUpdate(); setCek(u ? { state: 'ada', info: u } : { state: 'terbaru' }); }
    catch (e) { setCek({ state: 'gagal', msg: updateErrorText(e) }); }
  };
  useEffect(() => { if (canCheck) void run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <PageHeader title="Tentang Aplikasi" desc="Versi yang terpasang dan catatan pembaruan." />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col gap-4">
          <section className="card flex items-center gap-4 p-5">
            <Logo size={56} />
            <div className="min-w-0">
              <div className="text-xl font-extrabold">Fortuner POS</div>
              <div className="text-sm text-muted">{settings.data?.nama_usaha || 'Sistem percetakan'}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span id="about-version" className="pill pill-brand font-mono">v{APP_VERSION}</span>
                <span className="pill pill-mute">{desktop ? <><MonitorCog size={12} />Aplikasi PC</> : <><Globe size={12} />Versi web</>}</span>
                <span className={`pill ${IS_DEMO ? 'pill-warn' : 'pill-ok'}`}>{IS_DEMO ? 'Mode demo' : 'Terhubung ke server'}</span>
              </div>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><CloudDownload size={16} />Pembaruan</h2>
            {!canCheck ? (
              <p className="text-sm text-muted">Versi web selalu memakai versi terbaru. Muat ulang halaman (F5) untuk mendapatkan pembaruan.</p>
            ) : (
              <div className="flex flex-col gap-3">
                <div id="about-update" className="flex items-center gap-2 text-sm">
                  {cek.state === 'cek' && <><Loader2 size={16} className="animate-spin text-muted" />Mengecek pembaruan…</>}
                  {cek.state === 'terbaru' && <><CheckCircle2 size={16} className="text-ok" />Anda memakai versi terbaru.</>}
                  {cek.state === 'ada' && <><Rocket size={16} className="text-brand" /><span>Versi <b>{cek.info?.version}</b> tersedia.</span></>}
                  {cek.state === 'gagal' && <span className="text-muted">{cek.msg}</span>}
                  {cek.state === 'idle' && <span className="text-muted">Belum dicek.</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {cek.state === 'ada' && <button id="about-install" className="btn btn-primary" onClick={() => setOpen(true)}><Rocket size={15} />Lihat & perbarui</button>}
                  <button id="about-check" className="btn" disabled={cek.state === 'cek'} onClick={run}><CloudDownload size={15} />Cek lagi</button>
                </div>
                <p className="text-xs text-muted">Aplikasi juga mengecek sendiri setiap dibuka. Pembaruan ditahan selama masih ada data offline yang belum terkirim.</p>
              </div>
            )}
          </section>
        </div>

        <section className="card p-5">
          <h2 className="mb-4 text-sm font-bold">Catatan pembaruan</h2>
          <ol className="flex flex-col gap-5">
            {changelog.map((c) => (
              <li key={c.version} className="relative border-l-2 border-line pl-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold">v{c.version}</span>
                  <span className="text-xs text-muted">{new Date(c.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  {c.version === APP_VERSION && <span className="pill pill-ok">terpasang</span>}
                </div>
                <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-sm">
                  {c.catatan.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      </div>
      {open && cek.info && <UpdateDialog info={cek.info} onClose={() => setOpen(false)} />}
    </>
  );
}

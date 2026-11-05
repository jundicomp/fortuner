import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, Plug, Server, TriangleAlert, X } from 'lucide-react';
import { apiUrlOverride, isValidApiUrl, pingServer } from '@/lib/api';
import { exitApp, machineInfo } from '@/platform/desktop';
import { getDeviceId } from '@/platform/device';
import { Logo } from '@/layout/Sidebar';

type Phase = 'form' | 'testing' | 'done' | 'error';
const dua = (n: number) => String(n).padStart(2, '0');
const tanggalPanjang = (d: Date) => `${['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][d.getDay()]}, ${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][d.getMonth()]} ${d.getFullYear()}`;

/**
 * Layar pertama aplikasi PC sebelum tersambung ke server.
 * Batal → tutup aplikasi (saat dibuka lagi mengulang setup). Lanjut & berhasil → animasi + rincian, lalu masuk login.
 * Hanya tampil sekali: alamat tersimpan setelah berhasil.
 */
export function ServerSetupScreen() {
  const [phase, setPhase] = useState<Phase>('form');
  const [url, setUrl] = useState('');
  const [nama, setNama] = useState('');
  const [host, setHost] = useState('');
  const [err, setErr] = useState('');
  const valid = isValidApiUrl(url);

  const coba = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!valid || phase === 'testing') return;
    setErr(''); setPhase('testing');
    try {
      const r = await pingServer(url);
      const m = await machineInfo().catch(() => null);
      setNama(r.nama_usaha); setHost(m?.hostname || 'PC ini');
      apiUrlOverride.set(url.trim());             // simpan → saat reload aplikasi masuk ke halaman login
      setPhase('done');
      setTimeout(() => window.location.reload(), 3600);
    } catch (x) {
      setErr((x as Error).message); setPhase('error');
    }
  };

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-side p-5 text-white">
      <div className="pointer-events-none absolute left-1/2 top-[-18vh] h-[70vh] w-[70vh] -translate-x-1/2 rounded-full" style={{ background: 'radial-gradient(circle, rgba(242,107,29,.25), rgba(242,107,29,0) 60%)' }} />
      {phase === 'done' && <Fireworks />}

      <div className="relative w-full max-w-md rounded-2xl bg-surface p-7 text-ink shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <Logo size={40} /><div><div className="text-lg font-extrabold leading-tight">Fortuner POS</div><div className="text-xs text-muted">Hubungkan perangkat ini ke server</div></div>
        </div>

        {phase === 'done' ? (
          <Berhasil nama={nama} host={host} />
        ) : (
          <form onSubmit={coba}>
            <label className="label" htmlFor="setup-url"><span className="flex items-center gap-1.5"><Server size={14} />Alamat server</span>
              <input id="setup-url" className="input font-mono text-xs" autoFocus disabled={phase === 'testing'} placeholder="https://script.google.com/macros/s/…/exec" value={url} onChange={(e) => { setUrl(e.target.value); setErr(''); if (phase === 'error') setPhase('form'); }} />
            </label>
            {url && !valid && <p className="mt-1 text-xs text-bad">Alamat harus diawali https://script.google.com/ dan berakhiran /exec.</p>}
            {phase === 'error' && (
              <div className="mt-3 flex gap-2 rounded-lg border border-bad/30 bg-bad/5 px-3 py-2.5 text-sm text-bad">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" /><span><b>Gagal tersambung.</b> {err} Periksa alamat &amp; internet, lalu coba lagi.</span>
              </div>
            )}
            <div className="mt-6 flex gap-2">
              <button type="button" id="setup-cancel" className="btn flex-1 py-2.5" disabled={phase === 'testing'} onClick={() => void exitApp()}><X size={16} />Batal</button>
              <button type="submit" id="setup-go" className="btn btn-primary flex-[1.6] py-2.5" disabled={!valid || phase === 'testing'}>
                {phase === 'testing' ? <><Spinner />Menghubungkan…</> : <><Plug size={16} />{phase === 'error' ? 'Ulangi' : 'Lanjut'}</>}
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 border-t border-line pt-3 text-[11px] text-muted">
          <span className="font-mono">ID perangkat: {getDeviceId().slice(0, 8)}</span>
        </div>
      </div>
    </div>
  );
}

function Berhasil({ nama, host }: { nama: string; host: string }) {
  const [now] = useState(() => new Date());
  const baris = (l: string, v: string) => (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-line py-1.5 last:border-0"><span className="text-muted">{l}</span><b className="text-right">{v}</b></div>
  );
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-ok/10"><CheckCircle2 size={40} className="text-ok" /></div>
      <div><div className="text-lg font-extrabold">Berhasil tersambung</div><div className="text-sm text-muted">Membuka halaman login…</div></div>
      <div className="mt-1 w-full rounded-xl bg-canvas/60 px-4 py-3 text-left text-[13px]">
        {baris('Server', nama)}
        {baris('Perangkat', host)}
        {baris('Tanggal', tanggalPanjang(now))}
        {baris('Jam', `${dua(now.getHours())}.${dua(now.getMinutes())}.${dua(now.getSeconds())} WIB`)}
      </div>
    </div>
  );
}

function Spinner() {
  return <span className="mr-0.5 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />;
}

/** Kembang api perayaan (canvas) saat koneksi berhasil. */
function Fireworks() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, stop = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => { cv.width = window.innerWidth * dpr; cv.height = window.innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize(); window.addEventListener('resize', resize);
    const W = () => window.innerWidth, H = () => window.innerHeight;
    const COL = ['#F26B1D', '#ff9a5c', '#ffd166', '#2E9E5B', '#4aa3ff', '#ff5d8f', '#ffffff'];
    type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string };
    let parts: P[] = [];
    const burst = (x: number, y: number) => {
      const c = COL[(Math.random() * COL.length) | 0]; const n = 46 + ((Math.random() * 26) | 0);
      for (let i = 0; i < n; i++) { const a = (Math.PI * 2 * i) / n, sp = 1.6 + Math.random() * 3.4; parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 55 + Math.random() * 35, c }); }
    };
    let t = 0;
    const tick = () => {
      if (stop) return;
      ctx.fillStyle = 'rgba(13,13,13,0.22)'; ctx.fillRect(0, 0, W(), H());
      if (!reduce && t % 16 === 0 && parts.length < 1400) burst(W() * (0.15 + Math.random() * 0.7), H() * (0.12 + Math.random() * 0.45));
      parts = parts.filter((p) => p.life < p.max);
      for (const p of parts) { p.life++; p.x += p.vx; p.y += p.vy; p.vy += 0.028; p.vx *= 0.99; const al = 1 - p.life / p.max; ctx.globalAlpha = al; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 2.1, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1; t++; raf = requestAnimationFrame(tick);
    };
    if (reduce) { for (let i = 0; i < 6; i++) burst(W() * (0.2 + i * 0.12), H() * 0.3); }
    raf = requestAnimationFrame(tick);
    return () => { stop = true; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-0" aria-hidden="true" />;
}

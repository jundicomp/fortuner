import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { IS_DEMO } from '@/lib/api';
import { Logo } from '@/layout/Sidebar';
import { getDeviceId } from '@/platform/device';
import { DesktopLoginPanel } from '@/pages/desktop/DesktopLoginPanel';
import { isDesktop } from '@/platform/desktop';

const DEMO = [['owner', 'Owner'], ['admin', 'Admin'], ['cs', 'Front Office (kantor)'], ['kasir', 'Kasir (kantor)'], ['operator', 'Operator'], ['keuangan', 'Keuangan']];

export function LoginPage() {
  const { login, notice } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e?: FormEvent, u = username, p = password) => {
    e?.preventDefault();
    setErr(''); setBusy(true);
    try { await login(u.trim(), p); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-side p-10 text-white lg:flex">
        <div className="flex items-center gap-3"><Logo size={40} /><span className="text-lg font-extrabold">Fortuner POS</span></div>
        <div>
          <h1 className="max-w-md text-4xl font-extrabold leading-tight">Kasir, order, produksi, dan keuangan percetakan dalam satu tempat.</h1>
          <p className="mt-4 max-w-md text-white/60">Harga keluar otomatis dari matriks, nota bisa dibayar berkali-kali, dan antrian mesin terlihat jelas.</p>
        </div>
        <div className="grid max-w-md grid-cols-4 gap-2" aria-hidden="true">
          {['#00AEEF', '#EC008C', '#FFF200', '#F26B1D'].map((c) => <div key={c} className="h-2 rounded-full" style={{ background: c }} />)}
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden"><Logo size={40} /><span className="text-lg font-extrabold">Fortuner POS</span></div>
          <h2 className="text-2xl font-extrabold">Masuk</h2>
          <p className="mt-1 text-sm text-muted">Gunakan akun yang dibuat admin.</p>
          {notice && <div className="mt-4 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn">{notice}</div>}
          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            <label className="label">Username
              <input id="login-username" className="input" autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </label>
            <label className="label">Password
              <div className="relative">
                <input id="login-password" className="input pr-10" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted" onClick={() => setShow((s) => !s)} aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </label>
            {err && <div className="rounded-lg border border-bad/30 bg-bad/5 px-3 py-2 text-sm text-bad">{err}</div>}
            <button className="btn btn-primary py-2.5" disabled={busy}><LogIn size={16} />{busy ? 'Memeriksa…' : 'Masuk'}</button>
          </form>
          {IS_DEMO && (
            <div className="mt-8 rounded-xl border border-dashed border-line p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-muted">Akun demo · password = username + 123</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {DEMO.map(([u, l]) => (
                  <button key={u} type="button" className="chip hover:border-brand hover:text-brand" onClick={() => { setUsername(u); setPassword(u + '123'); submit(undefined, u, u + '123'); }}>{l}</button>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">CS dan kasir ditolak sampai admin mendaftarkan perangkat ini di Pengaturan → Perangkat.</p>
            </div>
          )}
          {isDesktop() && <DesktopLoginPanel />}
          <p className="mt-6 text-center font-mono text-[10.5px] text-muted/70">ID perangkat: {getDeviceId().slice(0, 8)}</p>
        </div>
      </div>
    </div>
  );
}

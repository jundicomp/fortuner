import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, NotebookPen, Phone } from 'lucide-react';
import { labelSelesai, progresOf, sisaWaktu, type MaintStatus } from '@/lib/maintenance';

/** Ilustrasi printer mencetak nota + roda gigi berputar (animasi CSS, lihat .mt-* di index.css). */
export function MaintArt({ size = 300 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.77} viewBox="0 0 300 230" aria-hidden="true" className="mt-art">
      <g className="mt-gear mt-gear-a" style={{ transformOrigin: '232px 52px' }}>
        <circle cx="232" cy="52" r="26" fill="none" stroke="#F26B1D" strokeWidth="10" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((r) => <rect key={r} x="226" y="12" width="12" height="14" rx="3" fill="#F26B1D" transform={`rotate(${r} 232 52)`} />)}
      </g>
      <g className="mt-gear mt-gear-b" style={{ transformOrigin: '58px 70px' }}>
        <circle cx="58" cy="70" r="17" fill="none" stroke="#666" strokeWidth="7" />
        {[0, 60, 120, 180, 240, 300].map((r) => <rect key={r} x="54" y="44" width="8" height="10" rx="2" fill="#666" transform={`rotate(${r} 58 70)`} />)}
      </g>
      <rect x="70" y="40" width="160" height="40" rx="6" fill="#2a2a2a" />
      <rect x="88" y="20" width="124" height="30" rx="4" fill="#fff" opacity=".92" />
      <g className="mt-paper">
        <rect x="92" y="120" width="116" height="80" rx="3" fill="#fff" />
        <rect x="104" y="134" width="70" height="7" rx="3" fill="#F26B1D" />
        <rect x="104" y="148" width="92" height="5" rx="2" fill="#ccc" />
        <rect x="104" y="159" width="80" height="5" rx="2" fill="#ccc" />
        <rect x="104" y="170" width="88" height="5" rx="2" fill="#ccc" />
        <rect x="104" y="181" width="60" height="5" rx="2" fill="#ccc" />
      </g>
      <rect x="40" y="76" width="220" height="64" rx="16" fill="#1f1f1f" stroke="#3a3a3a" strokeWidth="2" />
      <circle className="mt-led" cx="230" cy="100" r="6" fill="#F26B1D" />
      <circle cx="210" cy="100" r="6" fill="#4caf50" />
      <rect x="62" y="96" width="90" height="8" rx="4" fill="#3a3a3a" />
      <rect x="80" y="124" width="140" height="10" rx="5" fill="#000" />
    </svg>
  );
}

/** Layar "sedang perbaikan" untuk semua pengguna. preview = versi kecil di halaman pengaturan. */
export function MaintenanceScreen({ m, onSuperadmin, preview }: { m: MaintStatus; onSuperadmin?: () => void; preview?: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t); }, []);
  const p = progresOf(m.sejak, m.selesai, now);
  const judul = m.judul || 'Sedang perbaikan sistem';
  const [a, ...b] = judul.split(' ');
  return (
    <div className={`mt-screen ${preview ? 'mt-preview' : ''}`} role="status" aria-live="polite">
      <div className="mt-grid" /><div className="mt-glow" />
      <div className="mt-body">
        <div className="mt-brand"><span className="mt-logo">{(m.nama_usaha || 'F').trim()[0]?.toUpperCase()}</span>{m.nama_usaha || 'Fortuner POS'}</div>
        <MaintArt size={preview ? 150 : 300} />
        <h1 className="mt-title">{a} <b>{b.join(' ')}</b></h1>
        <p className="mt-msg">{m.pesan}</p>
        {m.progres !== false && (
          <>
            <div className="mt-bar">{p == null ? <i className="mt-bar-run" /> : <i style={{ width: `${p}%` }} />}</div>
            {m.selesai && <div className="mt-eta">Perkiraan selesai <b>{labelSelesai(m.selesai)}</b> · {sisaWaktu(m.selesai, now)}</div>}
          </>
        )}
        {(m.manual !== false || m.kontak) && (
          <div className="mt-chips">
            {m.manual !== false && <div className="mt-chip"><NotebookPen size={16} /><span><b>Order mendesak?</b>Catat manual di buku nota</span></div>}
            {m.kontak && <div className="mt-chip"><Phone size={16} /><span><b>Hubungi admin</b>{m.kontak}</span></div>}
          </div>
        )}
      </div>
      {onSuperadmin && <button id="mt-superadmin" className="mt-sa" onClick={onSuperadmin}><Lock size={13} />Masuk sebagai superadmin</button>}
    </div>
  );
}

/** Form login khusus superadmin di atas layar perbaikan. */
export function SuperadminLogin({ onLogin, onClose }: { onLogin: (u: string, p: string) => Promise<void>; onClose: () => void }) {
  const [u, setU] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await onLogin(u.trim(), pw); } catch (x) { setErr((x as Error).message); setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-6 text-[#111] shadow-2xl" aria-label="Masuk superadmin">
        <h3 className="flex items-center gap-2.5 text-lg font-extrabold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#111] text-[#F26B1D]"><Lock size={17} /></span>Masuk superadmin</h3>
        <p className="mb-4 mt-2 text-[13px] leading-relaxed text-[#666]">Selama perbaikan hanya akun <b>Owner</b> yang bisa masuk untuk mengecek dan menyelesaikan setup.</p>
        <label className="mb-1.5 block text-xs font-bold text-[#555]" htmlFor="sa-username">Username</label>
        <input id="sa-username" className="w-full rounded-xl border-[1.5px] border-[#ddd] px-3.5 py-2.5 text-[15px] outline-none focus:border-[#F26B1D] focus:ring-[3px] focus:ring-[#F26B1D]/20" autoFocus autoComplete="username" autoCapitalize="none" value={u} onChange={(e) => setU(e.target.value)} required />
        <label className="mb-1.5 mt-3 block text-xs font-bold text-[#555]" htmlFor="sa-password">Password</label>
        <div className="relative">
          <input id="sa-password" type={show ? 'text' : 'password'} className="w-full rounded-xl border-[1.5px] border-[#ddd] px-3.5 py-2.5 pr-10 text-[15px] outline-none focus:border-[#F26B1D] focus:ring-[3px] focus:ring-[#F26B1D]/20" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
          <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#888]" onClick={() => setShow(!show)} aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
        {err && <div className="mt-3 rounded-lg bg-[#fdecea] px-3 py-2 text-[12.5px] leading-snug text-[#c62828]"><b>Ditolak.</b> {err}</div>}
        <button id="sa-submit" className="mt-5 w-full rounded-xl bg-[#F26B1D] py-3 font-extrabold text-white disabled:opacity-60" disabled={busy}>{busy ? 'Memeriksa…' : 'Masuk'}</button>
        <button type="button" className="mt-2 w-full py-2 text-sm text-[#888]" onClick={onClose}>Batal</button>
      </form>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { KeyRound, MailCheck } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * Lupa password lewat email: 1) username/email → kode 6 angka dikirim ke email akun, 2) kode + password baru.
 * Tampil sebagai jendela putih supaya bisa dipakai di layar login biasa maupun layar Mode Perbaikan.
 */
export function ForgotPassword({ onClose, onDone, awal = '' }: { onClose: () => void; onDone: (username: string, password: string) => void; awal?: string }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [akun, setAkun] = useState(awal);
  const [kode, setKode] = useState('');
  const [baru, setBaru] = useState('');
  const [ulang, setUlang] = useState('');
  const [info, setInfo] = useState('');
  const [demo, setDemo] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const kirim = async (e?: FormEvent) => {
    e?.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await api<{ pesan: string; kode_demo?: string }>('auth.forgot', { akun: akun.trim() });
      setInfo(r.pesan); setDemo(r.kode_demo || ''); setStep(2);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  const reset = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (baru !== ulang) { setErr('Ulangi password baru dengan sama persis.'); return; }
    setBusy(true);
    try {
      const r = await api<{ username: string }>('auth.reset', { akun: akun.trim(), kode: kode.trim(), baru });
      onDone(r.username, baru);
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  };

  const inp = 'w-full rounded-xl border-[1.5px] border-[#ddd] bg-white px-3.5 py-2.5 text-[15px] text-[#111] outline-none focus:border-[#F26B1D] focus:ring-[3px] focus:ring-[#F26B1D]/20';
  const lbl = 'mb-1.5 mt-3 block text-xs font-bold text-[#555]';
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={step === 1 ? kirim : reset} className="w-full max-w-sm rounded-2xl bg-white p-6 text-[#111] shadow-2xl" aria-label="Lupa password">
        <h3 className="flex items-center gap-2.5 text-lg font-extrabold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#111] text-[#F26B1D]">{step === 1 ? <KeyRound size={17} /> : <MailCheck size={17} />}</span>
          {step === 1 ? 'Lupa password' : 'Masukkan kode'}
        </h3>
        {step === 1 ? (
          <>
            <p className="mt-2 text-[13px] leading-relaxed text-[#666]">Masukkan username atau email akun. Kode 6 angka dikirim ke email yang terdaftar di akun itu.</p>
            <label className={lbl} htmlFor="fp-akun">Username atau email</label>
            <input id="fp-akun" className={inp} autoFocus autoCapitalize="none" autoComplete="username" value={akun} onChange={(e) => setAkun(e.target.value)} required />
            <p className="mt-2 text-xs text-[#888]">Akun tanpa email: minta owner/admin mereset password di Pengaturan → User.</p>
          </>
        ) : (
          <>
            <p className="mt-2 text-[13px] leading-relaxed text-[#666]">{info} Kode berlaku 15 menit.</p>
            {demo && <p className="mt-2 rounded-lg bg-[#FFF1E8] px-3 py-2 text-[13px] text-[#c4510f]">Mode demo (tanpa email): kodenya <b className="font-mono tracking-widest">{demo}</b></p>}
            <label className={lbl} htmlFor="fp-kode">Kode dari email</label>
            <input id="fp-kode" className={`${inp} text-center font-mono text-xl tracking-[.4em]`} inputMode="numeric" maxLength={6} autoFocus autoComplete="one-time-code" value={kode} onChange={(e) => setKode(e.target.value.replace(/\D/g, ''))} required />
            <label className={lbl} htmlFor="fp-baru">Password baru</label>
            <input id="fp-baru" type="password" className={inp} minLength={6} autoComplete="new-password" value={baru} onChange={(e) => setBaru(e.target.value)} required />
            <label className={lbl} htmlFor="fp-ulang">Ulangi password baru</label>
            <input id="fp-ulang" type="password" className={inp} minLength={6} autoComplete="new-password" value={ulang} onChange={(e) => setUlang(e.target.value)} required />
          </>
        )}
        {err && <div className="mt-3 rounded-lg bg-[#fdecea] px-3 py-2 text-[12.5px] leading-snug text-[#c62828]">{err}</div>}
        <button id={step === 1 ? 'fp-kirim' : 'fp-simpan'} className="mt-5 w-full rounded-xl bg-[#F26B1D] py-3 font-extrabold text-white disabled:opacity-60" disabled={busy || (step === 2 && (kode.length !== 6 || baru.length < 6))}>
          {busy ? 'Memproses…' : step === 1 ? 'Kirim kode' : 'Simpan password baru'}
        </button>
        <div className="mt-2 flex justify-between text-sm">
          <button type="button" className="py-2 text-[#888]" onClick={onClose}>Batal</button>
          {step === 2 && <button type="button" className="py-2 font-semibold text-[#F26B1D]" disabled={busy} onClick={() => { setKode(''); void kirim(); }}>Kirim ulang kode</button>}
        </div>
      </form>
    </div>
  );
}

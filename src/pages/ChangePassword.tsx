import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Field, ErrorBox } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';

export function ChangePasswordModal({ open, forced, onClose }: { open: boolean; forced: boolean; onClose: () => void }) {
  const { refresh, logout } = useAuth();
  const toast = useToast();
  const [lama, setLama] = useState('');
  const [baru, setBaru] = useState('');
  const [ulang, setUlang] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setErr(null);
    if (baru !== ulang) { setErr(new Error('Ulangi password baru dengan sama persis.')); return; }
    setBusy(true);
    try {
      await api('auth.changePassword', { lama, baru });
      toast('Password diganti');
      setLama(''); setBaru(''); setUlang('');
      await refresh();
      onClose();
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={forced ? () => {} : onClose} size="sm"
      title={forced ? 'Ganti password dulu' : 'Ganti password'}
      subtitle={forced ? 'Akun ini memakai password sementara. Buat password baru sebelum melanjutkan.' : undefined}
      footer={<>
        {forced ? <button className="btn btn-ghost" onClick={() => logout()}>Keluar</button> : <button className="btn" onClick={onClose}>Batal</button>}
        <button className="btn btn-primary" onClick={save} disabled={busy || !lama || baru.length < 6}>Simpan password</button>
      </>}>
      <div className="flex flex-col gap-3">
        <Field label="Password lama"><input id="pw-lama" type="password" className="input" value={lama} onChange={(e) => setLama(e.target.value)} autoComplete="current-password" /></Field>
        <Field label="Password baru" hint="Minimal 6 karakter."><input id="pw-baru" type="password" className="input" value={baru} onChange={(e) => setBaru(e.target.value)} autoComplete="new-password" /></Field>
        <Field label="Ulangi password baru"><input id="pw-ulang" type="password" className="input" value={ulang} onChange={(e) => setUlang(e.target.value)} autoComplete="new-password" /></Field>
        <ErrorBox error={err} />
      </div>
    </Modal>
  );
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { ErrorBox, Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { rp } from '@/lib/format';

export interface CekTarget { tabel: string; id: string; judul: string; nominal: number; status: 'sesuai' | 'bermasalah' }
export const CEK_INVALIDATE = ['kas-kecil', 'riwayat', 'notif', 'fund'];

/** Owner menandai transaksi kas kecil yang perlu dicek: Sesuai, atau Bermasalah (wajib catatan). */
export function CekModal({ t, onClose }: { t: CekTarget; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [cat, setCat] = useState('');
  const ok = t.status === 'sesuai';
  const m = useMutation({
    mutationFn: () => api('cek.set', { tabel: t.tabel, id: t.id, status: t.status, catatan: cat }),
    onSuccess: () => { CEK_INVALIDATE.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast(ok ? 'Ditandai sesuai' : 'Ditandai bermasalah'); onClose(); },
  });
  return (
    <Modal open onClose={onClose} size="sm" title={ok ? 'Tandai sesuai?' : 'Tandai bermasalah?'} subtitle={`${t.judul} · ${rp(t.nominal)}`}
      footer={<><button className="btn" onClick={onClose}>Batal</button>
        <button id="cek-ok" className={`btn ${ok ? 'border-green-700 bg-green-700 text-white' : 'btn-danger'}`} disabled={(!ok && !cat.trim()) || m.isPending} onClick={() => m.mutate()}>{ok ? <><Check size={15} />Sesuai</> : <><TriangleAlert size={15} />Bermasalah</>}</button></>}>
      <div className="flex flex-col gap-3">
        <Field label={ok ? 'Catatan (opsional)' : 'Apa masalahnya? (wajib)'}><input id="cek-cat" className="input" autoFocus placeholder={ok ? 'mis. nota sudah dicek' : 'mis. nota tidak ada, minta kasir menjelaskan'} value={cat} onChange={(e) => setCat(e.target.value)} /></Field>
        <ErrorBox error={m.error} />
      </div>
    </Modal>
  );
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ErrorBox, Field, PageHeader } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { api, IS_DEMO, purgeLocalData } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { useSettings } from '@/lib/queries';
import type { Settings } from '@/types';

export function GeneralPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const s = useSettings();
  const [d, setD] = useState<Settings>({});
  useEffect(() => { if (s.data) setD(s.data); }, [s.data]);
  const save = useMutation({ mutationFn: () => api<Settings>('settings.save', { settings: d }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast('Pengaturan disimpan'); } });
  const ro = !can('pengaturan.umum', 'ubah');
  const f = (k: string) => ({ id: `set-${k}`, className: 'input', value: d[k] ?? '', disabled: ro, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD({ ...d, [k]: e.target.value }) });

  return (
    <>
      <PageHeader title="Pengaturan Umum" desc="Identitas usaha untuk struk dan aturan dasar aplikasi." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-bold">Identitas usaha</h2>
          <div className="flex flex-col gap-4">
            <Field label="Nama usaha"><input {...f('nama_usaha')} /></Field>
            <Field label="Alamat"><input {...f('alamat')} /></Field>
            <Field label="Telepon / WhatsApp"><input {...f('telp')} inputMode="tel" /></Field>
            <Field label="Catatan di bawah struk"><textarea {...f('catatan_struk')} className="input min-h-[80px]" /></Field>
          </div>
        </section>
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-bold">Aturan</h2>
          <div className="flex flex-col gap-4">
            <Field label="Harga “banyak” mulai qty" hint="Qty sama atau lebih dari angka ini memakai kolom harga Banyak. Keputusan saat ini: 26."><input {...f('min_qty_banyak')} inputMode="numeric" /></Field>
            <Field label="Awalan nomor nota" hint="Format: AWALAN-KODEPC-BULANTAHUN-URUT, mis. FT-K1-1026-0001."><input {...f('prefix_nota')} maxLength={4} /></Field>
            <Field label="Lama sesi login (jam)" hint="Setelah ini user harus login lagi."><input {...f('sesi_jam')} inputMode="numeric" /></Field>
            <Field label="Batas perangkat aktif" hint="Jumlah maksimal PC/perangkat berstatus Disetujui. Kosongkan untuk tanpa batas."><input {...f('maks_perangkat')} inputMode="numeric" placeholder="tanpa batas" /></Field>
          </div>
        </section>
      </div>
      {!ro && (
        <div className="mt-4 flex items-center justify-end gap-3">
          <ErrorBox error={save.error} />
          <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Menyimpan…' : 'Simpan pengaturan'}</button>
        </div>
      )}
      {IS_DEMO && <DemoReset />}
    </>
  );
}

function DemoReset() {
  const [confirm, setConfirm] = useState(false);
  return (
    <section className="card mt-6 border-dashed p-5">
      <h2 className="text-sm font-bold">Mode demo</h2>
      <p className="mt-1 text-sm text-muted">Data demo tersimpan di perangkat ini saja dan tidak pernah dikirim ke Google Sheets. Kembalikan ke data contoh awal bila ingin mencoba dari nol (antrian offline demo ikut dibuang). Begitu aplikasi disambungkan ke server asli, data demo otomatis dihapus.</p>
      {!confirm ? <button id="demo-reset" className="btn btn-danger mt-3" onClick={() => setConfirm(true)}>Reset data demo</button> : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-bad">Semua perubahan demo akan hilang.</span>
          <button className="btn" onClick={() => setConfirm(false)}>Batal</button>
          <button id="demo-reset-yes" className="btn btn-danger" onClick={async () => { purgeLocalData(); const m = await import('@/lib/mockServer'); m.resetDemo(); location.reload(); }}>Ya, reset</button>
        </div>
      )}
    </section>
  );
}

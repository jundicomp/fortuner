import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Power, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ErrorBox, Field, PageHeader } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { MaintenanceScreen } from '@/components/MaintenanceScreen';
import { api } from '@/lib/api';
import { tglJam } from '@/lib/format';
import { labelSelesai, sisaWaktu, type MaintStatus } from '@/lib/maintenance';

interface MaintInfo extends MaintStatus {
  disimpan_aktif: boolean;
  sesi_lain: { id: string; nama: string; role: string; sesi: number; terakhir: string }[];
  riwayat: { waktu: string; aksi: string; oleh: string; ringkasan: string }[];
}
interface Form { judul: string; pesan: string; selesai: string; kontak: string; progres: boolean; manual: boolean; auto_off: boolean }

const DEF: Form = {
  judul: 'Sedang perbaikan sistem',
  pesan: 'Aplikasi sedang dipindahkan ke server Google. Data aman, sebentar lagi bisa dipakai kembali. Mohon jangan mencatat order di aplikasi selama perbaikan.',
  selesai: '', kontak: '', progres: true, manual: true, auto_off: false,
};
const AKSI: Record<string, [string, string]> = { maintenance_on: ['Diaktifkan', 'text-brand'], maintenance_off: ['Dimatikan', 'text-ok'], maintenance_ubah: ['Diubah', 'text-muted'] };
const ROLE: Record<string, string> = { admin: 'Admin', cs: 'CS', kasir: 'Kasir', operator: 'Operator', keuangan: 'Keuangan' };
const jam = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.') : '');

/** Pengaturan → Mode Perbaikan (hanya Owner/superadmin). */
export function MaintenancePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['maintenance', 'info'], queryFn: () => api<MaintInfo>('maintenance.get'), refetchInterval: 30_000 });
  const [f, setF] = useState<Form>(DEF);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!q.data || dirty) return;
    const d = q.data;
    setF({ judul: d.judul || DEF.judul, pesan: d.pesan || DEF.pesan, selesai: d.selesai || '', kontak: d.kontak || '', progres: d.progres !== false, manual: d.manual !== false, auto_off: !!d.auto_off });
  }, [q.data, dirty]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF((x) => ({ ...x, [k]: v })); setDirty(true); };
  const save = useMutation({
    mutationFn: (aktif: boolean) => api<MaintStatus & { dikeluarkan: number }>('maintenance.set', { ...f, aktif }),
    onSuccess: (r, aktif) => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['maintenance'] });
      toast(aktif ? `Mode perbaikan aktif${r.dikeluarkan ? ` · ${r.dikeluarkan} sesi dikeluarkan` : ''}` : 'Mode perbaikan dimatikan. Semua pengguna bisa login lagi.');
    },
  });
  const d = q.data;
  const aktif = !!d?.aktif;
  const berakhirOtomatis = !!d && d.disimpan_aktif && !d.aktif;
  const preview: MaintStatus = { aktif: true, ...f, sejak: d?.sejak || new Date().toISOString(), nama_usaha: d?.nama_usaha };
  const lain = d?.sesi_lain || [];

  return (
    <>
      <PageHeader title="Mode Perbaikan" desc="Kunci aplikasi sementara untuk setup, migrasi ke Google, atau perbaikan data. Selama aktif hanya superadmin (pengembang) dan Owner yang bisa masuk; pengguna lain melihat halaman perbaikan." />
      <ErrorBox error={q.error || save.error} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_1fr]">
        <section className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold">Status</h2>
              <p className="text-[13px] text-muted">{aktif ? `Diaktifkan ${d?.oleh ? `oleh ${d.oleh} ` : ''}${d?.sejak ? `· ${tglJam(d.sejak)}` : ''}` : berakhirOtomatis ? 'Berakhir otomatis karena waktu selesai sudah lewat.' : 'Aplikasi berjalan normal.'}</p>
            </div>
            <span id="maint-status" className={`pill ${aktif ? 'pill-brand' : 'pill-ok'}`}>{aktif ? `● AKTIF sejak ${jam(d?.sejak)}` : '● Normal'}</span>
          </div>

          <div className="mt-5 flex flex-col gap-4">
            <Field label="Judul"><input id="maint-judul" className="input" maxLength={80} value={f.judul} onChange={(e) => set('judul', e.target.value)} /></Field>
            <Field label="Pesan untuk pengguna"><textarea id="maint-pesan" className="input min-h-[90px]" maxLength={500} value={f.pesan} onChange={(e) => set('pesan', e.target.value)} /></Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Perkiraan selesai" hint={f.selesai ? `${labelSelesai(f.selesai)} · ${sisaWaktu(f.selesai)}` : 'Boleh dikosongkan.'}><input id="maint-selesai" type="datetime-local" className="input" value={f.selesai} onChange={(e) => set('selesai', e.target.value)} /></Field>
              <Field label="Kontak yang ditampilkan" hint="Nomor WA/telepon admin. Boleh dikosongkan."><input id="maint-kontak" className="input" maxLength={60} inputMode="tel" value={f.kontak} onChange={(e) => set('kontak', e.target.value)} /></Field>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-bold text-muted">Saat perbaikan</div>
              <label className="flex items-center gap-2.5 py-1 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#F26B1D]" checked={f.progres} onChange={(e) => set('progres', e.target.checked)} />Tampilkan garis progres & sisa waktu</label>
              <label className="flex items-center gap-2.5 py-1 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#F26B1D]" checked={f.manual} onChange={(e) => set('manual', e.target.checked)} />Tampilkan saran “catat manual di buku nota”</label>
              <label className="flex items-center gap-2.5 py-1 text-sm"><input id="maint-auto" type="checkbox" className="h-4 w-4 accent-[#F26B1D]" checked={f.auto_off} onChange={(e) => set('auto_off', e.target.checked)} />Matikan otomatis saat perkiraan selesai tercapai</label>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl bg-sunk px-3.5 py-3 text-[13px]">
              <Users size={16} className="mt-0.5 shrink-0 text-muted" />
              <span>{lain.length
                ? <>{lain.length} pengguna lain sedang login ({lain.map((u) => `${u.nama} · ${ROLE[u.role] || u.role}`).join(', ')}). {aktif ? 'Mereka sudah dikeluarkan; bila masih terlihat, sesinya akan ditolak server.' : 'Saat mode perbaikan diaktifkan mereka langsung dikeluarkan (paling lambat ±30 detik di layar mereka).'}</>
                : 'Tidak ada pengguna lain yang sedang login.'} Antrian offline di PC kasir tetap tersimpan dan dikirim setelah perbaikan selesai.</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button id="maint-on" className="btn btn-primary bg-ink text-canvas hover:bg-ink/90" disabled={save.isPending} onClick={() => save.mutate(true)}><Power size={16} />{aktif ? 'Simpan perubahan' : 'Simpan & aktifkan'}</button>
              {(aktif || d?.disimpan_aktif) && <button id="maint-off" className="btn" disabled={save.isPending} onClick={() => save.mutate(false)}>Matikan sekarang</button>}
              {!aktif && !d?.disimpan_aktif && dirty && <button className="btn" disabled={save.isPending} onClick={() => save.mutate(false)}>Simpan tanpa mengaktifkan</button>}
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-4">
          <section className="card p-5">
            <h2 className="mb-3 text-sm font-bold">Pratinjau halaman pengguna</h2>
            <div className="relative h-[330px] overflow-hidden rounded-[14px]"><MaintenanceScreen m={preview} preview /></div>
            <p className="mt-2 text-xs text-muted">Halaman ini tampil di layar login dan di semua perangkat yang sedang membuka aplikasi. Tombol kecil “Masuk sebagai superadmin” ada di pojok kanan bawah.</p>
          </section>
          <section className="card p-5">
            <h2 className="mb-2 text-sm font-bold">Riwayat</h2>
            {!d?.riwayat.length ? <p className="text-sm text-muted">Belum pernah diaktifkan.</p> : (
              <ul className="divide-y divide-line">
                {d.riwayat.map((r, i) => (
                  <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 text-[13px]">
                    <b className={AKSI[r.aksi]?.[1]}>{AKSI[r.aksi]?.[0] || r.aksi}</b>
                    <span className="text-muted">{r.oleh} · {tglJam(r.waktu)}</span>
                    {r.aksi === 'maintenance_on' && r.ringkasan.includes('·') && <span className="w-full text-xs text-muted">{r.ringkasan.split(' · ').slice(1).join(' · ')}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MonitorCheck } from 'lucide-react';
import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/table/DataTable';
import { Modal } from '@/components/ui/Modal';
import { ErrorBox, Field, PageHeader } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { tglJam } from '@/lib/format';
import { ROLES, type Device } from '@/types';
import { useSettings } from '@/lib/queries';
import { machineInfo, isDesktop } from '@/platform/desktop';

const ROLE_OPTS = ROLES.filter((r) => r.value !== 'owner');
const roleList = (v?: string) => (v || '').split(',').filter(Boolean);
const roleText = (v?: string) => { const l = roleList(v); return l.length ? l.map((r) => ROLES.find((x) => x.value === r)?.label || r).join(', ') : 'Semua role'; };

const STATUS: Record<string, [string, string]> = { menunggu: ['Menunggu', 'pill-warn'], disetujui: ['Disetujui', 'pill-ok'], dicabut: ['Dicabut', 'pill-bad'] };

export function DevicesPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['devices'], queryFn: () => api<Device[]>('device.list') });
  const [edit, setEdit] = useState<Partial<Device> | null>(null);
  const [reg, setReg] = useState<{ nama: string; kode_pc: string; jenis: 'web' | 'desktop'; lokasi: string; role_izin: string; info?: unknown } | null>(null);
  const settings = useSettings();
  const maks = Number(settings.data?.maks_perangkat || 0);
  const aktif = (q.data || []).filter((d) => d.status === 'disetujui').length;
  const invalidate = () => qc.invalidateQueries({ queryKey: ['devices'] });
  const save = useMutation({ mutationFn: () => api('device.save', { device: edit }), onSuccess: () => { invalidate(); toast('Perangkat diperbarui'); setEdit(null); } });
  const register = useMutation({ mutationFn: () => api('device.registerThis', reg), onSuccess: () => { invalidate(); toast('Perangkat ini terdaftar dan disetujui'); setReg(null); } });
  const thisDevice = q.data?.find((d) => d.is_this_device);
  const pending = (q.data || []).filter((d) => d.status === 'menunggu').length;
  const set = (k: keyof Device, v: unknown) => setEdit((e) => ({ ...(e || {}), [k]: v }));

  const columns: ColumnDef<Device, any>[] = [
    { accessorKey: 'kode_pc', header: 'Kode PC', cell: (c) => <span className="font-mono font-bold">{c.getValue() || '–'}</span> },
    { accessorKey: 'nama', header: 'Nama', cell: (c) => <span className="font-semibold">{c.getValue()}{c.row.original.is_this_device && <span className="pill pill-brand ml-2">Perangkat ini</span>}</span> },
    { accessorKey: 'jenis', header: 'Jenis', meta: { filter: 'select', filterLabel: (v) => (v === 'desktop' ? 'Aplikasi desktop' : 'Browser') }, cell: (c) => (c.getValue() === 'desktop' ? 'Aplikasi desktop' : 'Browser') },
    { accessorKey: 'status', header: 'Status', meta: { filter: 'select', filterLabel: (v) => STATUS[String(v)]?.[0] || String(v) }, cell: (c) => { const s = STATUS[c.getValue()] || ['?', 'pill-mute']; return <span className={`pill ${s[1]}`}>{s[0]}</span>; } },
    { id: 'role', accessorFn: (r) => roleText(r.role_izin), header: 'Boleh dipakai', cell: (c) => <span className={roleList(c.row.original.role_izin).length ? 'font-semibold' : 'text-muted'}>{c.getValue()}</span> },
    { accessorKey: 'lokasi', header: 'Lokasi', meta: { hideOnCard: true }, cell: (c) => c.getValue() || <span className="text-muted/60">–</span> },
    { id: 'komputer', accessorFn: (r) => [r.nama_komputer, r.versi_app && `v${r.versi_app}`].filter(Boolean).join(' · '), header: 'Komputer / versi', meta: { hideOnCard: true }, cell: (c) => <span className="font-mono text-xs">{c.getValue() || '–'}</span> },
    { accessorKey: 'disetujui_oleh', header: 'Disetujui oleh', meta: { hideOnCard: true } },
    { accessorKey: 'last_seen', header: 'Terakhir dipakai', cell: (c) => <span className="text-xs text-muted">{tglJam(c.getValue())}</span> },
  ];

  return (
    <>
      <PageHeader title="Perangkat"
        desc="User yang ditandai “khusus perangkat kantor” hanya bisa login dari perangkat berstatus Disetujui. Saat mereka mencoba login dari perangkat baru, permintaannya muncul di sini sebagai Menunggu." />
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="card flex items-start gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand"><MonitorCheck size={20} /></div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">Perangkat yang sedang dipakai</div>
            <div className="mt-0.5 text-sm text-muted">{thisDevice ? <>{thisDevice.nama} · <span className="font-mono">{thisDevice.kode_pc || 'tanpa kode'}</span> · {STATUS[thisDevice.status]?.[0]}</> : 'Belum terdaftar.'}</div>
            {can('pengaturan.perangkat', 'tambah') && (
              <button className="btn btn-primary btn-sm mt-3" onClick={async () => {
                register.reset();
                const m = await machineInfo();
                setReg({ nama: thisDevice?.nama || m?.hostname || '', kode_pc: thisDevice?.kode_pc || '', jenis: isDesktop() ? 'desktop' : 'web', lokasi: thisDevice?.lokasi || '', role_izin: thisDevice?.role_izin || '', info: m ? { nama: m.hostname, versi: m.version } : undefined });
              }}>
                {thisDevice ? 'Perbarui & setujui perangkat ini' : 'Daftarkan perangkat ini'}
              </button>
            )}
          </div>
        </div>
        <div className="card p-4 text-sm">
          <div className="font-bold">Kode PC dipakai di nomor nota</div>
          <p className="mt-1 text-muted">Contoh <span className="font-mono text-ink">FT-K1-1026-0001</span>: nota ke-1 dari PC K1 bulan Oktober 2026. Tiap PC punya urutan sendiri, jadi nomor tidak bentrok walaupun dibuat saat offline.</p>
          {pending > 0 && <p className="mt-2 font-semibold text-warn">{pending} perangkat menunggu persetujuan.</p>}
          <p id="dev-limit" className={`mt-2 ${maks && aktif >= maks ? 'font-semibold text-warn' : 'text-muted'}`}>{aktif} perangkat aktif{maks ? ` dari batas ${maks}` : ' · tanpa batas'} (atur di Pengaturan → Umum).</p>
        </div>
      </div>
      <DataTable<Device>
        data={q.data || []} loading={q.isLoading} columns={columns} title="Perangkat" storageKey="settings-devices"
        canExport={can('pengaturan.perangkat', 'ekspor')} initialSort={[{ id: 'status', desc: true }]}
        onRowClick={can('pengaturan.perangkat', 'ubah') ? (r) => { save.reset(); setEdit({ ...r, lebar_kertas: r.lebar_kertas || '80' }); } : undefined}
      />

      <Modal open={!!reg} onClose={() => setReg(null)} size="sm" title="Daftarkan perangkat ini"
        subtitle="Perangkat langsung berstatus Disetujui. Lakukan dari PC kantor yang dimaksud."
        footer={<><button className="btn" onClick={() => setReg(null)}>Batal</button><button className="btn btn-primary" disabled={register.isPending} onClick={() => register.mutate()}>Daftarkan</button></>}>
        {reg && (
          <div className="flex flex-col gap-3">
            <Field label="Nama perangkat"><input id="reg-nama" className="input" placeholder="mis. PC Kasir 1" value={reg.nama} onChange={(e) => setReg({ ...reg, nama: e.target.value })} /></Field>
            <Field label="Kode PC" hint="1–4 huruf/angka, unik. Dipakai di nomor nota."><input id="reg-kode" className="input font-mono uppercase" maxLength={4} placeholder="K1" value={reg.kode_pc} onChange={(e) => setReg({ ...reg, kode_pc: e.target.value.toUpperCase() })} /></Field>
            <Field label="Lokasi / keterangan"><input id="reg-lokasi" className="input" placeholder="mis. Meja kasir depan" value={reg.lokasi} onChange={(e) => setReg({ ...reg, lokasi: e.target.value })} /></Field>
            <RolePicker value={reg.role_izin} onChange={(v) => setReg({ ...reg, role_izin: v })} id="reg-role" />
            <ErrorBox error={register.error} />
          </div>
        )}
      </Modal>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Perangkat ${edit?.nama || ''}`}
        footer={<><button className="btn" onClick={() => setEdit(null)}>Batal</button><button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>Simpan</button></>}>
        {edit && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nama"><input id="dev-nama" className="input" value={edit.nama || ''} onChange={(e) => set('nama', e.target.value)} /></Field>
            <Field label="Kode PC" hint="Wajib sebelum disetujui."><input id="dev-kode" className="input font-mono uppercase" maxLength={4} value={edit.kode_pc || ''} onChange={(e) => set('kode_pc', e.target.value.toUpperCase())} /></Field>
            <Field label="Status">
              <select id="dev-status" className="input" value={edit.status} onChange={(e) => set('status', e.target.value)}>
                <option value="menunggu">Menunggu</option><option value="disetujui">Disetujui</option><option value="dicabut">Dicabut (langsung keluar)</option>
              </select>
            </Field>
            <Field label="Jenis">
              <select id="dev-jenis" className="input" value={edit.jenis} onChange={(e) => set('jenis', e.target.value)}><option value="web">Browser</option><option value="desktop">Aplikasi desktop</option></select>
            </Field>
            <Field label="Lokasi / keterangan" className="sm:col-span-2"><input id="dev-lokasi" className="input" value={edit.lokasi || ''} onChange={(e) => set('lokasi', e.target.value)} /></Field>
            <div className="sm:col-span-2"><RolePicker value={edit.role_izin || ''} onChange={(v) => set('role_izin', v)} id="dev-role" /></div>
            <Field label="Lebar kertas (cetak lewat browser)" hint="Aplikasi desktop memakai pengaturan di menu Printer & Laci pada PC itu sendiri.">
              <select id="dev-kertas" className="input" value={edit.lebar_kertas || '80'} onChange={(e) => set('lebar_kertas', e.target.value)}><option value="58">58 mm</option><option value="80">80 mm</option></select>
            </Field>
            {(edit.nama_komputer || edit.versi_app) && <div className="self-end pb-2 text-xs text-muted">Komputer <span className="font-mono">{edit.nama_komputer || '–'}</span>{edit.versi_app ? <> · aplikasi v{edit.versi_app}</> : null}</div>}
            <div className="sm:col-span-2"><ErrorBox error={save.error} /></div>
          </div>
        )}
      </Modal>
    </>
  );
}

/** Pilih role yang boleh login di perangkat ini. Kosong = semua role. Owner selalu boleh. */
function RolePicker({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  const sel = roleList(value);
  const toggle = (r: string) => onChange((sel.includes(r) ? sel.filter((x) => x !== r) : [...sel, r]).join(','));
  return (
    <div className="flex flex-col gap-1.5" id={id}>
      <span className="text-[13px] font-semibold">Role yang boleh login di perangkat ini</span>
      <div className="flex flex-wrap gap-1.5">
        {ROLE_OPTS.map((r) => (
          <button key={r.value} type="button" data-role={r.value} onClick={() => toggle(r.value)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${sel.includes(r.value) ? 'border-brand bg-brand text-white' : 'border-line text-muted hover:border-muted'}`}>{r.label}</button>
        ))}
      </div>
      <span className="text-xs text-muted">{sel.length ? `Hanya ${roleText(value)} (owner selalu boleh).` : 'Tidak dibatasi: semua role boleh login di sini.'}</span>
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Check, ImageIcon, KeyRound, Send, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { ErrorBox, Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useKasSaldo } from '@/components/SumberKas';
import { api } from '@/lib/api';
import { nf, rp, tgl, ymd } from '@/lib/format';
import { compressImage, dataUrlKB } from '@/lib/image';

interface TitipMeta { methods: { id: string; nama: string }[]; categories: { id: string; nama: string; jenis: string }[]; bills: { id: string; supplier: string; nota: string; keterangan: string; sisa: number }[] }
export interface TitipRow { ref_id: string; nominal: number; oleh: string; tanggal: string; waktu: string; keterangan: string; bukti?: string; extra?: { jenis: string; method_id: string; kategori_id: string; item: string; penerima: string; catatan: string; tanggal: string } }
const numIn = (s: string) => Number(String(s).replace(/[^\d]/g, '')) || 0;
export const TITIP_INVALIDATE = ['riwayat', 'notif', 'kas-saldo', 'expenses', 'bills', 'dashboard'];
const useTitipMeta = () => useQuery({ queryKey: ['titip-meta'], queryFn: () => api<TitipMeta>('titip.meta'), staleTime: 60e3 });

function Pw({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Password Anda (verifikasi)">
      <div className="relative"><KeyRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input id={id} type="password" autoComplete="current-password" className="input pl-9" placeholder="Masukkan password login" value={value} onChange={(e) => onChange(e.target.value)} /></div>
    </Field>
  );
}

/** Foto bukti yang bisa diperbesar. */
export function BuktiThumb({ src, className = 'h-16 w-14' }: { src?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!src) return null;
  return (
    <>
      <button type="button" className={`shrink-0 overflow-hidden rounded-lg border border-line bg-sunk ${className}`} onClick={() => setOpen(true)} title="Lihat bukti"><img src={src} alt="Bukti" className="h-full w-full object-cover" /></button>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/80 p-4" onClick={() => setOpen(false)} role="dialog" aria-label="Bukti">
          <img src={src} alt="Bukti" className="max-h-[90vh] max-w-[95vw] rounded-lg bg-white object-contain" />
          <button className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink" aria-label="Tutup"><X size={18} /></button>
        </div>
      )}
    </>
  );
}

/** Kasir mencatat pengeluaran yang sudah dibayar owner dari rekening, dengan bukti chat/transfer. */
export function TitipForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const meta = useTitipMeta();
  const m = meta.data;
  const [f, setF] = useState({ tanggal: ymd(), method_id: '', jenis: 'umum' as 'umum' | 'bahan' | 'bon', kategori_id: '', bill_id: '', item: '', nominal: '', penerima: '', catatan: '', bukti: '' });
  const [pw, setPw] = useState('');
  const [imgErr, setImgErr] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const cats = (m?.categories || []).filter((c) => (f.jenis === 'bahan' ? c.jenis === 'bahan' : c.jenis !== 'bahan'));
  const katId = f.kategori_id && cats.some((c) => c.id === f.kategori_id) ? f.kategori_id : (cats.find((c) => c.nama === 'Operasional') || cats[0])?.id || '';
  const methodId = f.method_id || m?.methods[0]?.id || '';
  const bill = m?.bills.find((b) => b.id === f.bill_id);
  const n = numIn(f.nominal);
  const save = useMutation({
    mutationFn: () => api('titip.create', { titip: { ...f, method_id: methodId, kategori_id: katId, nominal: n, item: f.jenis === 'bon' ? `Bayar bon ${bill?.supplier || ''} ${bill?.nota || ''}`.trim() : f.item }, password: pw }),
    onSuccess: () => { TITIP_INVALIDATE.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast('Titipan dikirim, menunggu konfirmasi owner'); onClose(); },
  });
  const pick = async (fl?: File | null) => {
    if (!fl) return;
    setImgErr('');
    try { set('bukti', await compressImage(fl)); } catch (e) { setImgErr((e as Error).message); }
  };
  const ok = methodId && n > 0 && f.bukti && pw && (f.jenis === 'bon' ? !!bill && n <= bill.sisa : !!katId && f.item.trim());
  return (
    <Modal open onClose={onClose} title="Titip catat pengeluaran owner" subtitle="Uang sudah dibayar owner dari rekening; Anda mencatat berdasarkan bukti"
      footer={<><button className="btn" onClick={onClose}>Batal</button><button id="tp-kirim" className="btn btn-primary" disabled={!ok || save.isPending} onClick={() => save.mutate()}><Send size={15} />Kirim ke owner</button></>}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal bayar"><input id="tp-tanggal" type="date" className="input" max={ymd()} value={f.tanggal} onChange={(e) => set('tanggal', e.target.value)} /></Field>
          <Field label="Dibayar dari rekening"><select id="tp-method" className="input" value={methodId} onChange={(e) => set('method_id', e.target.value)}>{m?.methods.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}</select></Field>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Jenis">
          {([['umum', 'Pengeluaran umum'], ['bahan', 'Bahan'], ['bon', 'Bayar bon supplier']] as const).map(([k, l]) => (
            <button key={k} type="button" id={`tp-jenis-${k}`} className={`flex-1 rounded-lg border px-2 py-2 text-xs font-semibold ${f.jenis === k ? 'border-ink bg-ink text-canvas' : 'border-line hover:border-muted'}`} onClick={() => set('jenis', k)}>{l}</button>
          ))}
        </div>
        {f.jenis === 'bon' ? (
          <Field label="Bon supplier yang dibayar">
            <select id="tp-bill" className="input" value={f.bill_id} onChange={(e) => { set('bill_id', e.target.value); const b = m?.bills.find((x) => x.id === e.target.value); if (b && !f.nominal) set('nominal', String(b.sisa)); }}>
              <option value="">– pilih bon –</option>
              {m?.bills.map((b) => <option key={b.id} value={b.id}>{b.supplier} · {b.nota || b.keterangan} · sisa Rp {nf(b.sisa)}</option>)}
            </select>
          </Field>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <Field label="Untuk pembayaran apa" className="sm:col-span-3"><input id="tp-item" className="input" placeholder="mis. servis AC ruang produksi" value={f.item} onChange={(e) => set('item', e.target.value)} /></Field>
            <Field label="Kategori" className="sm:col-span-2"><select id="tp-kategori" className="input" value={katId} onChange={(e) => set('kategori_id', e.target.value)}>{cats.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}</select></Field>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nominal (Rp)"><input id="tp-nominal" className="input num text-right text-lg font-bold" inputMode="numeric" placeholder="0" value={f.nominal ? nf(n) : ''} onChange={(e) => set('nominal', e.target.value)} /></Field>
          <Field label="Dibayar ke (opsional)"><input id="tp-penerima" className="input" placeholder="mis. CV Sejuk Teknik" value={f.penerima} onChange={(e) => set('penerima', e.target.value)} /></Field>
        </div>
        {bill && n > bill.sisa && <p className="-mt-1 text-xs font-semibold text-bad">Melebihi sisa bon ({rp(bill.sisa)}).</p>}
        <div>
          <div className="mb-1.5 text-xs font-semibold text-muted">Bukti (screenshot chat / bukti transfer) — wajib</div>
          <input ref={file} id="tp-bukti" type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          {f.bukti ? (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-brand bg-brand/5 p-2.5">
              <BuktiThumb src={f.bukti} />
              <div className="text-xs"><b>Foto terlampir</b><div className="text-muted">diperkecil otomatis · {dataUrlKB(f.bukti)} KB</div><button type="button" className="font-semibold text-brand" onClick={() => file.current?.click()}>Ganti foto</button></div>
            </div>
          ) : (
            <button type="button" className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-4 text-sm font-semibold text-muted hover:border-brand hover:text-brand" onClick={() => file.current?.click()}><Camera size={17} />Pilih / ambil foto bukti</button>
          )}
          {imgErr && <p className="mt-1 text-xs text-bad">{imgErr}</p>}
        </div>
        <Field label="Catatan (opsional)"><input id="tp-catatan" className="input" placeholder="mis. instruksi dari owner via WA jam 09.00" value={f.catatan} onChange={(e) => set('catatan', e.target.value)} /></Field>
        <Pw id="tp-password" value={pw} onChange={setPw} />
        <p className="rounded-lg bg-sunk px-3 py-2 text-xs text-muted">Status <b className="text-ink">Menunggu konfirmasi owner</b>. Saldo rekening &amp; laporan belum berubah sampai owner mengonfirmasi.</p>
        <ErrorBox error={save.error} />
      </div>
    </Modal>
  );
}

/** Owner memeriksa bukti, boleh mengoreksi, lalu Konfirmasi (masuk Pengeluaran) atau Tolak. */
export function TitipDecideModal({ row, terima, onClose }: { row: TitipRow; terima: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const meta = useTitipMeta();
  const ks = useKasSaldo();
  const x = row.extra;
  const [nominal, setNominal] = useState(String(row.nominal));
  const [methodId, setMethodId] = useState(x?.method_id || '');
  const [katId, setKatId] = useState(x?.kategori_id || '');
  const [cat, setCat] = useState('');
  const [pw, setPw] = useState('');
  const n = numIn(nominal);
  const saldo = ks.data?.find((a) => a.id === methodId)?.saldo;
  const cats = (meta.data?.categories || []).filter((c) => (x?.jenis === 'bahan' ? c.jenis === 'bahan' : c.jenis !== 'bahan'));
  const m = useMutation({
    mutationFn: () => api('titip.decide', { id: row.ref_id, konfirmasi: terima, catatan: cat, password: pw, koreksi: terima ? { nominal: n, method_id: methodId, kategori_id: katId } : undefined }),
    onSuccess: () => { TITIP_INVALIDATE.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast(terima ? `Titipan ${rp(n)} dikonfirmasi & dicatat` : 'Titipan ditolak'); onClose(); },
  });
  return (
    <Modal open onClose={onClose} size="lg" title={terima ? 'Konfirmasi pengeluaran titipan' : 'Tolak titipan?'} subtitle={`Dicatat ${row.oleh} · ${tgl(x?.tanggal || row.tanggal)}`}
      footer={<><button className="btn" onClick={onClose}>Batal</button>
        <button id="tp-decide-ok" className={`btn ${terima ? 'border-green-700 bg-green-700 text-white' : 'btn-danger'}`} disabled={!pw || (!terima && !cat.trim()) || (terima && !n) || m.isPending} onClick={() => m.mutate()}>{terima ? <><Check size={15} />Konfirmasi &amp; catat {rp(n)}</> : <><X size={15} />Tolak</>}</button></>}>
      <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <div>{row.bukti ? <BuktiThumb src={row.bukti} className="h-64 w-full sm:w-[200px]" /> : <div className="grid h-40 place-items-center rounded-lg bg-sunk text-muted"><ImageIcon /></div>}<p className="mt-1 text-center text-[11px] text-muted">Klik foto untuk memperbesar</p></div>
        <div className="flex flex-col gap-3 text-sm">
          <div className="rounded-lg bg-sunk px-3 py-2"><div className="font-semibold">{x?.item || row.keterangan}</div>{x?.penerima && <div className="text-xs text-muted">Dibayar ke {x.penerima}</div>}{x?.catatan && <div className="text-xs text-muted">“{x.catatan}”</div>}</div>
          {terima ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nominal (Rp)"><input id="tp-k-nominal" className="input num text-right text-lg font-bold" inputMode="numeric" value={nominal ? nf(n) : ''} onChange={(e) => setNominal(e.target.value)} /></Field>
                <Field label="Dari rekening"><select id="tp-k-method" className="input" value={methodId} onChange={(e) => setMethodId(e.target.value)}>{meta.data?.methods.map((mm) => <option key={mm.id} value={mm.id}>{mm.nama}</option>)}</select></Field>
              </div>
              {saldo != null && <div className="-mt-1 flex justify-between text-xs text-muted"><span>Saldo rekening di sistem → setelah dicatat</span><b className="num text-ink">{rp(saldo)} → {rp(saldo - n)}</b></div>}
              {x?.jenis !== 'bon' && <Field label="Kategori (boleh dikoreksi)"><select id="tp-k-kategori" className="input" value={katId} onChange={(e) => setKatId(e.target.value)}>{cats.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}</select></Field>}
              <Field label="Catatan (opsional)"><input id="tp-k-cat" className="input" value={cat} onChange={(e) => setCat(e.target.value)} /></Field>
            </>
          ) : (
            <Field label="Alasan penolakan (wajib)"><input id="tp-k-cat" className="input" autoFocus placeholder="mis. nominal beda dengan chat, cek lagi" value={cat} onChange={(e) => setCat(e.target.value)} /></Field>
          )}
          <Pw id="tp-k-pw" value={pw} onChange={setPw} />
          <ErrorBox error={m.error} />
        </div>
      </div>
    </Modal>
  );
}

/** Ambil data titipan berdasarkan id (dipakai dari notifikasi), lalu buka modal keputusan. */
export function TitipDecideById({ id, terima, onClose }: { id: string; terima: boolean; onClose: () => void }) {
  const q = useQuery({ queryKey: ['riwayat', 'titip', '', ''], queryFn: () => api<{ rows: (TitipRow & { key: string })[] }>('riwayat.list', { tab: 'titip' }) });
  const row = q.data?.rows.find((r) => r.ref_id === id);
  if (!row) return null;
  return <TitipDecideModal row={row} terima={terima} onClose={onClose} />;
}

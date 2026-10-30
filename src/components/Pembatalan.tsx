import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Ban, Banknote, Check, Image as ImageIcon, Landmark, Lock, WalletCards, X, Zap } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ErrorBox, Field } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { BuktiThumb } from '@/components/Titip';
import { api } from '@/lib/api';
import { compressImage } from '@/lib/image';
import { nf, rp, tglJam } from '@/lib/format';
import type { OrderDetail } from '@/types';

/** Query yang perlu disegarkan setelah pembatalan / refund / deposit berubah. */
export const BATAL_INVALIDATE = ['order', 'orders', 'riwayat', 'notif', 'kas-saldo', 'dashboard', 'pembatalan', 'refunds', 'deposit', 'customer-profile', 'master'];
export function useInvalidateBatal() {
  const qc = useQueryClient();
  return () => BATAL_INVALIDATE.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export const CN_STATUS: Record<string, [string, string]> = { menunggu: ['Menunggu', 'pill-warn'], disetujui: ['Disetujui', 'pill-ok'], ditolak: ['Ditolak', 'pill-bad'] };
export const RF_STATUS: Record<string, [string, string]> = { menunggu: ['Menunggu persetujuan', 'pill-warn'], siap: ['Siap dibayar', 'pill-brand'], dibayar: ['Dibayar', 'pill-ok'], ditolak: ['Ditolak', 'pill-bad'] };
const PENYELESAIAN: { k: 'deposit' | 'tunai' | 'transfer'; l: string; s: string; Icon: typeof Banknote }[] = [
  { k: 'deposit', l: 'Deposit', s: 'jadi saldo konsumen', Icon: WalletCards },
  { k: 'tunai', l: 'Tunai', s: 'dari laci kasir', Icon: Banknote },
  { k: 'transfer', l: 'Transfer', s: 'dari rekening + bukti', Icon: Landmark },
];

export function Opt({ on, onClick, title, sub, id }: { on: boolean; onClick: () => void; title: ReactNode; sub?: ReactNode; id?: string }) {
  return (
    <button type="button" id={id} role="radio" aria-checked={on} onClick={onClick}
      className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition ${on ? 'border-brand bg-brand/10' : 'border-line hover:bg-sunk'}`}>
      <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-brand' : 'border-line'}`}>{on && <span className="h-2 w-2 rounded-full bg-brand" />}</span>
      <span><b className="block">{title}</b>{sub && <span className="text-xs text-muted">{sub}</span>}</span>
    </button>
  );
}
export function Pw({ id, value, onChange, label = 'Password Anda' }: { id: string; value: string; onChange: (v: string) => void; label?: string }) {
  return <Field label={<>{label} <span className="text-bad">*</span></>}><div className="relative"><input id={id} type="password" autoComplete="current-password" className="input pr-9" value={value} onChange={(e) => onChange(e.target.value)} /><Lock size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" /></div></Field>;
}
function Foto({ id, value, onChange, label, wajib }: { id: string; value: string; onChange: (v: string) => void; label: string; wajib?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');
  return (
    <Field label={<>{label}{wajib && <span className="text-bad"> *</span>}</>}>
      <input ref={ref} id={id} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setErr(''); try { onChange(await compressImage(f)); } catch (x) { setErr((x as Error).message); } }} />
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-brand bg-brand/5 p-2"><BuktiThumb src={value} className="h-12 w-11" /><span className="flex-1 text-xs text-muted">Foto terlampir</span><button type="button" className="btn btn-sm" onClick={() => onChange('')}>Hapus</button></div>
      ) : <button type="button" className="btn justify-start text-muted" onClick={() => ref.current?.click()}><ImageIcon size={16} />Pilih foto…</button>}
      {err && <span className="text-xs text-bad">{err}</span>}
    </Field>
  );
}
const Sum = ({ rows }: { rows: [ReactNode, ReactNode, string?][] }) => (
  <div className="flex flex-col gap-1.5 rounded-xl bg-sunk px-3.5 py-3 text-sm">
    {rows.map(([l, v, cls], i) => <div key={i} className={`flex justify-between gap-3 ${cls || ''}`}><span>{l}</span><span className="num">{v}</span></div>)}
  </div>
);

interface Preview { nilai: number; nilai_produksi: number; terbayar: number; jenis: string; level: 'cepat' | 'admin' | 'owner'; alasan_level: string; ada_pengajuan: boolean; lines: { id: string; nama: string; qty: number; nilai: number; diproduksi: boolean }[]; kategori: string[] }

/** Ajukan pembatalan dari detail nota: penuh atau sebagian. */
export function BatalModal({ d, onClose }: { d: OrderDetail; onClose: () => void }) {
  const toast = useToast();
  const inv = useInvalidateBatal();
  const o = d.order;
  const sisaItem = (i: OrderDetail['items'][number]) => i.qty - (i.qty_batal || 0);
  const aktif = d.items.filter((i) => sisaItem(i) > 0);
  const [jenis, setJenis] = useState<'penuh' | 'sebagian'>('penuh');
  const [qty, setQty] = useState<Record<string, number>>({});
  const [kategori, setKategori] = useState('');
  const [alasan, setAlasan] = useState('');
  const [lampiran, setLampiran] = useState('');
  const [keinginan, setKeinginan] = useState<'deposit' | 'tunai' | 'transfer'>('deposit');
  const items = jenis === 'penuh' ? aktif.map((i) => ({ id: i.id, qty: sisaItem(i) })) : Object.entries(qty).filter(([, q]) => q > 0).map(([id, q]) => ({ id, qty: q }));
  const pv = useQuery({
    queryKey: ['pembatalan', 'preview', o.id, jenis, JSON.stringify(items)], enabled: items.length > 0, retry: 0,
    queryFn: () => api<Preview>('cancel.preview', { order_id: o.id, jenis, items }),
  });
  const send = useMutation({
    mutationFn: () => api<{ cancellation: { status: string; nomor: string } }>('cancel.request', { order_id: o.id, jenis, items, alasan: alasan.trim(), kategori, lampiran, keinginan }),
    onSuccess: (r) => { inv(); toast(r.cancellation.status === 'disetujui' ? `Nota dibatalkan (${r.cancellation.nomor})` : `Pengajuan ${r.cancellation.nomor} dikirim, menunggu persetujuan`); onClose(); },
  });
  const p = pv.data;
  const cepat = p?.level === 'cepat';
  const ok = items.length > 0 && kategori && alasan.trim() && p && !p.ada_pengajuan;
  return (
    <Modal open onClose={onClose} size="lg" title={<>Batalkan nota <span className="font-mono">{o.nomor}</span></>} subtitle={`${o.customer_nama || ''} · ${tglJam(o.created_at)} · CS ${o.cs_nama || ''}`}
      footer={<><button className="btn" onClick={onClose}>Batal</button><button id="btl-kirim" className={`btn ${cepat ? 'btn-danger' : 'btn-primary'}`} disabled={!ok || send.isPending} onClick={() => send.mutate()}>{cepat ? <><Ban size={16} />Batalkan sekarang</> : `Ajukan ke ${p?.level === 'owner' ? 'Owner' : 'Admin'}`}</button></>}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          <Opt id="btl-penuh" on={jenis === 'penuh'} onClick={() => setJenis('penuh')} title="Batal penuh" sub="Semua item yang tersisa" />
          <Opt id="btl-sebagian" on={jenis === 'sebagian'} onClick={() => setJenis('sebagian')} title="Batal sebagian" sub="Pilih item & jumlah" />
        </div>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="tbl w-full min-w-[520px] text-[13px]">
            <thead><tr><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-right">Sisa qty</th><th className="px-3 py-2 text-right">Subtotal</th><th className="px-3 py-2 text-left">Produksi</th>{jenis === 'sebagian' && <th className="w-28 px-3 py-2">Qty batal</th>}</tr></thead>
            <tbody>{aktif.map((i) => {
              const prod = !!i.stok_at || i.status_produksi === 'proses' || i.status_produksi === 'selesai';
              return (
                <tr key={i.id} className="border-t border-line">
                  <td className="px-3 py-2 font-semibold">{i.nama_produk}{(i.qty_batal || 0) > 0 && <span className="ml-1 text-xs font-normal text-muted">({nf(i.qty_batal!)} sudah batal)</span>}</td>
                  <td className="num px-3 py-2 text-right">{nf(sisaItem(i))}</td>
                  <td className="num px-3 py-2 text-right">{nf(Math.round(i.subtotal * sisaItem(i) / i.qty))}</td>
                  <td className="px-3 py-2"><span className={`pill ${prod ? 'pill-bad' : 'pill-ok'}`}>{prod ? 'Sudah diproduksi' : 'Belum dikerjakan'}</span></td>
                  {jenis === 'sebagian' && <td className="px-3 py-1.5"><input id={`btl-q-${i.id}`} className="input num py-1 text-right" inputMode="numeric" value={qty[i.id] ? nf(qty[i.id]) : ''} placeholder="0"
                    onChange={(e) => setQty({ ...qty, [i.id]: Math.min(sisaItem(i), Number(e.target.value.replace(/[^\d]/g, '')) || 0) })} /></td>}
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        {p && (p.ada_pengajuan
          ? <div className="flex gap-2 rounded-xl bg-bad/10 px-3 py-2.5 text-sm text-bad"><AlertTriangle size={16} className="mt-0.5 shrink-0" />Nota ini masih punya pengajuan pembatalan yang menunggu persetujuan.</div>
          : cepat
            ? <div className="flex gap-2 rounded-xl bg-blue-500/10 px-3 py-2.5 text-sm"><Zap size={16} className="mt-0.5 shrink-0 text-blue-600" /><span><b>Jalur cepat:</b> {p.alasan_level}. Pembatalan langsung berlaku tanpa persetujuan, tetap tercatat dan owner mendapat notifikasi.</span></div>
            : <div className="flex gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-sm"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" /><span>Perlu persetujuan <b>{p.level === 'owner' ? 'Owner' : 'Admin / Keuangan'}</b> karena {p.alasan_level}.</span></div>)}
        <Field label={<>Alasan <span className="text-bad">*</span></>}>
          <div className="mb-2 flex flex-wrap gap-1.5">{(p?.kategori || ['Konsumen batal / acara diundur', 'Ganti desain', 'Salah input FO', 'Hasil cetak tidak sesuai', 'Lainnya']).map((k) => (
            <button key={k} type="button" className={`chip px-2.5 py-1 text-xs ${kategori === k ? 'border-ink bg-ink text-canvas' : ''}`} onClick={() => setKategori(k)}>{k}</button>
          ))}</div>
          <textarea id="btl-alasan" className="input min-h-[64px]" value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Jelaskan singkat, mis. konsumen ganti desain total, konfirmasi lewat WA" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Foto id="btl-lampiran" value={lampiran} onChange={setLampiran} label="Lampiran (opsional)" />
          {!!p?.terbayar && <Field label="Keinginan konsumen soal uang" hint="Keputusan akhir oleh owner.">
            <select id="btl-keinginan" className="input" value={keinginan} onChange={(e) => setKeinginan(e.target.value as typeof keinginan)}><option value="deposit">Simpan sebagai deposit</option><option value="tunai">Dikembalikan tunai</option><option value="transfer">Dikembalikan transfer</option></select>
          </Field>}
        </div>
        {p && <Sum rows={[['Nilai item dibatalkan', rp(p.nilai), 'font-semibold'], ['Sudah dibayar konsumen', rp(p.terbayar)], ...(p.nilai_produksi ? [['Biaya ditahan', 'ditentukan owner', 'text-muted'] as [ReactNode, ReactNode, string]] : [])]} />}
        <ErrorBox error={pv.error || send.error} />
      </div>
    </Modal>
  );
}

interface CnDetail {
  id: string; nomor: string; status: string; level: string; jenis: string; kategori: string; alasan: string; lampiran: string; keinginan: string; created_at: string; order_id: string;
  nilai_item: number; nilai_produksi: number; hpp_estimasi: number; ditahan: number; nilai_batal: number; kelebihan: number; penyelesaian: string; terbayar: number; catatan_owner: string; diputus_at: string;
  order_nomor: string; order_total: number; customer_nama: string; diajukan_nama: string; diputus_nama: string; refund_status: string; refund_nomor: string;
  items: { id: string; nama: string; qty: number; qty_batal: number; nilai: number; diproduksi: boolean; hpp_estimasi: number }[];
  bisa_putuskan: boolean; setting: { mode: string; persen: number }; sisa_sebelum: number; saran: { hpp: number; persen: number }; flag: string;
}

/** Periksa & putuskan pengajuan pembatalan (owner / admin). Juga dipakai untuk melihat dokumen yang sudah diputuskan. */
export function CancelDecideModal({ id, onClose }: { id: string; onClose: () => void }) {
  const toast = useToast();
  const inv = useInvalidateBatal();
  const q = useQuery({ queryKey: ['pembatalan', 'get', id], queryFn: () => api<CnDetail>('cancel.get', { id }) });
  const c = q.data;
  const [mode, setMode] = useState<string>('');
  const [persen, setPersen] = useState('');
  const [manual, setManual] = useState('');
  const [peny, setPeny] = useState<'deposit' | 'tunai' | 'transfer' | ''>('');
  const [catatan, setCatatan] = useState('');
  const [pw, setPw] = useState('');
  const [tolak, setTolak] = useState(false);
  const m = mode || c?.setting.mode || 'hpp';
  const pct = persen === '' ? c?.setting.persen ?? 50 : Number(persen) || 0;
  const prod = c?.nilai_produksi || 0;
  const ditahan = !c || !prod ? 0 : Math.min(c.nilai_item, Math.max(0, m === 'hpp' ? c.saran.hpp : m === 'persen' ? Math.round(prod * Math.min(100, pct) / 100) : Number(manual.replace(/[^\d]/g, '')) || 0));
  const nilaiBatal = (c?.nilai_item || 0) - ditahan;
  // sisa tagihan sebelum batal (bisa negatif) dikurangi pembatalan → kelebihan bila minus
  const sisaBaru = (c?.sisa_sebelum || 0) - nilaiBatal;
  const kelebihan = Math.max(0, -sisaBaru);
  const pilihPeny = peny || (c?.keinginan as typeof peny) || 'deposit';
  const dec = useMutation({
    mutationFn: () => api('cancel.decide', { id, setuju: !tolak, ditahan_mode: m, ditahan_persen: pct, ditahan_manual: Number(manual.replace(/[^\d]/g, '')) || 0, penyelesaian: pilihPeny, catatan: catatan.trim(), password: pw }),
    onSuccess: () => { inv(); toast(tolak ? 'Pengajuan ditolak' : 'Pembatalan disetujui'); onClose(); },
  });
  const putus = !!c?.bisa_putuskan;
  return (
    <Modal open onClose={onClose} size="lg" title={c ? <>{putus ? 'Setujui pembatalan' : 'Pembatalan'} <span className="font-mono">{c.nomor}</span></> : 'Memuat…'}
      subtitle={c ? `Diajukan ${c.diajukan_nama} · ${tglJam(c.created_at)} · nota ${c.order_nomor} · ${c.customer_nama}` : undefined}
      footer={putus ? (tolak
        ? <><button className="btn" onClick={() => setTolak(false)}>Kembali</button><button id="cd-tolak-ok" className="btn btn-danger" disabled={!catatan.trim() || !pw || dec.isPending} onClick={() => dec.mutate()}><X size={16} />Tolak pengajuan</button></>
        : <><button id="cd-tolak" className="btn text-bad" onClick={() => setTolak(true)}>Tolak</button><button id="cd-setuju" className="btn btn-primary" disabled={!pw || dec.isPending} onClick={() => dec.mutate()}><Check size={16} />Setujui &amp; proses</button></>)
        : <button className="btn" onClick={onClose}>Tutup</button>}>
      <ErrorBox error={q.error} />
      {c && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <span className={`pill ${CN_STATUS[c.status]?.[1]}`}>{CN_STATUS[c.status]?.[0]}</span>
            <span className="pill pill-mute">{c.jenis === 'penuh' ? 'Batal penuh' : 'Batal sebagian'}</span>
            <span className={`pill ${c.level === 'owner' ? 'pill-ink' : 'pill-mute'}`}>{c.level === 'owner' ? 'Persetujuan owner' : c.level === 'admin' ? 'Persetujuan admin' : 'Jalur cepat'}</span>
            {c.flag && <span className="pill pill-warn"><AlertTriangle size={11} />{c.flag}</span>}
          </div>
          <div className="flex gap-3 rounded-xl bg-blue-500/10 px-3.5 py-2.5 text-sm">
            {c.lampiran && <BuktiThumb src={c.lampiran} className="h-14 w-12" />}
            <span><b>{c.kategori}</b><br />"{c.alasan}"</span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="tbl w-full min-w-[460px] text-[13px]">
              <thead><tr><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-right">Qty batal</th><th className="px-3 py-2 text-right">Nilai</th><th className="px-3 py-2 text-left">Produksi</th></tr></thead>
              <tbody>{c.items.map((i) => (
                <tr key={i.id} className="border-t border-line"><td className="px-3 py-2 font-semibold">{i.nama}</td><td className="num px-3 py-2 text-right">{nf(i.qty_batal)} / {nf(i.qty)}</td><td className="num px-3 py-2 text-right">{nf(i.nilai)}</td>
                  <td className="px-3 py-2"><span className={`pill ${i.diproduksi ? 'pill-bad' : 'pill-ok'}`}>{i.diproduksi ? 'Sudah diproduksi' : 'Belum'}</span></td></tr>
              ))}</tbody>
            </table>
          </div>
          {putus && !tolak ? (
            <>
              {prod > 0 && (
                <Field label={<>Biaya yang ditahan (item sudah diproduksi) <span className="text-bad">*</span></>} hint="Bagian ini tetap jadi omzet dan ditagih ke konsumen.">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup">
                    <Opt id="cd-hpp" on={m === 'hpp'} onClick={() => setMode('hpp')} title="HPP" sub={c.saran.hpp ? rp(c.saran.hpp) : 'HPP belum tercatat'} />
                    <Opt id="cd-persen" on={m === 'persen'} onClick={() => setMode('persen')} title="Persen" sub={<span className="flex items-center gap-1"><input id="cd-persen-v" className="input num w-14 py-0.5 text-right" value={persen === '' ? String(c.setting.persen) : persen} onChange={(e) => { setMode('persen'); setPersen(e.target.value.replace(/[^\d]/g, '')); }} />% dari {nf(prod)}</span>} />
                    <Opt id="cd-manual" on={m === 'manual'} onClick={() => setMode('manual')} title="Manual" sub={<input id="cd-manual-v" className="input num w-28 py-0.5 text-right" inputMode="numeric" value={manual ? nf(Number(manual.replace(/[^\d]/g, ''))) : ''} placeholder="0" onChange={(e) => { setMode('manual'); setManual(e.target.value); }} />} />
                  </div>
                </Field>
              )}
              <Sum rows={[
                ['Nilai item dibatalkan', rp(c.nilai_item)],
                ...(prod ? [['Biaya ditahan (tetap jadi omzet)', `− ${rp(ditahan)}`] as [ReactNode, ReactNode]] : []),
                ['Pembatalan penjualan', rp(nilaiBatal), 'font-bold text-brand'],
                ['Sudah dibayar konsumen', rp(c.terbayar)],
                [kelebihan ? 'Kelebihan bayar konsumen' : 'Sisa tagihan setelah batal', rp(kelebihan || Math.max(0, sisaBaru)), `border-t border-dashed border-line pt-1.5 font-bold ${kelebihan ? 'text-ok' : ''}`],
              ]} />
              {kelebihan > 0 && (
                <Field label={<>Kelebihan {rp(kelebihan)} dikembalikan lewat <span className="text-bad">*</span></>}>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup">
                    {PENYELESAIAN.map(({ k, l, s }) => <Opt key={k} id={`cd-peny-${k}`} on={pilihPeny === k} onClick={() => setPeny(k)} title={l} sub={s} />)}
                  </div>
                </Field>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Catatan"><input id="cd-catatan" className="input" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="opsional" /></Field>
                <Pw id="cd-pw" value={pw} onChange={setPw} />
              </div>
            </>
          ) : putus && tolak ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={<>Alasan penolakan <span className="text-bad">*</span></>}><input id="cd-alasan-tolak" className="input" value={catatan} onChange={(e) => setCatatan(e.target.value)} /></Field>
              <Pw id="cd-pw" value={pw} onChange={setPw} />
            </div>
          ) : (
            <Sum rows={[
              ['Nilai item', rp(c.nilai_item)], ...(c.status === 'disetujui' ? [
                ['Biaya ditahan', rp(c.ditahan)], ['Pembatalan penjualan', rp(c.nilai_batal), 'font-bold'],
                ...(c.kelebihan ? [[`Kelebihan → ${c.penyelesaian}`, `${rp(c.kelebihan)}${c.refund_nomor ? ` · ${c.refund_nomor} ${RF_STATUS[c.refund_status]?.[0] || ''}` : ''}`] as [ReactNode, ReactNode]] : []),
                ['Diputuskan', `${c.diputus_nama} · ${tglJam(c.diputus_at)}`],
              ] as [ReactNode, ReactNode, string?][] : c.status === 'ditolak' ? [['Ditolak', `${c.diputus_nama} · "${c.catatan_owner}"`]] as [ReactNode, ReactNode][] : [['Status', c.level === 'owner' ? 'Menunggu persetujuan owner' : 'Menunggu persetujuan admin']] as [ReactNode, ReactNode][]),
            ]} />
          )}
          <ErrorBox error={dec.error} />
        </div>
      )}
    </Modal>
  );
}

export interface RefundRow {
  id: string; nomor: string; tanggal: string; customer_id: string; customer_nama: string; sumber: string; order_nomor: string; nominal: number; cara: string; status: string; alasan: string;
  method_nama: string; penerima: string; bukti: string; dibayar_nama: string; diputus_nama: string; diajukan_nama: string; dibayar_at: string; created_at: string; bisa_bayar: boolean; bisa_putuskan: boolean;
}

/** Bayar refund yang sudah disetujui: tunai dari laci sendiri, atau transfer dengan bukti. */
export function RefundPayModal({ r, onClose }: { r: RefundRow; onClose: () => void }) {
  const toast = useToast();
  const inv = useInvalidateBatal();
  const meta = useQuery({ queryKey: ['deposit', 'methods'], queryFn: () => api<{ id: string; nama: string; jenis: string }[]>('deposit.methods').catch(() => []), staleTime: 60e3 });
  const [cara, setCara] = useState<'tunai' | 'transfer'>(r.cara === 'transfer' ? 'transfer' : 'tunai');
  const [methodId, setMethodId] = useState('');
  const [penerima, setPenerima] = useState(r.customer_nama);
  const [bukti, setBukti] = useState('');
  const [pw, setPw] = useState('');
  const pay = useMutation({
    mutationFn: () => api('refund.pay', { id: r.id, cara, method_id: methodId, penerima: penerima.trim(), bukti, password: pw }),
    onSuccess: () => { inv(); toast(`Refund ${rp(r.nominal)} dibayar`); onClose(); },
  });
  const rek = (meta.data || []).filter((m) => m.jenis !== 'tunai');
  const ok = penerima.trim() && pw && (cara === 'tunai' || (methodId && bukti));
  return (
    <Modal open onClose={onClose} title={<>Bayar refund <span className="font-mono">{r.nomor}</span></>} subtitle={`${r.sumber === 'deposit' ? 'Pencairan deposit' : `Dari pembatalan · nota ${r.order_nomor}`} · ${r.customer_nama}`}
      footer={<><button className="btn" onClick={onClose}>Nanti</button><button id="rf-bayar" className="btn btn-primary" disabled={!ok || pay.isPending} onClick={() => pay.mutate()}>Bayar refund {rp(r.nominal)}</button></>}>
      <div className="flex flex-col gap-4">
        <Sum rows={[['Nominal refund', rp(r.nominal), 'text-base font-bold'], ['Konsumen', r.customer_nama, 'text-muted'], ['Keterangan', r.alasan, 'text-muted']]} />
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          <Opt id="rf-tunai" on={cara === 'tunai'} onClick={() => setCara('tunai')} title="Tunai" sub="Dari laci Anda sendiri" />
          <Opt id="rf-transfer" on={cara === 'transfer'} onClick={() => setCara('transfer')} title="Transfer" sub="Dari rekening toko" />
        </div>
        {cara === 'transfer' && <Field label={<>Dari rekening <span className="text-bad">*</span></>}><select id="rf-rek" className="input" value={methodId} onChange={(e) => setMethodId(e.target.value)}><option value="">– pilih –</option>{rek.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}</select></Field>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={<>Diterima oleh <span className="text-bad">*</span></>}><input id="rf-penerima" className="input" value={penerima} onChange={(e) => setPenerima(e.target.value)} /></Field>
          <Foto id="rf-bukti" value={bukti} onChange={setBukti} label={cara === 'transfer' ? 'Bukti transfer' : 'Foto serah terima'} wajib={cara === 'transfer'} />
        </div>
        <Pw id="rf-pw" value={pw} onChange={setPw} />
        <ErrorBox error={pay.error} />
      </div>
    </Modal>
  );
}

/** Setujui / tolak pengajuan pencairan deposit (owner). */
export function RefundDecideModal({ r, onClose }: { r: RefundRow; onClose: () => void }) {
  const toast = useToast();
  const inv = useInvalidateBatal();
  const [tolak, setTolak] = useState(false);
  const [catatan, setCatatan] = useState('');
  const [pw, setPw] = useState('');
  const dec = useMutation({ mutationFn: () => api('refund.decide', { id: r.id, setuju: !tolak, catatan: catatan.trim(), password: pw }), onSuccess: () => { inv(); toast(tolak ? 'Pencairan ditolak' : 'Pencairan disetujui, siap dibayar'); onClose(); } });
  return (
    <Modal open onClose={onClose} title={<>Pencairan deposit <span className="font-mono">{r.nomor}</span></>} subtitle={`Diajukan ${r.diajukan_nama} · ${tglJam(r.created_at)}`}
      footer={tolak
        ? <><button className="btn" onClick={() => setTolak(false)}>Kembali</button><button className="btn btn-danger" disabled={!catatan.trim() || !pw || dec.isPending} onClick={() => dec.mutate()}>Tolak</button></>
        : <><button className="btn text-bad" onClick={() => setTolak(true)}>Tolak</button><button id="rd-setuju" className="btn btn-primary" disabled={!pw || dec.isPending} onClick={() => dec.mutate()}><Check size={16} />Setujui</button></>}>
      <div className="flex flex-col gap-4">
        <Sum rows={[['Konsumen', r.customer_nama], ['Nominal dicairkan', rp(r.nominal), 'font-bold'], ['Dibayar lewat', r.cara], ['Alasan', `"${r.alasan}"`, 'text-muted']]} />
        {tolak && <Field label={<>Alasan penolakan <span className="text-bad">*</span></>}><input className="input" value={catatan} onChange={(e) => setCatatan(e.target.value)} /></Field>}
        <Pw id="rd-pw" value={pw} onChange={setPw} />
        <ErrorBox error={dec.error} />
      </div>
    </Modal>
  );
}

import { useMutation, useQuery } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ErrorBox, Field } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { Combobox, type ComboItem } from '@/components/ui/Combobox';
import { BuktiThumb } from '@/components/Titip';
import { useInvalidateBatal } from '@/components/Pembatalan';
import { api } from '@/lib/api';
import { compressImage } from '@/lib/image';
import { nf, rp, tgl } from '@/lib/format';

export interface DepMove { id: string; nomor: string; tanggal: string; jenis: string; masuk: number; keluar: number; saldo: number; keterangan: string; oleh: string; method_nama?: string; bukti?: string; created_at: string }
export interface DepCard { customer: { id: string; nama: string; kode: string; telp: string; percetakan: string; tipe: string } | null; saldo: number; bebas: number; mutasi: DepMove[] }
export const JENIS_DEP: Record<string, [string, string]> = {
  topup: ['Titip di muka', 'text-ok'], pembatalan: ['Dari pembatalan', 'text-ok'], lebih_bayar: ['Kelebihan bayar', 'text-ok'], pakai: ['Bayar nota', 'text-bad'], cair: ['Dicairkan', 'text-bad'],
};
interface Method { id: string; nama: string; jenis: string }
interface CustLite { id: string; nama: string; kode: string; percetakan?: string }
const numIn = (s: string) => Number(String(s).replace(/[^\d]/g, '')) || 0;

function Bukti({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <Field label="Bukti (opsional)">
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) onChange(await compressImage(f)); }} />
      {value ? <div className="flex items-center gap-2"><BuktiThumb src={value} className="h-10 w-9" /><button type="button" className="btn btn-sm" onClick={() => onChange('')}>Hapus</button></div>
        : <button type="button" className="btn justify-start text-muted" onClick={() => ref.current?.click()}>Pilih foto…</button>}
    </Field>
  );
}
function CustPick({ list, value, onChange, id }: { list: CustLite[]; value: string; onChange: (v: string) => void; id: string }) {
  const items: ComboItem[] = useMemo(() => list.map((c) => ({ value: c.id, label: c.nama, hint: [c.kode && `#${c.kode}`, c.percetakan].filter(Boolean).join(' · '), search: `${c.nama} ${c.kode} ${c.percetakan || ''}`.toLowerCase() })), [list]);
  return <Combobox id={id} items={items} value={value} onChange={onChange} placeholder="Cari konsumen…" />;
}

/** Tambah deposit (titip di muka). Konsumen bisa sudah dipilih (dari Kartu Konsumen). */
export function DepositTopupModal({ customer, customers, onClose }: { customer?: { id: string; nama: string }; customers?: CustLite[]; onClose: () => void }) {
  const toast = useToast();
  const inv = useInvalidateBatal();
  const meths = useQuery({ queryKey: ['deposit', 'methods'], queryFn: () => api<Method[]>('deposit.methods'), staleTime: 60e3 });
  const [cid, setCid] = useState(customer?.id || '');
  const [nominal, setNominal] = useState('');
  const [methodId, setMethodId] = useState('');
  const [catatan, setCatatan] = useState('');
  const [bukti, setBukti] = useState('');
  const save = useMutation({
    mutationFn: () => api<{ nomor: string }>('deposit.topup', { customer_id: cid, nominal: numIn(nominal), method_id: methodId, catatan: catatan.trim(), bukti }),
    onSuccess: (r) => { inv(); toast(`Deposit ${rp(numIn(nominal))} tersimpan (${r.nomor})`); onClose(); },
  });
  return (
    <Modal open onClose={onClose} title="Tambah deposit konsumen" subtitle="Uang titipan untuk order berikutnya. Bukan omzet; dicatat sebagai utang toko ke konsumen."
      footer={<><button className="btn" onClick={onClose}>Batal</button><button id="dp-simpan" className="btn btn-primary" disabled={!cid || !numIn(nominal) || !methodId || save.isPending} onClick={() => save.mutate()}>Simpan deposit</button></>}>
      <div className="flex flex-col gap-4">
        <Field label={<>Konsumen <span className="text-bad">*</span></>}>{customer ? <div className="input bg-sunk font-semibold">{customer.nama}</div> : <CustPick id="dp-cust" list={customers || []} value={cid} onChange={setCid} />}</Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={<>Nominal <span className="text-bad">*</span></>}><input id="dp-nominal" className="input num text-right font-bold" inputMode="numeric" value={nominal ? nf(numIn(nominal)) : ''} onChange={(e) => setNominal(e.target.value)} placeholder="0" /></Field>
          <Field label={<>Diterima lewat <span className="text-bad">*</span></>}><select id="dp-metode" className="input" value={methodId} onChange={(e) => setMethodId(e.target.value)}><option value="">– pilih –</option>{(meths.data || []).map((m) => <option key={m.id} value={m.id}>{m.jenis === 'tunai' ? 'Tunai (laci)' : m.nama}</option>)}</select></Field>
          <Field label="Catatan"><input id="dp-catatan" className="input" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="mis. deposit order kalender" /></Field>
          <Bukti value={bukti} onChange={setBukti} />
        </div>
        <ErrorBox error={save.error} />
      </div>
    </Modal>
  );
}

/** Ajukan pencairan deposit; disetujui owner, lalu dibayar sebagai refund. */
export function DepositCairModal({ customer, saldo, onClose }: { customer: { id: string; nama: string }; saldo: number; onClose: () => void }) {
  const toast = useToast();
  const inv = useInvalidateBatal();
  const [nominal, setNominal] = useState(String(saldo));
  const [cara, setCara] = useState<'tunai' | 'transfer'>('transfer');
  const [alasan, setAlasan] = useState('');
  const save = useMutation({ mutationFn: () => api('deposit.cair', { customer_id: customer.id, nominal: numIn(nominal), cara, alasan: alasan.trim() }), onSuccess: () => { inv(); toast('Pencairan diajukan, menunggu persetujuan owner'); onClose(); } });
  return (
    <Modal open onClose={onClose} title="Cairkan deposit konsumen" subtitle={`${customer.nama} · saldo yang bisa dicairkan ${rp(saldo)}`}
      footer={<><button className="btn" onClick={onClose}>Batal</button><button id="cair-ajukan" className="btn btn-primary" disabled={!numIn(nominal) || numIn(nominal) > saldo || !alasan.trim() || save.isPending} onClick={() => save.mutate()}>Ajukan pencairan</button></>}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={<>Nominal dicairkan <span className="text-bad">*</span></>} hint="Maksimal sebesar saldo."><input id="cair-nominal" className="input num text-right font-bold" inputMode="numeric" value={nominal ? nf(numIn(nominal)) : ''} onChange={(e) => setNominal(e.target.value)} /></Field>
          <Field label="Dibayar lewat"><select id="cair-cara" className="input" value={cara} onChange={(e) => setCara(e.target.value as typeof cara)}><option value="transfer">Transfer</option><option value="tunai">Tunai</option></select></Field>
        </div>
        <Field label={<>Alasan <span className="text-bad">*</span></>}><input id="cair-alasan" className="input" value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="mis. konsumen tutup usaha" /></Field>
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs">Masuk antrian persetujuan owner. Setelah disetujui, kasir atau keuangan membayar dan mencatat bukti. Selama menunggu, saldo ini tidak bisa dipakai.</p>
        <ErrorBox error={save.error} />
      </div>
    </Modal>
  );
}

/** Pesan WA rekening koran deposit. */
export function waDeposit(card: DepCard, toko: string) {
  const lines = card.mutasi.slice(-8).map((m) => `${tgl(m.tanggal)} ${JENIS_DEP[m.jenis]?.[0] || m.jenis} ${m.masuk ? '+' + nf(m.masuk) : '−' + nf(m.keluar)} (saldo ${nf(m.saldo)})`);
  return `*${toko}*\nDeposit ${card.customer?.nama}\n\n${lines.join('\n')}\n\n*Saldo saat ini: ${rp(card.saldo)}*\nSaldo dapat dipakai untuk pembayaran order berikutnya.`;
}
export function waLink(telp: string, text: string) {
  const n = telp.replace(/[^\d]/g, '').replace(/^0/, '62');
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

/** Tabel mutasi deposit (rekening koran). */
export function DepositMutasi({ card, toko }: { card: DepCard; toko: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="tbl w-full min-w-[520px] text-[13px]">
          <thead><tr><th className="px-3 py-2 text-left">Tanggal</th><th className="px-3 py-2 text-left">Keterangan</th><th className="px-3 py-2 text-right">Mutasi</th><th className="px-3 py-2 text-right">Saldo</th></tr></thead>
          <tbody>
            {!card.mutasi.length && <tr><td colSpan={4} className="px-3 py-4 text-center text-muted">Belum ada mutasi deposit.</td></tr>}
            {card.mutasi.map((m) => (
              <tr key={m.id} className="border-t border-line">
                <td className="num px-3 py-2">{tgl(m.tanggal)}</td>
                <td className="px-3 py-2"><b>{JENIS_DEP[m.jenis]?.[0] || m.jenis}</b><div className="text-xs text-muted">{[m.nomor, m.keterangan, m.oleh].filter(Boolean).join(' · ')}</div></td>
                <td className={`num px-3 py-2 text-right font-semibold ${JENIS_DEP[m.jenis]?.[1] || ''}`}>{m.masuk ? `+${nf(m.masuk)}` : `−${nf(m.keluar)}`}</td>
                <td className="num px-3 py-2 text-right">{nf(m.saldo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {card.customer?.telp && card.customer.telp !== '-' && card.mutasi.length > 0 && (
        <a className="btn btn-sm self-start" href={waLink(card.customer.telp, waDeposit(card, toko))} target="_blank" rel="noreferrer"><MessageCircle size={14} className="text-[#1F8F4E]" />Kirim rekening koran ke WA</a>
      )}
    </div>
  );
}

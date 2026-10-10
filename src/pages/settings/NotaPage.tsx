import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, ReceiptText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ErrorBox, Field, PageHeader } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { ReceiptBody, shopOf, type ReceiptData } from '@/components/Receipt';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { useSettings } from '@/lib/queries';
import { DEFAULT_WA, waMessage } from '@/lib/share';
import type { Settings } from '@/types';

const KEYS = ['footer_spk', 'footer_kwitansi', 'wa_pesan_spk', 'wa_pesan_kwitansi'] as const;
const VARS = ['{nama}', '{nomor}', '{total}', '{bayar}', '{sisa}', '{status}', '{usaha}'];
const now = new Date().toISOString();
const ITEMS = [
  { nama: 'Art carton 260', keterangan: 'cover menu', qty: 50, sisi: 2, harga: 4900, subtotal: 245000 },
  { nama: 'Stiker kromo', keterangan: 'label botol', qty: 30, harga: 4200, subtotal: 126000 },
];
const SAMPLE: Record<'spk' | 'kwitansi', ReceiptData> = {
  spk: { jenis: 'spk', nomor: 'FT-K1-1026-0038', waktu: now, customer: 'Kedai Kopi Senja', tipe: 'End user', telp: '0896-0000-7708', cs: 'Riska', desain: 'WA, menu_kedai.pdf', janji_selesai: now, catatan: 'laminating doff, potong rapi', items: ITEMS, total: 371000, payments: [], sisa: 371000 },
  kwitansi: { jenis: 'kwitansi', nomor: 'FT-K1-1026-0038', waktu: now, customer: 'Kedai Kopi Senja', tipe: 'End user', telp: '0896-0000-7708', cs: 'Tina', kw_no: 'KW-0038-1', ke: 1, metode: 'Tunai', metode_jenis: 'tunai', item_count: 2, items: ITEMS, total: 371000, sebelumnya: 0, payments: [{ label: 'Bayar Tunai', nominal: 371000 }], diterima: 400000, kembalian: 29000, sisa: 0 },
};

/** Pengaturan → Nota & SPK: footer nota/kwitansi dan template pesan WhatsApp, dengan pratinjau langsung. */
export function NotaPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const s = useSettings();
  const [d, setD] = useState<Settings>({});
  const [tab, setTab] = useState<'spk' | 'kwitansi'>('spk');
  useEffect(() => {
    if (!s.data) return;
    setD({
      footer_spk: s.data.footer_spk ?? s.data.catatan_struk ?? '',
      footer_kwitansi: s.data.footer_kwitansi ?? s.data.catatan_struk ?? '',
      wa_pesan_spk: s.data.wa_pesan_spk || DEFAULT_WA.spk,
      wa_pesan_kwitansi: s.data.wa_pesan_kwitansi || DEFAULT_WA.kwitansi,
    });
  }, [s.data]);
  const ro = !can('pengaturan.umum', 'ubah');
  const save = useMutation({
    mutationFn: () => api<Settings>('settings.save', { settings: { ...Object.fromEntries(KEYS.map((k) => [k, d[k] ?? ''])), catatan_struk: d.footer_spk ?? '' } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); qc.invalidateQueries({ queryKey: ['pos'] }); toast('Pengaturan nota disimpan'); },
  });
  const ta = (k: (typeof KEYS)[number], rows = 4) => ({
    id: `set-${k}`, rows, className: 'input font-mono text-[13px] leading-relaxed', value: d[k] ?? '', disabled: ro,
    onFocus: () => setTab(k.endsWith('kwitansi') ? 'kwitansi' : 'spk'),
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setD({ ...d, [k]: e.target.value }),
  });
  const shop = { ...shopOf(s.data), footer_spk: d.footer_spk, footer_kwitansi: d.footer_kwitansi, catatan: '' };
  const sample = SAMPLE[tab];

  return (
    <>
      <PageHeader title="Nota & SPK" desc="Footer yang tercetak di bawah nota/SPK dan kwitansi, serta pesan yang ikut terkirim saat nota dibagikan lewat WhatsApp." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          <section className="card p-5">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-bold"><ReceiptText size={16} />Footer nota</h2>
            <p className="mb-4 text-xs text-muted">Satu baris per enter. Biasanya berisi ketentuan pengambilan, nomor rekening transfer, jam buka, dan ucapan terima kasih. Identitas usaha (nama, alamat, telepon) diatur di Pengaturan → Umum.</p>
            <div className="flex flex-col gap-4">
              <Field label="Footer nota / SPK (dari Front Office)"><textarea {...ta('footer_spk', 5)} placeholder={'Barang tidak diambil > 30 hari di luar tanggung jawab kami.\nTransfer: BCA 123 456 7890 a.n. Fortuner\nTerima kasih'} /></Field>
              <Field label="Footer kwitansi (dari Kasir)"><textarea {...ta('footer_kwitansi', 4)} placeholder="Terima kasih atas kepercayaan Anda." /></Field>
            </div>
          </section>
          <section className="card p-5">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-bold"><MessageCircle size={16} className="text-[#1F8F4E]" />Pesan WhatsApp</h2>
            <p className="mb-3 text-xs text-muted">Teks yang sudah terisi saat tombol “Kirim ke WhatsApp” ditekan. Gambar nota ditempel di chat yang sama. Kata dalam kurung kurawal diganti otomatis:</p>
            <div className="mb-4 flex flex-wrap gap-1.5">{VARS.map((v) => <code key={v} className="rounded bg-sunk px-1.5 py-0.5 text-[11px]">{v}</code>)}</div>
            <div className="flex flex-col gap-4">
              <Field label="Pesan untuk nota / SPK"><textarea {...ta('wa_pesan_spk', 3)} /></Field>
              <Field label="Pesan untuk kwitansi"><textarea {...ta('wa_pesan_kwitansi', 3)} /></Field>
            </div>
          </section>
          {!ro && (
            <div className="flex items-center justify-end gap-3">
              <ErrorBox error={save.error} />
              <button id="nota-simpan" className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Menyimpan…' : 'Simpan pengaturan nota'}</button>
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <section className="card flex flex-col gap-3 bg-sunk p-4">
            <div className="flex rounded-lg bg-surface p-1 text-sm" role="tablist">
              {(['spk', 'kwitansi'] as const).map((k) => (
                <button key={k} role="tab" aria-selected={tab === k} className={`flex-1 rounded-md px-3 py-1.5 font-semibold ${tab === k ? 'bg-ink text-canvas' : 'text-muted'}`} onClick={() => setTab(k)}>{k === 'spk' ? 'Nota / SPK' : 'Kwitansi'}</button>
              ))}
            </div>
            <div className="max-h-[52vh] overflow-y-auto rounded bg-white p-4 shadow-md"><ReceiptBody d={sample} shop={shop} width={80} /></div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted">Pesan WhatsApp</div>
            <div className="self-end whitespace-pre-line rounded-xl rounded-tr-sm bg-[#D9FDD3] px-3 py-2 text-[13px] text-[#111] shadow-sm">{waMessage(sample, shop, tab === 'spk' ? d.wa_pesan_spk : d.wa_pesan_kwitansi)}</div>
          </section>
        </aside>
      </div>
    </>
  );
}

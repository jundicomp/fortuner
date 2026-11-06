import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { exportXlsx, readXlsx } from '@/components/table/exportXlsx';
import { Modal } from '@/components/ui/Modal';
import { ErrorBox, Field } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { ymd } from '@/lib/format';
import type { Customer } from '@/types';

type Res = { dibuat: number; diperbarui: number; dilewati: string[] };
const CHUNK = 300; // dikirim bertahap supaya Apps Script tidak kehabisan waktu

// Kolom yang dikenali (huruf kecil, spasi → _). Mendukung file asli Fortuner: Nama · Percetakan · End User · No telp.
const NAMA = ['nama', 'name'];
const TELP = ['no_telp', 'telp', 'telepon', 'no_hp', 'hp', 'wa', 'no_wa', 'phone'];
const KODE = ['kode', 'id'];
const ALAMAT = ['alamat', 'address'];
const CATATAN = ['catatan', 'keterangan', 'note'];
const AKTIF = ['aktif', 'status'];
const JENIS = ['jenis', 'jenis_konsumen', 'tipe', 'tipe_konsumen'];
const PERCETAKAN = ['percetakan', 'nama_percetakan']; // terisi = konsumen percetakan (01)
const ENDUSER = ['end_user', 'enduser', 'end_user_', 'eu']; // terisi = end user (02)

const telpTeks = (v: unknown) => {
  if (v == null) return '';
  if (typeof v === 'number') { const s = String(Math.round(v)); return s.startsWith('8') ? '0' + s : s; } // Excel membuang angka 0 di depan
  return String(v).replace(/\s+/g, '').trim();
};
const jenisLabelImport = (t: unknown) => (t === 'reseller' || /^0?1\b/.test(String(t)) || /reseller|percetak/i.test(String(t)) ? '01 · Percetakan' : '02 · End user');

export function CustomerImport({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [readErr, setReadErr] = useState('');
  const [progress, setProgress] = useState('');

  const imp = useMutation({
    mutationFn: async () => {
      const all = rows || [];
      const total: Res = { dibuat: 0, diperbarui: 0, dilewati: [] };
      for (let i = 0; i < all.length; i += CHUNK) {
        setProgress(`${Math.min(i + CHUNK, all.length)} / ${all.length}`);
        const r = await api<Res>('customers.import', { rows: all.slice(i, i + CHUNK), offset: i });
        total.dibuat += r.dibuat; total.diperbarui += r.diperbarui; total.dilewati.push(...r.dilewati);
      }
      return total;
    },
    onSettled: () => { setProgress(''); qc.invalidateQueries({ queryKey: ['master', 'customers'] }); },
    onSuccess: (r) => toast(`Import selesai: ${r.dibuat} baru, ${r.diperbarui} diperbarui`),
  });

  const template = async () => {
    // format sama dengan file master Fortuner: Nama · Percetakan · End User · No telp (+ Kode/Alamat/Catatan opsional)
    const baris = (c: Customer) => ({ Kode: c.kode, Nama: c.nama, Percetakan: c.tipe === 'reseller' ? (c.percetakan || 'Percetakan') : '', 'End User': c.tipe === 'reseller' ? '' : 'End User', 'No telp': c.telp, Alamat: c.alamat || '', Catatan: c.catatan || '' });
    let data: Record<string, unknown>[] = [];
    try { data = (await api<Customer[]>('master.list', { table: 'customers' })).map(baris); } catch { /* template kosong */ }
    if (!data.length) data = [
      { Kode: '', Nama: 'Fadhil Wulan', Percetakan: 'Percetakan', 'End User': '', 'No telp': '0852 7357 9152', Alamat: '', Catatan: '' },
      { Kode: '', Nama: 'Iwan Souvenir', Percetakan: 'Souvenir', 'End User': '', 'No telp': '0813 7373 6656', Alamat: '', Catatan: '' },
      { Kode: '', Nama: 'Bu Rina', Percetakan: '', 'End User': 'End User', 'No telp': '0813 0000 2222', Alamat: '', Catatan: '' },
      { Kode: '', Nama: 'Budi (belum dikelompokkan)', Percetakan: '', 'End User': '', 'No telp': '0812 0000 1111', Alamat: '', Catatan: '' },
    ];
    exportXlsx(data, `Template_Konsumen_${ymd()}.xlsx`, 'Konsumen', { title: '' }); // tanpa judul: file ini dibaca ulang saat import
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    setReadErr(''); imp.reset(); setFileName(f.name);
    try {
      const raw = await readXlsx(f);
      const norm = raw.map((r) => {
        const low: Record<string, unknown> = {};
        Object.entries(r).forEach(([k, v]) => { low[k.trim().toLowerCase().replace(/\s+/g, '_')] = v; });
        const get = (keys: string[]) => { for (const k of keys) { const v = low[k]; if (v != null && String(v).trim() !== '') return v; } return undefined; };
        const perc = get(PERCETAKAN), eu = get(ENDUSER), jenis = get(JENIS);
        // jenis: kolom "jenis" bila ada; selain itu dari kolom Percetakan (terisi = 01) atau End User (terisi = 02); kosong = 02
        const tipe = jenis != null ? String(jenis) : perc != null ? 'reseller' : eu != null ? 'enduser' : 'enduser';
        const o: Record<string, unknown> = {
          nama: String(get(NAMA) ?? '').trim(), telp: telpTeks(get(TELP)), tipe,
          percetakan: perc != null ? String(perc).trim() : '',
          alamat: String(get(ALAMAT) ?? '').trim(), catatan: String(get(CATATAN) ?? '').trim(),
        };
        const kode = get(KODE); if (kode != null) o.kode = String(kode).trim();
        const aktif = get(AKTIF); if (aktif != null) o.aktif = aktif;
        return o;
      }).filter((r) => String(r.nama ?? '').trim());
      if (!norm.length) { setReadErr('Tidak ada baris dengan kolom "Nama". Pakai template dari tombol di atas.'); setRows(null); return; }
      setRows(norm);
    } catch { setReadErr('File tidak bisa dibaca. Pastikan formatnya .xlsx atau .csv.'); setRows(null); }
  };

  const cols: [string, string][] = [['nama', 'Nama'], ['jenis', 'Jenis'], ['percetakan', 'Nama percetakan'], ['telp', 'Telepon']];
  return (
    <Modal open onClose={onClose} size="lg" title="Import konsumen dari Excel"
      subtitle="Kode kosong = konsumen baru (kode dibuat otomatis). Kode yang sudah ada = data konsumen itu diperbarui."
      footer={<><button className="btn" onClick={onClose}>{imp.isSuccess ? 'Tutup' : 'Batal'}</button>{!imp.isSuccess && <button className="btn btn-primary" disabled={!rows?.length || imp.isPending} onClick={() => imp.mutate()}>{imp.isPending ? `Mengimpor… ${progress}` : `Import ${rows?.length || 0} baris`}</button>}</>}>
      <div className="flex flex-col gap-4">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Kolom yang dibaca: <b>Nama</b>, <b>Percetakan</b>, <b>End User</b>, <b>No telp</b> (sama seperti file master Fortuner). Opsional: <b>Kode</b>, <b>Alamat</b>, <b>Catatan</b>.</li>
          <li>Yang wajib hanya <b>Nama</b>. Telepon boleh kosong untuk data lama.</li>
          <li>Penentu jenis: kolom <b>Percetakan</b> terisi → <span className="font-mono text-xs">01</span> Percetakan (harga reseller), isinya jadi nama percetakan. Kolom <b>End User</b> terisi atau kedua kolom kosong → <span className="font-mono text-xs">02</span> End user.</li>
          <li>Kode kosong = konsumen baru. Kode yang sudah ada = data itu diperbarui. File hasil tombol <b>Excel</b>/template di tabel Konsumen bisa di-import ulang.</li>
        </ol>
        <button className="btn btn-excel self-start" onClick={template}><FileSpreadsheet size={16} />Unduh template</button>
        <Field label="File Excel (.xlsx / .csv)">
          <input id="cust-import-file" type="file" accept=".xlsx,.xls,.csv" className="input file:mr-3 file:rounded-md file:border-0 file:bg-sunk file:px-3 file:py-1 file:text-xs file:font-semibold" onChange={(e) => onFile(e.target.files?.[0])} />
        </Field>
        {readErr && <ErrorBox error={new Error(readErr)} />}
        {rows && !imp.isSuccess && (
          <div className="rounded-xl border border-line">
            <div className="border-b border-line px-3 py-2 text-xs font-semibold text-muted">{fileName}: {rows.length} baris · contoh 5 baris pertama</div>
            <div className="overflow-x-auto">
              <table className="tbl w-full text-xs">
                <thead><tr>{cols.map(([, l]) => <th key={l} className="px-3 py-1.5 text-left font-bold text-muted">{l}</th>)}</tr></thead>
                <tbody>{rows.slice(0, 5).map((r, i) => <tr key={i} className="border-t border-line">{cols.map(([k]) => <td key={k} className="px-3 py-1.5">{k === 'jenis' ? jenisLabelImport(r.tipe) : String(r[k] ?? '') || <span className="text-muted">–</span>}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        )}
        <ErrorBox error={imp.error} />
        {imp.data && (
          <div className="rounded-xl border border-ok/30 bg-ok/5 p-4 text-sm">
            <div className="font-bold text-ok">Import selesai</div>
            <div className="mt-1">{imp.data.dibuat} konsumen baru, {imp.data.diperbarui} diperbarui{imp.data.dilewati.length ? `, ${imp.data.dilewati.length} dilewati` : ''}.</div>
            {imp.data.dilewati.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-warn">{imp.data.dilewati.slice(0, 30).map((d) => <li key={d}>{d}</li>)}{imp.data.dilewati.length > 30 && <li>…dan {imp.data.dilewati.length - 30} lainnya</li>}</ul>}
          </div>
        )}
      </div>
    </Modal>
  );
}

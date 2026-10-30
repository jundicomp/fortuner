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

/** Nama kolom yang diterima (huruf kecil, spasi → _). Export dari tabel Konsumen bisa langsung di-import ulang. */
const ALIAS: Record<string, string> = {
  kode: 'kode', nama: 'nama', jenis: 'tipe', jenis_konsumen: 'tipe', tipe: 'tipe',
  nama_percetakan: 'percetakan', percetakan: 'percetakan',
  telepon: 'telp', telp: 'telp', no_telp: 'telp', no_hp: 'telp', hp: 'telp', wa: 'telp', no_wa: 'telp',
  alamat: 'alamat', catatan: 'catatan', aktif: 'aktif', status: 'aktif',
};

const telpTeks = (v: unknown) => {
  if (typeof v === 'number') { const s = String(Math.round(v)); return s.startsWith('8') ? '0' + s : s; } // Excel membuang angka 0 di depan
  return String(v ?? '').trim();
};

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
    let data: Record<string, unknown>[] = [];
    try { data = (await api<Customer[]>('master.list', { table: 'customers' })).map((c) => ({ kode: c.kode, nama: c.nama, jenis: c.tipe === 'reseller' ? 'Percetakan' : 'End user', nama_percetakan: c.percetakan || '', telepon: c.telp, alamat: c.alamat, catatan: c.catatan, aktif: c.aktif ? 'ya' : 'tidak' })); } catch { /* template kosong */ }
    if (!data.length) data = [
      { kode: '', nama: 'Pak Hendra', jenis: 'Percetakan', nama_percetakan: 'Percetakan Cahaya Ilmu', telepon: '081200001111', alamat: '', catatan: '', aktif: 'ya' },
      { kode: '', nama: 'Bu Rina', jenis: 'End user', nama_percetakan: '', telepon: '081300002222', alamat: '', catatan: '', aktif: 'ya' },
    ];
    exportXlsx(data, `Template_Konsumen_${ymd()}.xlsx`, 'Konsumen', { title: '' }); // tanpa judul: file ini dibaca ulang saat import
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    setReadErr(''); imp.reset(); setFileName(f.name);
    try {
      const raw = await readXlsx(f);
      const norm = raw.map((r) => {
        const o: Record<string, unknown> = {};
        Object.entries(r).forEach(([k, v]) => { const key = ALIAS[k.trim().toLowerCase().replace(/\s+/g, '_')]; if (key) o[key] = key === 'telp' ? telpTeks(v) : typeof v === 'string' ? v.trim() : v; });
        return o;
      }).filter((r) => String(r.nama ?? '').trim() || String(r.telp ?? '').trim());
      if (!norm.length || !('nama' in norm[0])) { setReadErr('Kolom "nama" tidak ditemukan. Pakai template dari tombol di atas.'); setRows(null); return; }
      setRows(norm);
    } catch { setReadErr('File tidak bisa dibaca. Pastikan formatnya .xlsx atau .csv.'); setRows(null); }
  };

  const cols: [string, string][] = [['kode', 'kode'], ['nama', 'nama'], ['tipe', 'jenis'], ['percetakan', 'nama percetakan'], ['telp', 'telepon']];
  return (
    <Modal open onClose={onClose} size="lg" title="Import konsumen dari Excel"
      subtitle="Kode kosong = konsumen baru (kode dibuat otomatis). Kode yang sudah ada = data konsumen itu diperbarui."
      footer={<><button className="btn" onClick={onClose}>{imp.isSuccess ? 'Tutup' : 'Batal'}</button>{!imp.isSuccess && <button className="btn btn-primary" disabled={!rows?.length || imp.isPending} onClick={() => imp.mutate()}>{imp.isPending ? `Mengimpor… ${progress}` : `Import ${rows?.length || 0} baris`}</button>}</>}>
      <div className="flex flex-col gap-4">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Unduh template. Isinya konsumen yang sudah ada, jadi bisa langsung diedit atau ditambah di bawahnya.</li>
          <li>Wajib diisi: <b>nama</b>, <b>jenis</b> (<span className="font-mono text-xs">Percetakan</span> atau <span className="font-mono text-xs">End user</span>), dan <b>telepon</b> (jenis kosong dianggap End user). Untuk jenis Percetakan isi juga <b>nama_percetakan</b>; kalau kosong, dipakai nama konsumen.</li>
          <li>Jenis menentukan harga: Percetakan = harga reseller, End user = harga end user.</li>
          <li>File hasil tombol <b>Excel</b> di tabel Konsumen juga bisa di-import ulang.</li>
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
                <tbody>{rows.slice(0, 5).map((r, i) => <tr key={i} className="border-t border-line">{cols.map(([k]) => <td key={k} className="px-3 py-1.5">{String(r[k] ?? '')}</td>)}</tr>)}</tbody>
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

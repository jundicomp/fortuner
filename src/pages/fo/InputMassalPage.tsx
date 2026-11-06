import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CheckCircle2, Download, FileSpreadsheet, Link2, RotateCcw, Upload, Wrench, X } from 'lucide-react';
import { Combobox, type ComboItem } from '@/components/ui/Combobox';
import { ErrorBox, Field } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { exportXlsx, readXlsx } from '@/components/table/exportXlsx';
import { api } from '@/lib/api';
import { loadPos } from '@/lib/offline';
import { nf, rp, ymd } from '@/lib/format';

// ---------- tipe ----------
interface Baris { baris: number; no_nota: string; tanggal: string; konsumen: string; produk: string; jumlah: string; keterangan: string; harga: string; desain: string; janji: string; catatan: string }
interface Saran { id: string; kode: string; nama: string; percetakan?: string; tipe?: string; jenis_harga?: string }
interface Item { baris: number; produk_raw: string; product_id: string; nama: string; qty: number; keterangan: string; harga: number | null; manual?: boolean; auto?: boolean; subtotal?: number; issue?: string; saran_produk?: Saran[] }
interface Nota { ref: string; no_nota: string; tanggal: string; baris: number; konsumen_raw: string; customer_id: string; customer_nama: string; tipe: 'reseller' | 'enduser'; saran_konsumen: Saran[]; desain: string; janji_selesai: string; catatan: string; items: Item[]; issues: Issue[]; ok: boolean; nilai: number }
interface Issue { baris: number; cell: string; nilai: string; sebab: string; saran?: Saran[] }
interface Stats { total_nilai: number; nota: number; item: number; periode: { from: string; to: string }; konsumen: { reseller_nota: number; enduser_nota: number; reseller_nilai: number; enduser_nilai: number }; top_produk: { nama: string; qty: number }[] }
interface Preview { notas: Nota[]; stats: Stats; ringkas: { siap: number; bermasalah: number; cocok_item: number; total_item: number } }
interface Hasil { dibuat: number; gagal: { ref: string; pesan: string }[]; nomor: string[] }

// ---------- parser Excel → baris ----------
const pick = (low: Record<string, unknown>, keys: string[]) => { for (const k of keys) { const v = low[k]; if (v != null && String(v).trim() !== '') return String(v).trim(); } return ''; };
const COL = {
  no_nota: ['no_nota', 'nonota', 'no._nota', 'nota', 'no'],
  tanggal: ['tanggal', 'tgl', 'date'],
  konsumen: ['konsumen', 'customer', 'pelanggan', 'nama', 'nama_konsumen'],
  produk: ['produk', 'product', 'barang', 'item', 'nama_produk'],
  jumlah: ['jumlah', 'qty', 'jml', 'quantity'],
  keterangan: ['keterangan_item', 'keterangan', 'ket', 'note', 'catatan_item'],
  harga: ['harga_satuan', 'harga', 'price', 'harga_sat'],
  desain: ['sumber_desain', 'sumber_/_nama_file_desain', 'sumber', 'desain', 'file_desain'],
  janji: ['janji_selesai', 'janji', 'deadline', 'selesai'],
  catatan: ['catatan', 'catatan_nota', 'keterangan_nota'],
};
const excelTanggal = (v: string) => {
  // Excel kadang mengirim tanggal sebagai serial number atau ISO dengan jam — rapikan ke YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const n = Number(v);
  if (n > 20000 && n < 90000) { const d = new Date(Date.UTC(1899, 11, 30 + Math.round(n))); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; }
  return v;
};

export function InputMassalPage() {
  const toast = useToast();
  const pos = useQuery({ queryKey: ['pos'], queryFn: loadPos, staleTime: 60e3, retry: 0 });

  const [phase, setPhase] = useState<'upload' | 'review' | 'fix' | 'done'>('upload');
  const [fileName, setFileName] = useState('');
  const [readErr, setReadErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [draft, setDraft] = useState<Nota[]>([]); // salinan yang bisa diperbaiki
  const [hasil, setHasil] = useState<Hasil | null>(null);

  // ---------- pilihan master untuk pencocokan manual ----------
  const custItems: ComboItem[] = useMemo(() => (pos.data?.customers || []).map((c) => ({
    value: c.id, label: c.nama, hint: [c.kode && `#${c.kode}`, c.percetakan, c.telp && c.telp !== '-' && c.telp].filter(Boolean).join(' · '),
    search: `${c.nama} ${c.kode} ${c.percetakan || ''} ${c.telp}`.toLowerCase(),
    right: c.tipe === 'reseller' ? <span className="tag-r">01</span> : <span className="tag-e">02</span>,
  })), [pos.data]);
  const prodItems: ComboItem[] = useMemo(() => (pos.data?.products || []).map((p) => ({
    value: p.id, label: p.nama, hint: `#${p.kode}`, search: `${p.nama} ${p.kode} ${p.kategori || ''}`.toLowerCase(),
  })), [pos.data]);
  const prodById = useMemo(() => Object.fromEntries((pos.data?.products || []).map((p) => [p.id, p])), [pos.data]);
  const custById = useMemo(() => Object.fromEntries((pos.data?.customers || []).map((c) => [c.id, c])), [pos.data]);

  // ---------- unduh template ----------
  const template = async () => {
    const contoh = [
      { 'No Nota': 'N-001', Tanggal: '2026-10-15', Konsumen: 'Percetakan Cahaya Ilmu', Produk: 'Brosur A4 BB', Jumlah: 200, 'Keterangan item': 'brosur promo', 'Harga satuan': '', 'Sumber desain': 'WA 0852...', 'Janji selesai': '2026-10-17 15:00', Catatan: 'laminating doff' },
      { 'No Nota': 'N-001', Tanggal: '', Konsumen: '', Produk: 'Kartu Nama', Jumlah: 4, 'Keterangan item': 'art carton', 'Harga satuan': '', 'Sumber desain': '', 'Janji selesai': '', Catatan: '' },
      { 'No Nota': 'N-002', Tanggal: '2026-10-16', Konsumen: 'Bu Rina', Produk: 'Stiker Vinyl', Jumlah: 50, 'Keterangan item': 'ukuran A3', 'Harga satuan': 2500, 'Sumber desain': 'flashdisk', 'Janji selesai': '', Catatan: '' },
    ];
    await exportXlsx(contoh, `Template_Input_Massal_FO_${ymd()}.xlsx`, 'Input FO', { title: '' });
  };

  // ---------- unggah & tinjau ----------
  const onFile = async (f?: File) => {
    if (!f) return;
    setReadErr(''); setErr(null); setFileName(f.name); setBusy(true);
    try {
      const raw = await readXlsx(f);
      const rows: Baris[] = raw.map((r, i) => {
        const low: Record<string, unknown> = {};
        Object.entries(r).forEach(([k, v]) => { low[k.trim().toLowerCase().replace(/\s+/g, '_')] = v; });
        return {
          baris: i + 2, no_nota: pick(low, COL.no_nota), tanggal: excelTanggal(pick(low, COL.tanggal)), konsumen: pick(low, COL.konsumen),
          produk: pick(low, COL.produk), jumlah: pick(low, COL.jumlah), keterangan: pick(low, COL.keterangan), harga: pick(low, COL.harga),
          desain: pick(low, COL.desain), janji: pick(low, COL.janji), catatan: pick(low, COL.catatan),
        };
      }).filter((r) => r.produk || r.konsumen || r.no_nota);
      if (!rows.length) { setReadErr('Tidak ada baris data. Pakai template dari tombol di atas.'); setBusy(false); return; }
      const pv = await api<Preview>('fo.bulkPreview', { rows });
      setPreview(pv); setDraft(pv.notas.map((n) => ({ ...n, items: n.items.map((it) => ({ ...it })) }))); setPhase('review');
    } catch (e) { setReadErr((e as Error).message || 'File tidak bisa dibaca. Pastikan .xlsx / .csv.'); }
    finally { setBusy(false); }
  };

  const reset = () => { setPhase('upload'); setPreview(null); setDraft([]); setHasil(null); setFileName(''); setErr(null); setReadErr(''); };

  // ---------- kesiapan nota (dihitung ulang di klien saat diperbaiki) ----------
  const siapNota = (n: Nota): boolean => {
    if (!n.customer_id) return false;
    if (n.tanggal && n.tanggal > ymd()) return false;
    if (!n.items.length) return false;
    return n.items.every((it) => {
      if (!it.product_id) return false;
      if (!(it.qty >= 1)) return false;
      const p = prodById[it.product_id];
      const manualJenis = p && p.jenis_harga === 'manual';
      if (manualJenis || it.manual) return it.harga != null && it.harga >= 0;
      return true; // harga otomatis dihitung ulang server
    });
  };
  const notaSiap = draft.filter(siapNota);
  const notaMasalah = draft.filter((n) => !siapNota(n));

  // ---------- eksekusi ----------
  const toCommit = (list: Nota[]) => list.map((n) => ({
    ref: n.ref, no_nota: n.no_nota, tanggal: n.tanggal, customer_id: n.customer_id, desain: n.desain, janji_selesai: n.janji_selesai, catatan: n.catatan,
    items: n.items.map((it) => ({ product_id: it.product_id, qty: it.qty, keterangan: it.keterangan, harga_satuan: it.manual || (prodById[it.product_id]?.jenis_harga === 'manual') ? it.harga : '', harga_manual: !!it.manual })),
  }));
  const eksekusi = async (list: Nota[]) => {
    if (!list.length) { toast('Tidak ada nota siap untuk disimpan.', 'err'); return; }
    setBusy(true); setErr(null);
    try {
      const r = await api<Hasil>('fo.bulkCommit', { notas: toCommit(list) });
      setHasil(r); setPhase('done');
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  const unduhMasalah = async () => {
    const rows: Record<string, unknown>[] = [];
    notaMasalah.forEach((n) => (preview?.notas.find((x) => x.ref === n.ref)?.issues || []).forEach((is) => rows.push({ Baris: is.baris, 'No Nota': n.no_nota, Cell: is.cell, 'Nilai di file': is.nilai, Masalah: is.sebab })));
    if (!rows.length) { toast('Tidak ada baris bermasalah.'); return; }
    await exportXlsx(rows, `Baris_Perlu_Diperbaiki_${ymd()}.xlsx`, 'Perbaiki', { title: 'Baris yang harus diperbaiki & diupload ulang', subtitle: fileName });
  };

  // ---------- render ----------
  if (pos.isLoading) return <div className="card p-6 text-sm text-muted">Memuat data master…</div>;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-extrabold">Input Massal FO</h1>
          <span className="pill pill-brand">Khusus Owner</span>
        </div>
        <p className="mt-0.5 text-sm text-muted">Unggah Excel berisi banyak nota sekaligus. Konsumen &amp; produk otomatis dicocokkan ke seluruh data master.</p>
      </div>

      <Stepper phase={phase} />

      {phase === 'upload' && (
        <section className="card flex flex-col items-center gap-4 p-8 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand/10 text-brand"><Upload size={30} /></div>
          <div>
            <h2 className="text-lg font-bold">Unggah file Excel</h2>
            <p className="mt-1 max-w-md text-sm text-muted">Pakai template Input Massal FO. 1 baris = 1 produk, dikelompokkan dengan kolom <b>No Nota</b>. Harga satuan boleh kosong (otomatis dari matriks).</p>
          </div>
          <button className="btn btn-excel" onClick={template}><FileSpreadsheet size={16} />Unduh template</button>
          <label className="w-full max-w-md cursor-pointer rounded-xl border-2 border-dashed border-line bg-sunk px-4 py-6 text-sm font-semibold text-muted hover:border-brand hover:text-brand">
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            {busy ? 'Memproses…' : 'Pilih file .xlsx / .csv untuk diunggah'}
          </label>
          {fileName && !readErr && <p className="text-xs text-muted">{fileName}</p>}
          {readErr && <div className="w-full max-w-md"><ErrorBox error={new Error(readErr)} /></div>}
        </section>
      )}

      {(phase === 'review' || phase === 'fix') && preview && (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
            <FileSpreadsheet size={18} className="text-ok" />
            <div className="mr-auto"><b className="text-sm">{fileName}</b><div className="text-xs text-muted">{preview.ringkas.total_item} baris · {preview.stats.nota} nota terbaca</div></div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-sunk px-3 py-1 text-xs font-semibold text-muted"><Link2 size={13} />Dicocokkan ke master: Konsumen · Produk · Harga</span>
            <button className="btn btn-ghost btn-sm" onClick={reset}><RotateCcw size={14} />Ganti file</button>
          </div>

          <Infografis s={preview.stats} />

          {phase === 'review' && (
            <>
              <IsiFile notas={draft} />
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold">
                <span className="inline-flex items-center gap-2 text-ok"><span className="h-2.5 w-2.5 rounded-full bg-ok" />{notaSiap.length} nota siap</span>
                <span className="h-6 w-px bg-line" />
                <span className="inline-flex items-center gap-2 text-bad"><span className="h-2.5 w-2.5 rounded-full bg-bad" />{notaMasalah.length} nota · {preview.ringkas.total_item - preview.ringkas.cocok_item} produk tak dikenal</span>
                <span className="h-6 w-px bg-line" />
                <span className="text-muted">Cocok ke master: <b className="text-ink">{preview.ringkas.cocok_item} dari {preview.ringkas.total_item} item</b></span>
              </div>

              <ErrorBox error={err} />
              <div className="flex flex-col gap-3">
                <Choice color="ok" icon={<CheckCircle2 size={20} />} title="Lanjut, update yang benar saja"
                  desc={`Simpan ${notaSiap.length} nota yang valid sekarang. Nota bermasalah dilewati — daftar cell & nomor barisnya bisa diunduh untuk diperbaiki di Excel lalu diupload ulang.`}
                  action={<button className="btn text-white" style={{ background: 'rgb(var(--ok))', borderColor: 'rgb(var(--ok))' }} disabled={busy || !notaSiap.length} onClick={() => eksekusi(notaSiap)}>Lanjut {notaSiap.length} nota</button>}>
                  {notaMasalah.length > 0 && (
                    <div className="mt-3 rounded-xl border border-dashed border-line bg-sunk p-3">
                      <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted">Yang harus diperbaiki &amp; diupload ulang
                        <button className="ml-auto inline-flex items-center gap-1 rounded-md bg-ok/10 px-2 py-1 text-[11px] font-bold text-ok" onClick={unduhMasalah}><Download size={12} />Unduh daftar (Excel)</button>
                      </div>
                      <ul className="flex flex-col gap-1 text-xs">
                        {notaMasalah.flatMap((n) => (preview.notas.find((x) => x.ref === n.ref)?.issues || []).map((is, i) => (
                          <li key={`${n.ref}-${i}`} className="flex items-center gap-2 border-b border-line/70 py-1 last:border-0">
                            <span className="rounded bg-bad/10 px-1.5 py-0.5 font-bold text-bad">Baris {is.baris}</span>
                            <span className="font-semibold">{is.cell}{is.nilai ? ` "${is.nilai}"` : ''}</span>
                            <span className="ml-auto text-muted">{is.sebab}</span>
                          </li>
                        )))}
                      </ul>
                    </div>
                  )}
                </Choice>
                <Choice color="brand" rec icon={<Wrench size={19} />} title="Perbaiki di sini"
                  desc="Cocokkan tiap cell bermasalah ke data master (pilih konsumen/produk yang sudah ada atau isi harga), lalu eksekusi seluruh nota sekaligus."
                  action={<button className="btn btn-primary" onClick={() => setPhase('fix')}>Buka perbaikan <ArrowRight size={15} /></button>} />
                <Choice color="mute" icon={<X size={19} />} title="Batal"
                  desc="Batalkan seluruh impor. Tidak ada data yang disimpan — kembali ke langkah unggah."
                  action={<button className="btn" onClick={reset}>Batal impor</button>} />
              </div>
            </>
          )}

          {phase === 'fix' && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold">Perbaikan ({notaMasalah.length} nota bermasalah)</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setPhase('review')}>← Kembali ke pilihan</button>
              </div>
              <FixList draft={draft} setDraft={setDraft} custItems={custItems} prodItems={prodItems} prodById={prodById} custById={custById} siapNota={siapNota} />
              <ErrorBox error={err} />
              <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-lg">
                <span className="text-sm font-semibold"><b className="text-ok">{notaSiap.length} nota</b> siap{notaMasalah.length ? <> · <b className="text-bad">{notaMasalah.length}</b> masih perlu diperbaiki</> : ''}</span>
                <div className="ml-auto flex gap-2">
                  <button className="btn" onClick={reset}>Batal</button>
                  <button className="btn btn-primary" disabled={busy || !notaSiap.length} onClick={() => eksekusi(notaSiap)}>{busy ? 'Menyimpan…' : `Eksekusi ${notaSiap.length} nota`}</button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {phase === 'done' && hasil && (
        <section className="card flex flex-col items-center gap-4 p-8 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-ok/10 text-ok"><CheckCircle2 size={38} /></div>
          <div>
            <h2 className="text-lg font-bold">{hasil.dibuat} nota berhasil dibuat</h2>
            <p className="mt-1 text-sm text-muted">Nota masuk ke daftar Order dengan tanggal sesuai file{hasil.gagal.length ? `, ${hasil.gagal.length} nota gagal.` : '.'}</p>
          </div>
          {hasil.nomor.length > 0 && <div className="max-w-lg text-xs text-muted">Contoh nomor: {hasil.nomor.slice(0, 8).join(', ')}{hasil.nomor.length > 8 ? ` … (+${hasil.nomor.length - 8})` : ''}</div>}
          {hasil.gagal.length > 0 && (
            <div className="w-full max-w-lg rounded-xl border border-warn/30 bg-warn/5 p-3 text-left text-xs">
              <div className="mb-1 flex items-center gap-1.5 font-bold text-warn"><AlertTriangle size={14} />{hasil.gagal.length} nota gagal</div>
              <ul className="list-disc pl-5">{hasil.gagal.slice(0, 15).map((g, i) => <li key={i}>{g.ref}: {g.pesan}</li>)}{hasil.gagal.length > 15 && <li>…dan {hasil.gagal.length - 15} lainnya</li>}</ul>
            </div>
          )}
          <button className="btn btn-primary" onClick={reset}><Upload size={16} />Impor file lain</button>
        </section>
      )}
    </div>
  );
}

// ---------- komponen kecil ----------
function Stepper({ phase }: { phase: string }) {
  const steps = [['upload', 'Unggah file'], ['review', 'Tinjau & perbaiki'], ['done', 'Eksekusi']];
  const idx = phase === 'upload' ? 0 : phase === 'done' ? 2 : 1;
  return (
    <div className="flex items-center gap-1 text-sm">
      {steps.map(([key, label], i) => (
        <div key={key} className="flex items-center gap-1">
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 font-semibold ${i < idx ? 'border-ok/30 bg-ok/5 text-ok' : i === idx ? 'border-brand/40 bg-brand/5 text-brand' : 'border-line text-muted'}`}>
            <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${i < idx ? 'bg-ok text-white' : i === idx ? 'bg-brand text-white' : 'bg-sunk'}`}>{i < idx ? '✓' : i + 1}</span>{label}
          </div>
          {i < steps.length - 1 && <span className="h-px w-5 bg-line" />}
        </div>
      ))}
    </div>
  );
}

function Infografis({ s }: { s: Stats }) {
  const totNota = Math.max(1, s.konsumen.reseller_nota + s.konsumen.enduser_nota);
  const totNilai = Math.max(1, s.konsumen.reseller_nilai + s.konsumen.enduser_nilai);
  const maxQty = Math.max(1, ...s.top_produk.map((t) => t.qty));
  const periode = s.periode.from ? `${s.periode.from} → ${s.periode.to}` : '–';
  const Bar = ({ label, pct, val, color }: { label: string; pct: number; val: string; color: string }) => (
    <div className="flex items-center gap-2 text-xs"><span className="w-24 shrink-0 font-semibold text-muted">{label}</span>
      <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-sunk"><div className="h-full rounded-full" style={{ width: `${Math.max(3, pct)}%`, background: color }} /></div>
      <span className="num w-16 text-right font-bold">{val}</span></div>
  );
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="card grid grid-cols-2 gap-4 p-4">
        <div><div className="text-2xl font-extrabold text-brand">{rp(s.total_nilai)}</div><div className="text-xs font-semibold text-muted">Total nilai nota siap</div></div>
        <div><div className="text-2xl font-extrabold">{s.nota}</div><div className="text-xs font-semibold text-muted">Jumlah nota</div></div>
        <div><div className="text-2xl font-extrabold">{s.item}</div><div className="text-xs font-semibold text-muted">Item produk</div></div>
        <div><div className="text-sm font-extrabold leading-tight">{periode}</div><div className="text-xs font-semibold text-muted">Periode</div></div>
      </div>
      <div className="card p-4"><h3 className="mb-3 text-sm font-bold">Komposisi konsumen</h3>
        <div className="flex flex-col gap-2.5">
          <Bar label="01 Percetakan" pct={(s.konsumen.reseller_nota / totNota) * 100} val={`${s.konsumen.reseller_nota} nota`} color="rgb(var(--brand))" />
          <Bar label="02 End user" pct={(s.konsumen.enduser_nota / totNota) * 100} val={`${s.konsumen.enduser_nota} nota`} color="#1F8F4E" />
          <Bar label="Nilai 01" pct={(s.konsumen.reseller_nilai / totNilai) * 100} val={nf(Math.round(s.konsumen.reseller_nilai / 1000)) + 'rb'} color="#f7a06a" />
          <Bar label="Nilai 02" pct={(s.konsumen.enduser_nilai / totNilai) * 100} val={nf(Math.round(s.konsumen.enduser_nilai / 1000)) + 'rb'} color="#79c79a" />
        </div>
      </div>
      <div className="card p-4"><h3 className="mb-3 text-sm font-bold">Produk terbanyak</h3>
        <div className="flex flex-col gap-2.5">
          {s.top_produk.length ? s.top_produk.slice(0, 4).map((t) => <Bar key={t.nama} label={t.nama} pct={(t.qty / maxQty) * 100} val={nf(t.qty)} color="rgb(var(--brand))" />) : <p className="text-xs text-muted">Belum ada produk cocok.</p>}
        </div>
      </div>
    </div>
  );
}

function IsiFile({ notas }: { notas: Nota[] }) {
  const tampil = notas.slice(0, 15);
  const sisa = notas.length - tampil.length;
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5"><h3 className="text-sm font-bold">Isi file</h3><span className="text-xs text-muted">Dikelompokkan per nota · 1 baris = 1 produk</span></div>
      <div className="overflow-x-auto">
        <table className="tbl w-full min-w-[720px] text-sm">
          <thead><tr>
            <th className="w-14 px-2 py-2 text-[11px]">BARIS</th><th className="w-20 px-2 py-2 text-[11px]">NO NOTA</th><th className="min-w-[160px] px-2 py-2 text-[11px]">KONSUMEN</th>
            <th className="px-2 py-2 text-[11px]">PRODUK</th><th className="w-16 px-2 py-2 text-[11px]">JUMLAH</th><th className="w-28 px-2 py-2 text-[11px]">HARGA</th><th className="w-36 px-2 py-2 text-[11px]">STATUS</th>
          </tr></thead>
          <tbody>
            {tampil.map((n) => n.items.map((it, ii) => (
              <tr key={`${n.ref}-${ii}`} className="border-t border-line align-middle">
                <td className="px-2 py-2 text-xs text-muted">{it.baris}</td>
                {ii === 0 ? <td rowSpan={n.items.length} className="px-2 py-2 font-bold">{n.no_nota || '–'}</td> : null}
                {ii === 0 ? <td rowSpan={n.items.length} className="px-2 py-2">{n.customer_id ? <span>{n.customer_nama} <span className={n.tipe === 'reseller' ? 'tag-r' : 'tag-e'}>{n.tipe === 'reseller' ? '01' : '02'}</span></span> : <span className="pill pill-bad">⚠ "{n.konsumen_raw}"</span>}</td> : null}
                <td className="px-2 py-2">{it.product_id ? <span className="font-semibold">{it.nama}</span> : <span className="pill pill-bad">⚠ "{it.produk_raw}"</span>}{it.keterangan && <span className="text-muted"> · {it.keterangan}</span>}</td>
                <td className="num px-2 py-2">{it.qty || <span className="text-bad">?</span>}</td>
                <td className="px-2 py-2 text-xs">{it.harga == null ? <span className="text-bad">—</span> : <><span className={it.auto ? 'text-ok' : 'text-warn'}>{it.auto ? 'otomatis' : 'manual'}</span> {nf(it.harga)}</>}</td>
                {ii === 0 ? <td rowSpan={n.items.length} className="px-2 py-2">{n.ok ? <span className="pill pill-ok">✓ Siap</span> : <span className="pill pill-bad">● perlu diperbaiki</span>}</td> : null}
              </tr>
            )))}
          </tbody>
        </table>
      </div>
      {sisa > 0 && <div className="bg-sunk py-2 text-center text-xs font-semibold text-muted">↓ {sisa} nota lainnya</div>}
    </div>
  );
}

function Choice({ color, rec, icon, title, desc, action, children }: { color: 'ok' | 'brand' | 'mute'; rec?: boolean; icon: React.ReactNode; title: string; desc: string; action: React.ReactNode; children?: React.ReactNode }) {
  const bg = color === 'ok' ? 'bg-ok/10 text-ok' : color === 'brand' ? 'bg-brand/10 text-brand' : 'bg-sunk text-muted';
  return (
    <div className={`card p-4 ${rec ? 'ring-2 ring-brand/40' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${bg}`}>{icon}</div>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-[15px] font-bold">{title}{rec && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">DISARANKAN</span>}</h3>
          <p className="mt-0.5 text-sm text-muted">{desc}</p>
        </div>
        <div className="shrink-0 self-center">{action}</div>
      </div>
      {children}
    </div>
  );
}

function FixList({ draft, setDraft, custItems, prodItems, prodById, custById, siapNota }: {
  draft: Nota[]; setDraft: React.Dispatch<React.SetStateAction<Nota[]>>; custItems: ComboItem[]; prodItems: ComboItem[];
  prodById: Record<string, { id: string; nama: string; jenis_harga: string }>; custById: Record<string, { id: string; nama: string; tipe: string }>; siapNota: (n: Nota) => boolean;
}) {
  const bermasalah = draft.filter((n) => !siapNota(n));
  const setNota = (ref: string, patch: Partial<Nota>) => setDraft((d) => d.map((n) => (n.ref === ref ? { ...n, ...patch } : n)));
  const setItem = (ref: string, idx: number, patch: Partial<Item>) => setDraft((d) => d.map((n) => (n.ref === ref ? { ...n, items: n.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) } : n)));
  if (!bermasalah.length) return <div className="card p-6 text-center text-sm text-ok">Semua nota sudah beres. Tekan Eksekusi di bawah.</div>;
  return (
    <div className="flex flex-col gap-3">
      {bermasalah.map((n) => (
        <div key={n.ref} className="card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm"><b>Nota {n.no_nota || '(tanpa nomor)'}</b><span className="text-xs text-muted">baris {n.baris} · {n.tanggal || 'tanggal?'}</span></div>
          <div className="flex flex-col gap-3">
            {!n.customer_id && (
              <Field label={<span className="text-bad">Konsumen tak dikenal: "{n.konsumen_raw}"</span>}>
                <Combobox id={`cust-${n.ref}`} items={custItems} value={n.customer_id} placeholder="Cari & pilih konsumen dari master…"
                  onChange={(v) => setNota(n.ref, { customer_id: v, customer_nama: custById[v]?.nama || '', tipe: custById[v]?.tipe === 'reseller' ? 'reseller' : 'enduser' })} />
                {n.saran_konsumen?.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{n.saran_konsumen.map((s) => <button key={s.id} className="rounded-full border border-brand/40 bg-brand/5 px-2.5 py-1 text-xs font-semibold text-brand" onClick={() => setNota(n.ref, { customer_id: s.id, customer_nama: s.nama, tipe: s.tipe === 'reseller' ? 'reseller' : 'enduser' })}>{s.nama} {s.kode && `#${s.kode}`}</button>)}</div>}
              </Field>
            )}
            {n.items.map((it, idx) => {
              const needProd = !it.product_id;
              const p = it.product_id ? prodById[it.product_id] : null;
              const needHarga = (p?.jenis_harga === 'manual' || it.manual) && (it.harga == null || !(it.harga >= 0));
              if (!needProd && !needHarga && it.qty >= 1) return null;
              return (
                <div key={idx} className="rounded-lg border border-line bg-sunk/50 p-3">
                  <div className="mb-2 text-xs font-semibold text-muted">Item baris {it.baris}{it.keterangan ? ` · ${it.keterangan}` : ''}</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {needProd && (
                      <div>
                        <Combobox id={`prod-${n.ref}-${idx}`} items={prodItems} value={it.product_id} placeholder={`Produk tak dikenal: "${it.produk_raw}"`}
                          onChange={(v) => setItem(n.ref, idx, { product_id: v, nama: prodById[v]?.nama || '', manual: prodById[v]?.jenis_harga === 'manual', auto: prodById[v]?.jenis_harga !== 'manual', harga: prodById[v]?.jenis_harga === 'manual' ? it.harga : null })} />
                        {it.saran_produk && it.saran_produk.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{it.saran_produk.map((s) => <button key={s.id} className="rounded-full border border-brand/40 bg-brand/5 px-2.5 py-1 text-xs font-semibold text-brand" onClick={() => setItem(n.ref, idx, { product_id: s.id, nama: s.nama, manual: s.jenis_harga === 'manual', auto: s.jenis_harga !== 'manual', harga: s.jenis_harga === 'manual' ? it.harga : null })}>{s.nama} {s.kode && `#${s.kode}`}</button>)}</div>}
                      </div>
                    )}
                    {(needHarga || (p?.jenis_harga === 'manual')) && (
                      <Field label="Harga satuan (manual)"><input className="input num text-right" inputMode="numeric" value={it.harga ?? ''} placeholder="isi harga" onChange={(e) => setItem(n.ref, idx, { harga: Number(e.target.value.replace(/[^\d]/g, '')) || 0, manual: true })} /></Field>
                    )}
                    {!(it.qty >= 1) && (
                      <Field label="Jumlah"><input className="input num text-right" inputMode="numeric" value={it.qty || ''} placeholder="jumlah" onChange={(e) => setItem(n.ref, idx, { qty: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })} /></Field>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {siapNota(n) && <div className="mt-2 text-xs font-semibold text-ok">✓ Nota ini sudah beres</div>}
        </div>
      ))}
    </div>
  );
}

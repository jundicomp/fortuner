/** Export ke .xlsx. SheetJS dimuat saat dibutuhkan saja supaya halaman awal tetap ringan. */

/** Format akuntansi Excel: "Rp" rata kiri, angka rata kanan, nol jadi "-". */
const RP_FMT = '_("Rp"* #,##0_);_("Rp"* -#,##0_);_("Rp"* "-"_);_(@_)';

export interface SheetOpts {
  title?: string;     // judul tabel di baris pertama
  subtitle?: string;  // mis. periode / keterangan filter
  money?: string[];   // nama kolom yang berisi rupiah
  moneyRow?: (row: Record<string, unknown>) => boolean; // baris yang angkanya rupiah (tabel campuran seperti ringkasan)
}

type XLSXmod = typeof import('xlsx');

function buildSheet(XLSX: XLSXmod, rows: Record<string, unknown>[], opts: SheetOpts = {}) {
  const data = rows.length ? rows : [{ Keterangan: 'Tidak ada data' }];
  const keys = Object.keys(data[0]);
  const head: unknown[][] = [];
  if (opts.title) head.push([opts.title]);
  const info = [opts.subtitle, `Diekspor ${new Date().toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`].filter(Boolean).join(' · ');
  if (opts.title) { head.push([info]); head.push([]); }
  const ws = XLSX.utils.aoa_to_sheet(head);
  const origin = head.length; // baris (0-based) tempat header tabel
  XLSX.utils.sheet_add_json(ws, data, { origin: { r: origin, c: 0 } });
  // judul & keterangan dibentangkan selebar tabel
  if (opts.title && keys.length > 1) ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: keys.length - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: keys.length - 1 } }];
  // format rupiah
  const money = new Set(opts.money || []);
  keys.forEach((k, ci) => {
    for (let ri = 0; ri < data.length; ri++) {
      if (!money.has(k) && !opts.moneyRow?.(data[ri])) continue;
      const cell = ws[XLSX.utils.encode_cell({ r: origin + 1 + ri, c: ci })];
      if (cell && cell.t === 'n') cell.z = RP_FMT;
    }
  });
  ws['!cols'] = keys.map((k) => ({ wch: Math.min(42, Math.max(k.length, ...data.slice(0, 200).map((r) => String(r[k] ?? '').length + (money.has(k) ? 6 : 0))) + 2) }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: origin, c: 0 }, e: { r: origin + data.length, c: keys.length - 1 } }) };
  return ws;
}

const sheetName = (s: string) => s.slice(0, 31).replace(/[\\/?*[\]:]/g, ' ');

export async function exportXlsx(rows: Record<string, unknown>[], filename: string, name = 'Data', opts: SheetOpts = {}) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSheet(XLSX, rows, { title: name, ...opts }), sheetName(name));
  XLSX.writeFile(wb, filename);
}

/** Baca sheet pertama file Excel menjadi array objek (header baris 1). */
export async function readXlsx(file: File): Promise<Record<string, unknown>[]> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  // lewati baris judul (file hasil export punya judul di atas tabel): header = baris pertama yang memuat "kode"
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
  const hr = Math.max(0, aoa.findIndex((r) => r.some((v) => String(v).trim().toLowerCase() === 'kode')));
  return XLSX.utils.sheet_to_json(ws, { defval: '', range: hr });
}

/** Beberapa sheet dalam satu file (mis. laporan lengkap). Tiap sheet diberi judul. */
export async function exportBook(sheets: ({ name: string; rows: Record<string, unknown>[] } & SheetOpts)[], filename: string, opts: { subtitle?: string } = {}) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, rows, ...o }) => XLSX.utils.book_append_sheet(wb, buildSheet(XLSX, rows, { title: name, subtitle: opts.subtitle, ...o }), sheetName(name)));
  XLSX.writeFile(wb, filename);
}

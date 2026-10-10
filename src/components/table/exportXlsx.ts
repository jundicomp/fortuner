/**
 * Export ke .xlsx dengan tampilan rapi (xlsx-js-style): nama usaha, judul tabel, periode/filter di atas,
 * header kolom hijau tua tulisan putih rata tengah, garis tipis, format Rupiah akuntansi, baris total,
 * dan catatan waktu export di bawah tabel.
 * Di aplikasi PC (Tauri) file disimpan lewat perintah Rust ke folder Downloads lalu dibuka,
 * karena WebView tidak menangani unduhan blob seperti browser.
 */
import { isTauri, invoke } from '@/platform/desktop';

/** Format akuntansi Excel: "Rp" rata kiri, angka rata kanan, nol jadi "-". */
const RP_FMT = '_("Rp"* #,##0_);_("Rp"* -#,##0_);_("Rp"* "-"_);_(@_)';
const GREEN = '14532D';
const LINE = '9CC3AC';

export interface SheetOpts {
  title?: string;     // judul tabel ('' = file polos tanpa kop, mis. template import)
  subtitle?: string;  // periode / keterangan filter
  money?: string[];   // nama kolom yang berisi rupiah
  moneyRow?: (row: Record<string, unknown>) => boolean; // baris yang angkanya rupiah (tabel campuran)
  totals?: Record<string, unknown>; // baris total (kunci = nama kolom)
}

/** Nama usaha & pengguna untuk kop dan catatan kaki file. Diisi sekali dari AppLayout. */
const meta = { company: 'Fortuner Digital Printing', user: '' };
export function setExportMeta(m: Partial<typeof meta>) { Object.assign(meta, Object.fromEntries(Object.entries(m).filter(([, v]) => v))); }

type X = typeof import('xlsx-js-style');
type Cell = { v?: unknown; t?: string; z?: string; s?: Record<string, unknown> };

const border = (rgb: string) => ({ top: { style: 'thin', color: { rgb } }, bottom: { style: 'thin', color: { rgb } }, left: { style: 'thin', color: { rgb } }, right: { style: 'thin', color: { rgb } } });
const S = {
  company: { font: { bold: true, sz: 14, color: { rgb: GREEN } }, alignment: { horizontal: 'center', vertical: 'center' } },
  title: { font: { bold: true, sz: 12 }, alignment: { horizontal: 'center', vertical: 'center' } },
  subtitle: { font: { italic: true, sz: 10, color: { rgb: '555555' } }, alignment: { horizontal: 'center', vertical: 'center' } },
  head: { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: GREEN } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: border('0F3D21') },
  cell: { alignment: { vertical: 'top' }, border: border(LINE) },
  total: { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'E6F1EA' } }, border: { ...border(LINE), top: { style: 'medium', color: { rgb: GREEN } } } },
  footer: { font: { italic: true, sz: 9, color: { rgb: '777777' } } },
};

function buildSheet(XLSX: X, rows: Record<string, unknown>[], opts: SheetOpts = {}) {
  const data = rows.length ? rows : [{ Keterangan: 'Tidak ada data' }];
  const keys = Object.keys(data[0]);
  const n = keys.length;
  const kop = opts.title !== '';
  const money = new Set(opts.money || []);
  const aoa: unknown[][] = [];
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  const styles: [number, number, Record<string, unknown>][] = [];
  const line = (text: string, style: Record<string, unknown>) => { const r = aoa.length; aoa.push([text]); styles.push([r, 0, style]); if (n > 1) merges.push({ s: { r, c: 0 }, e: { r, c: n - 1 } }); };

  if (kop) {
    line(meta.company.toUpperCase(), S.company);
    line(opts.title || 'Data', S.title);
    if (opts.subtitle) line(opts.subtitle, S.subtitle);
    aoa.push([]);
  }
  const headRow = aoa.length;
  aoa.push(keys);
  data.forEach((r) => aoa.push(keys.map((k) => r[k] ?? '')));
  const totalRow = opts.totals ? aoa.length : -1;
  if (opts.totals) aoa.push(keys.map((k) => opts.totals![k] ?? ''));
  let footRow = -1;
  if (kop) {
    aoa.push([]);
    footRow = aoa.length;
    const when = new Date().toLocaleString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    aoa.push([`Diekspor ${when}${meta.user ? ` oleh ${meta.user}` : ''} · Fortuner POS`]);
    if (n > 1) merges.push({ s: { r: footRow, c: 0 }, e: { r: footRow, c: n - 1 } });
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const at = (r: number, c: number): Cell => { const a = XLSX.utils.encode_cell({ r, c }); return (ws[a] ||= { t: 's', v: '' }) as Cell; };
  styles.forEach(([r, c, s]) => { at(r, c).s = s; });
  keys.forEach((_, c) => { at(headRow, c).s = S.head; });
  for (let i = 0; i < data.length; i++) {
    const r = headRow + 1 + i;
    keys.forEach((k, c) => {
      const cell = at(r, c);
      const isMoney = (money.has(k) || !!opts.moneyRow?.(data[i])) && cell.t === 'n';
      cell.s = isMoney ? { ...S.cell, numFmt: RP_FMT } : S.cell;
      if (isMoney) cell.z = RP_FMT;
    });
  }
  if (totalRow >= 0) keys.forEach((k, c) => { const cell = at(totalRow, c); const m = money.has(k) && cell.t === 'n'; cell.s = m ? { ...S.total, numFmt: RP_FMT } : S.total; if (m) cell.z = RP_FMT; });
  if (footRow >= 0) at(footRow, 0).s = S.footer;

  ws['!merges'] = merges;
  const cols = keys.map((k) => Math.min(45, Math.max(k.length + 2, ...data.slice(0, 300).map((r) => String(r[k] ?? '').length + (money.has(k) ? 6 : 0))) + 2));
  // tabel sempit: lebarkan supaya kop (nama usaha, judul, periode) tidak terpotong
  if (kop) {
    const need = Math.max(meta.company.length * 1.3, (opts.title || '').length * 1.1, (opts.subtitle || '').length) + 4;
    const tot = cols.reduce((a, b) => a + b, 0);
    if (tot < need) { const i = cols.indexOf(Math.max(...cols)); cols[i] += Math.ceil(need - tot); }
  }
  ws['!cols'] = cols.map((wch) => ({ wch }));
  ws['!rows'] = kop ? [{ hpt: 22 }, { hpt: 18 }] : [];
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: headRow, c: 0 }, e: { r: headRow + data.length, c: n - 1 } }) };
  return ws;
}

const sheetName = (s: string) => (s || 'Data').slice(0, 31).replace(/[\\/?*[\]:]/g, ' ');

/** Simpan workbook: browser = unduhan biasa; aplikasi PC = simpan ke Downloads lalu buka filenya. */
async function save(XLSX: X, wb: ReturnType<X['utils']['book_new']>, filename: string) {
  if (!isTauri) { XLSX.writeFile(wb, filename); return; }
  const bytes = new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
  const path = await invoke<string>('save_download', { name: filename, data: Array.from(bytes) });
  window.dispatchEvent(new CustomEvent('fortuner:file-saved', { detail: { path, name: path.split(/[\\/]/).pop() } }));
  try { await invoke('open_path', { path, reveal: false }); } catch { /* file tetap tersimpan */ }
}

export async function exportXlsx(rows: Record<string, unknown>[], filename: string, name = 'Data', opts: SheetOpts = {}) {
  const XLSX = await import('xlsx-js-style');
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSheet(XLSX, rows, { title: name, ...opts }), sheetName(name));
  await save(XLSX, wb, filename);
}

/** Baca sheet pertama file Excel menjadi array objek. Baris kop/judul di atas tabel dilewati otomatis. */
export async function readXlsx(file: File): Promise<Record<string, unknown>[]> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
  const hr = Math.max(0, aoa.findIndex((r) => r.some((v) => String(v).trim().toLowerCase() === 'kode')));
  return XLSX.utils.sheet_to_json(ws, { defval: '', range: hr });
}

/** Beberapa sheet dalam satu file (mis. laporan lengkap). Tiap sheet berkop sama. */
export async function exportBook(sheets: ({ name: string; rows: Record<string, unknown>[] } & SheetOpts)[], filename: string, opts: { subtitle?: string } = {}) {
  const XLSX = await import('xlsx-js-style');
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, rows, ...o }) => XLSX.utils.book_append_sheet(wb, buildSheet(XLSX, rows, { title: name, subtitle: opts.subtitle, ...o }), sheetName(name)));
  await save(XLSX, wb, filename);
}

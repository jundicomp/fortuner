/** Export baris ke file .xlsx. SheetJS dimuat saat dibutuhkan saja supaya halaman awal tetap ringan. */
export async function exportXlsx(rows: Record<string, unknown>[], filename: string, sheetName = 'Data') {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows);
  const keys = Object.keys(rows[0] || {});
  ws['!cols'] = keys.map((k) => ({ wch: Math.min(40, Math.max(k.length, ...rows.slice(0, 200).map((r) => String(r[k] ?? '').length)) + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
  XLSX.writeFile(wb, filename);
}

/** Baca sheet pertama file Excel menjadi array objek (header baris 1). */
export async function readXlsx(file: File): Promise<Record<string, unknown>[]> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

/** Export beberapa sheet sekaligus ke satu file .xlsx (mis. laporan lengkap). */
export async function exportBook(sheets: { name: string; rows: Record<string, unknown>[] }[], filename: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Keterangan: 'Tidak ada data' }]);
    const keys = Object.keys(rows[0] || {});
    ws['!cols'] = keys.map((k) => ({ wch: Math.min(40, Math.max(k.length, ...rows.slice(0, 200).map((r) => String(r[k] ?? '').length)) + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
  });
  XLSX.writeFile(wb, filename);
}

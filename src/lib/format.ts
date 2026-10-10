export const rp = (n: number | null | undefined) => (n == null || isNaN(n as number) ? '–' : 'Rp ' + Math.round(n).toLocaleString('id-ID'));
export const nf = (n: number | null | undefined) => (n == null || isNaN(n as number) ? '–' : Math.round(n).toLocaleString('id-ID'));
const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (s: string, n: number) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
export const tgl = (s?: string) => {
  if (!s) return '–';
  const d = new Date(s.length <= 10 ? s + 'T00:00:00' : s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};
export const tglJam = (s?: string) => {
  if (!s) return '–';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
export const nowIso = () => new Date().toISOString();
/** Jam saja untuk hari ini (12.55), tanggal singkat + jam untuk hari lain (9/10 12.55). */
export const jam = (s?: string) => {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const hm = `${pad(d.getHours())}.${pad(d.getMinutes())}`;
  return ymd(d) === ymd() ? hm : `${d.getDate()}/${d.getMonth() + 1} ${hm}`;
};

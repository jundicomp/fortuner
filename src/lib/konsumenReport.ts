/** Laporan konsumen (ringkasan + rekap per konsumen) untuk PDF A4, Word, dan Excel. */
import type { ReceiptShop } from '@/components/Receipt';
import { REPORT_CSS } from './customerReport';
import { jenisLabel } from './jenis';
import { nf, rp, tgl, tglJam } from './format';

type J = { reseller: number; enduser: number };
export interface KonsumenStats {
  from: string; to: string;
  total: number; total_percetakan: number; total_enduser: number; aktif: number; nonaktif: number; percetakan: number; enduser: number;
  baru: number; baru_jenis: J; transaksi: number; transaksi_jenis: J; tidur: number; belum_order: number;
  omzet: J | null; nota: J | null;
  top: { id: string; nama: string; percetakan: string; tipe: string; omzet: number; nota: number }[] | null;
  bulanan: { bulan: string; reseller: number; enduser: number; nota: number; baru: number }[] | null;
  rekap: { id: string; kode: string; nama: string; tipe: string; percetakan: string; telp: string; aktif: boolean; terdaftar: string; pertama: string; terakhir: string;
    nota: number; omzet: number; batal: number; dibayar: number; rata: number; piutang: number | null; deposit: number }[] | null;
  piutang: { total: number; konsumen: number } | null;
}

const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const bulanLabel = (ym: string) => `${BLN[Number(ym.slice(5, 7)) - 1] || ''} ${ym.slice(0, 4)}`;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const pc = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '–');

export function konsumenReportHtml(s: KonsumenStats, shop: ReceiptShop, periode: string, oleh?: string) {
  const now = new Date().toISOString();
  const om = s.omzet, nt = s.nota, omT = om ? om.reseller + om.enduser : 0, ntT = nt ? nt.reseller + nt.enduser : 0;
  const kpi = (l: string, v: string, sub: string, cls = '') => `<td class="k"><div class="l">${l}</div><div class="v ${cls}">${v}</div><div class="s">${esc(sub)}</div></td>`;
  const jRow = (nama: string, k: 'reseller' | 'enduser', total: number, aktif: number) => `<tr><td><b>${nama}</b></td><td class="r">${nf(total)}</td><td class="r">${nf(aktif)}</td><td class="r">${nf(s.baru_jenis[k])}</td><td class="r">${nf(s.transaksi_jenis[k])}</td>
    ${nt ? `<td class="r">${nf(nt[k])}</td>` : ''}${om ? `<td class="r">${nf(om[k])}</td><td class="r">${pc(om[k], omT)}</td>` : ''}</tr>`;
  const rk = s.rekap || [];
  const sum = (f: (r: (typeof rk)[number]) => number) => rk.reduce((a, r) => a + f(r), 0);
  const adaPiutang = rk.some((r) => r.piutang != null);
  return `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>Laporan Konsumen ${esc(periode)}</title><style>${REPORT_CSS}
.t td, .t th { font-size: 8.5pt; }</style></head><body>
<table class="kop"><tr><td style="width:42pt"><table><tr><td class="logo">${esc((shop.nama || 'F').trim()[0] || 'F').toUpperCase()}</td></tr></table></td>
<td style="padding-left:8pt"><div class="toko">${esc(shop.nama)}</div><div class="mut">${esc([shop.alamat, shop.telp].filter(Boolean).join(' · '))}</div></td>
<td><div class="judul">LAPORAN KONSUMEN</div><div class="mut" style="text-align:right"><b style="color:#111">${esc(periode)}</b><br>Dicetak ${tglJam(now)}${oleh ? ` · ${esc(oleh)}` : ''}</div></td></tr></table>

<h2>Ringkasan</h2>
<table class="kpi"><tr>${kpi('Total konsumen', nf(s.total), `01 Percetakan ${nf(s.total_percetakan)} · 02 End user ${nf(s.total_enduser)}`)}${kpi('Konsumen aktif', nf(s.aktif), s.nonaktif ? `${nf(s.nonaktif)} nonaktif` : 'semua aktif')}${kpi('Baru terdaftar', nf(s.baru), 'dalam periode ini')}</tr>
<tr>${kpi('Konsumen yang order', nf(s.transaksi), `${pc(s.transaksi, s.aktif)} dari konsumen aktif`)}${om ? kpi('Omzet', rp(omT), `${nf(ntT)} nota · rata-rata ${rp(ntT ? omT / ntT : 0)}`) : kpi('Belum pernah order', nf(s.belum_order), 'konsumen aktif')}${s.piutang ? kpi('Piutang berjalan', rp(s.piutang.total), `${nf(s.piutang.konsumen)} konsumen · posisi saat ini`, s.piutang.total ? 'bad' : '') : kpi('Lama tidak order', nf(s.tidur), '> 60 hari')}</tr></table>
<p style="margin:6pt 0 0" class="mut">Lama tidak order (&gt; 60 hari): <b style="color:#111">${nf(s.tidur)}</b> · belum pernah order: <b style="color:#111">${nf(s.belum_order)}</b>. Jumlah konsumen, aktif, dan piutang adalah posisi saat dicetak; angka lain mengikuti periode.</p>

<h2>Per jenis konsumen</h2>
<table class="t"><thead><tr><th>Jenis</th><th class="r">Jumlah</th><th class="r">Aktif</th><th class="r">Baru</th><th class="r">Order</th>${nt ? '<th class="r">Nota</th>' : ''}${om ? '<th class="r">Omzet</th><th class="r">Porsi</th>' : ''}</tr></thead><tbody>
${jRow('01 · Percetakan', 'reseller', s.total_percetakan, s.percetakan)}${jRow('02 · End user', 'enduser', s.total_enduser, s.enduser)}</tbody>
<tfoot><tr><td>Total</td><td class="r">${nf(s.total)}</td><td class="r">${nf(s.aktif)}</td><td class="r">${nf(s.baru)}</td><td class="r">${nf(s.transaksi)}</td>${nt ? `<td class="r">${nf(ntT)}</td>` : ''}${om ? `<td class="r">${nf(omT)}</td><td class="r">100%</td>` : ''}</tr></tfoot></table>

${s.bulanan && s.bulanan.length > 1 ? `<h2>Per bulan</h2>
<table class="t"><thead><tr><th>Bulan</th><th class="r">Konsumen baru</th><th class="r">Nota</th><th class="r">Omzet 01 Percetakan</th><th class="r">Omzet 02 End user</th><th class="r">Total omzet</th></tr></thead><tbody>
${s.bulanan.map((b) => `<tr><td>${bulanLabel(b.bulan)}</td><td class="r">${nf(b.baru)}</td><td class="r">${nf(b.nota)}</td><td class="r">${nf(b.reseller)}</td><td class="r">${nf(b.enduser)}</td><td class="r"><b>${nf(b.reseller + b.enduser)}</b></td></tr>`).join('')}</tbody>
<tfoot><tr><td>Total</td><td class="r">${nf(s.bulanan.reduce((a, b) => a + b.baru, 0))}</td><td class="r">${nf(s.bulanan.reduce((a, b) => a + b.nota, 0))}</td><td class="r">${nf(s.bulanan.reduce((a, b) => a + b.reseller, 0))}</td><td class="r">${nf(s.bulanan.reduce((a, b) => a + b.enduser, 0))}</td><td class="r">${nf(s.bulanan.reduce((a, b) => a + b.reseller + b.enduser, 0))}</td></tr></tfoot></table>` : ''}

${s.top && s.top.length ? `<h2>Top ${s.top.length} konsumen</h2>
<table class="t"><thead><tr><th class="c">#</th><th>Konsumen</th><th>Jenis</th><th class="r">Nota</th><th class="r">Omzet</th><th class="r">Porsi</th></tr></thead><tbody>
${s.top.map((t, i) => `<tr><td class="c mut">${i + 1}</td><td><b>${esc(t.nama)}</b>${t.percetakan && t.percetakan !== t.nama ? ` <span class="mut">· ${esc(t.percetakan)}</span>` : ''}</td><td class="nw">${esc(jenisLabel(t.tipe))}</td><td class="r">${nf(t.nota)}</td><td class="r">${nf(t.omzet)}</td><td class="r">${pc(t.omzet, omT)}</td></tr>`).join('')}</tbody></table>` : ''}

${rk.length ? `<h2>Rekap per konsumen · ${nf(rk.length)}</h2>
<table class="t"><thead><tr><th class="c">#</th><th>Kode</th><th>Konsumen</th><th>Jenis</th><th class="r">Nota</th><th class="r">Omzet</th><th class="r">Dibayar</th>${adaPiutang ? '<th class="r">Piutang</th>' : ''}<th class="r">Deposit</th><th>Order terakhir</th></tr></thead><tbody>
${rk.map((r, i) => `<tr><td class="c mut">${i + 1}</td><td class="mono">${esc(r.kode)}</td><td><b>${esc(r.nama)}</b>${r.aktif ? '' : ' <span class="mut">(nonaktif)</span>'}${r.percetakan && r.percetakan !== r.nama ? `<br><span class="mut">${esc(r.percetakan)}</span>` : ''}</td><td class="nw">${esc(r.tipe === 'reseller' ? '01' : '02')}</td>
<td class="r">${r.nota ? nf(r.nota) : '–'}</td><td class="r">${r.omzet ? nf(r.omzet) : '–'}</td><td class="r">${r.dibayar ? nf(r.dibayar) : '–'}</td>${adaPiutang ? `<td class="r ${r.piutang ? 'bad' : 'mut'}">${r.piutang ? nf(r.piutang) : '–'}</td>` : ''}<td class="r">${r.deposit ? nf(r.deposit) : '–'}</td><td class="nw">${r.terakhir ? tgl(r.terakhir) : '<span class="mut">belum pernah</span>'}</td></tr>`).join('')}</tbody>
<tfoot><tr><td colspan="4">Total</td><td class="r">${nf(sum((r) => r.nota))}</td><td class="r">${nf(sum((r) => r.omzet))}</td><td class="r">${nf(sum((r) => r.dibayar))}</td>${adaPiutang ? `<td class="r">${nf(sum((r) => r.piutang || 0))}</td>` : ''}<td class="r">${nf(sum((r) => r.deposit))}</td><td></td></tr></tfoot></table>
<p class="mut" style="margin-top:4pt">Jenis: 01 = Percetakan (harga reseller), 02 = End user. Omzet = total nota dikurangi pembatalan. Piutang & deposit = saldo saat dicetak.</p>` : ''}

<div class="foot">Laporan konsumen · ${esc(shop.nama)} · ${esc(periode)} · dicetak ${tglJam(now)}. Angka sesuai data sistem saat dicetak.</div>
</body></html>`;
}

/** Lembar-lembar Excel: ringkasan per jenis, per bulan, top, dan rekap per konsumen. */
export function konsumenSheets(s: KonsumenStats) {
  const om = s.omzet, nt = s.nota;
  const jenis = (['reseller', 'enduser'] as const).map((k) => ({
    Jenis: jenisLabel(k), Jumlah: k === 'reseller' ? s.total_percetakan : s.total_enduser, Aktif: k === 'reseller' ? s.percetakan : s.enduser,
    'Baru terdaftar': s.baru_jenis[k], 'Konsumen order': s.transaksi_jenis[k], ...(nt ? { Nota: nt[k] } : {}), ...(om ? { Omzet: om[k] } : {}),
  }));
  const sheets: { name: string; rows: Record<string, unknown>[]; money?: string[]; totals?: Record<string, unknown> }[] = [
    { name: 'Per jenis', rows: jenis, money: ['Omzet'], totals: { Jenis: 'Total', Jumlah: s.total, Aktif: s.aktif, 'Baru terdaftar': s.baru, 'Konsumen order': s.transaksi, ...(nt ? { Nota: nt.reseller + nt.enduser } : {}), ...(om ? { Omzet: om.reseller + om.enduser } : {}) } },
  ];
  if (s.bulanan?.length) sheets.push({ name: 'Per bulan', money: ['Omzet 01 Percetakan', 'Omzet 02 End user', 'Total omzet'],
    rows: s.bulanan.map((b) => ({ Bulan: bulanLabel(b.bulan), 'Konsumen baru': b.baru, Nota: b.nota, 'Omzet 01 Percetakan': b.reseller, 'Omzet 02 End user': b.enduser, 'Total omzet': b.reseller + b.enduser })) });
  if (s.rekap?.length) {
    const pi = s.rekap.some((r) => r.piutang != null);
    sheets.push({ name: 'Rekap per konsumen', money: ['Omzet', 'Batal', 'Dibayar', 'Rata-rata/nota', 'Piutang', 'Deposit'],
      rows: s.rekap.map((r) => ({ Kode: r.kode, Nama: r.nama, 'Kode jenis': r.tipe === 'reseller' ? '01' : '02', Jenis: r.tipe === 'reseller' ? 'Percetakan' : 'End user', 'Nama percetakan': r.percetakan, Telepon: r.telp,
        Status: r.aktif ? 'Aktif' : 'Nonaktif', Terdaftar: r.terdaftar, 'Order pertama': r.pertama, 'Order terakhir': r.terakhir, Nota: r.nota, Omzet: r.omzet, Batal: r.batal, Dibayar: r.dibayar, 'Rata-rata/nota': r.rata,
        ...(pi ? { Piutang: r.piutang || 0 } : {}), Deposit: r.deposit })) });
  }
  return sheets;
}

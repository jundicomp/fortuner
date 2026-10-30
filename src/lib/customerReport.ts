/**
 * Kartu konsumen sebagai dokumen A4: dicetak / disimpan PDF lewat jendela print, atau diunduh sebagai Word (.doc).
 * Tata letak memakai tabel saja supaya tampil sama di browser (PDF) dan di Microsoft Word.
 */
import type { Profile } from '@/components/CustomerCard';
import type { ReceiptShop } from '@/components/Receipt';
import { invoke, isTauri } from '@/platform/desktop';
import { jenisLabel } from './jenis';
import { nf, rp, tgl, tglJam } from './format';

const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BAYAR: Record<string, string> = { lunas: 'Lunas', dp: 'DP', belum: 'Belum bayar', batal: 'Batal' };
const CN: Record<string, string> = { menunggu: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak' };
const DEP: Record<string, string> = { topup: 'Titip di muka', pembatalan: 'Dari pembatalan', lebih_bayar: 'Kelebihan bayar', pakai: 'Bayar nota', cair: 'Dicairkan' };
const CARA: Record<string, string> = { transfer: 'Transfer', tunai: 'Tunai', edc: 'EDC', deposit: 'Deposit', lain: 'Lain' };

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const n0 = (v: number) => (v ? nf(v) : '–');

export const REPORT_CSS = `
@page { size: A4; margin: 14mm 13mm 16mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Inter, 'Segoe UI', Arial, sans-serif; font-size: 9.5pt; color: #111; line-height: 1.35; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
table { border-collapse: collapse; width: 100%; font-size: inherit; }
td, th { vertical-align: top; }
.kop td { padding: 0 0 8pt; border-bottom: 2.5pt solid #F26B1D; }
.logo { width: 34pt; height: 34pt; background: #F26B1D; color: #fff; font-weight: 800; font-size: 15pt; text-align: center; vertical-align: middle; }
.toko { font-size: 13pt; font-weight: 800; }
.mut { color: #666; }
.judul { font-size: 15pt; font-weight: 800; letter-spacing: 1pt; text-align: right; }
h2 { font-size: 10.5pt; margin: 14pt 0 5pt; padding-bottom: 3pt; border-bottom: 1pt solid #111; text-transform: uppercase; letter-spacing: .6pt; page-break-after: avoid; }
.prof { margin-top: 10pt; } .prof, .prof td { background: #111; color: #fff; }
.prof td { padding: 10pt 12pt; }
.prof .nama { font-size: 16pt; font-weight: 800; }
.prof .lbl { color: #bbb; font-size: 8pt; }
.badge { background: #F26B1D; color: #fff; font-weight: 700; padding: 2pt 7pt; font-size: 8.5pt; }
.kpi td.k { width: 33.33%; border: 1pt solid #ddd; padding: 7pt 9pt; }
.kpi .l { font-size: 7.5pt; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: .5pt; }
.kpi .v { font-size: 13pt; font-weight: 800; margin-top: 2pt; }
.kpi .s { font-size: 8pt; color: #666; }
.bad { color: #C62828; } .ok { color: #1B7A3E; } .brand { color: #D9560F; }
.t th { background: #F3F3F3; font-size: 8pt; text-transform: uppercase; letter-spacing: .3pt; text-align: left; padding: 4pt 5pt; border-bottom: 1pt solid #999; }
.t td { padding: 3.5pt 5pt; border-bottom: .5pt solid #ddd; }
.t tr { page-break-inside: avoid; }
.t tfoot td { font-weight: 800; border-top: 1pt solid #111; border-bottom: none; }
.r { text-align: right; white-space: nowrap; } .c { text-align: center; } .mono { font-family: 'JetBrains Mono', Consolas, monospace; font-size: 8.5pt; }
.nw, .mono { white-space: nowrap; }
.bar { height: 6pt; background: #2E9E5B; display: inline-block; vertical-align: middle; }
.bar.p { background: #E53935; }
.two td.col { width: 50%; padding-right: 8pt; } .two td.col + td.col { padding: 0 0 0 8pt; }
.kv td { padding: 3pt 0; } .kv td:first-child { white-space: nowrap; padding-right: 8pt; } .kv td { border-bottom: .5pt dashed #ccc; } .kv td + td { text-align: right; font-weight: 700; }
.strike { text-decoration: line-through; color: #888; }
.foot { margin-top: 18pt; font-size: 8pt; color: #888; border-top: .5pt solid #ccc; padding-top: 5pt; }
.ttd td { padding-top: 26pt; text-align: center; width: 50%; }
`;

export interface ReportOpts { olehNama?: string }

/** Dokumen HTML lengkap (A4) untuk satu konsumen. */
export function customerReportHtml(p: Profile, shop: ReceiptShop, o: ReportOpts = {}) {
  const cu = p.customer, k = p.kpi;
  const piutang = p.orders.filter((x) => x.sisa > 0);
  const caraTot = Object.values(p.kebiasaan.cara).reduce((a, b) => a + b, 0);
  const maxB = Math.max(1, ...p.bulan.map((b) => b.cash + b.piutang));
  const tot = p.bulan.reduce((a, b) => ({ cash: a.cash + b.cash, piutang: a.piutang + b.piutang, batal: a.batal + b.batal }), { cash: 0, piutang: 0, batal: 0 });
  const st = p.status;
  const kpi = (l: string, v: string, s: string, cls = '') => `<td class="k"><div class="l">${l}</div><div class="v ${cls}">${v}</div><div class="s">${esc(s)}</div></td>`;
  const kv = (l: string, v: string) => `<tr><td class="mut">${l}</td><td>${esc(v)}</td></tr>`;
  const batalPersen = k.batal_dokumen && k.belanja ? ` · ${((k.batal_nilai / (k.belanja + k.batal_nilai)) * 100).toFixed(1).replace('.', ',')}%` : '';
  const sekarang = new Date().toISOString();

  const orderRows = p.orders.map((x, i) => `<tr><td class="c mut">${i + 1}</td><td class="mono ${x.status_batal === 'penuh' ? 'strike' : ''}">${esc(x.nomor)}</td><td class="nw">${tgl(x.tanggal)}</td><td>${esc(x.ringkas)}</td>
    <td class="r">${nf(x.total)}${x.batal_nilai > 0 ? `<br><span class="bad">batal −${nf(x.batal_nilai)}</span>` : ''}</td><td class="r ${x.sisa > 0 ? 'bad' : 'mut'}">${x.sisa > 0 ? nf(x.sisa) : '–'}</td>
    <td>${BAYAR[x.status_bayar] || x.status_bayar}${x.deposit ? ' · deposit' : ''}${x.status_batal === 'sebagian' ? ' · batal sebagian' : ''}</td><td>${x.status_ambil === 'diambil' ? 'Diambil' : x.status_batal === 'penuh' ? '–' : 'Belum'}</td></tr>`).join('');

  const html = `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>Kartu Konsumen ${esc(cu.nama)} #${esc(cu.kode)}</title><style>${REPORT_CSS}</style></head><body>
<table class="kop"><tr><td style="width:42pt"><table><tr><td class="logo">${esc((shop.nama || 'F').trim()[0] || 'F').toUpperCase()}</td></tr></table></td>
<td style="padding-left:8pt"><div class="toko">${esc(shop.nama)}</div><div class="mut">${esc([shop.alamat, shop.telp].filter(Boolean).join(' · '))}</div></td>
<td><div class="judul">KARTU KONSUMEN</div><div class="mut" style="text-align:right">Dicetak ${tglJam(sekarang)}${o.olehNama ? ` · ${esc(o.olehNama)}` : ''}</div></td></tr></table>

<table class="prof"><tr><td style="width:55%"><div class="nama">${esc(cu.nama)}</div><div style="color:#ccc">${esc([cu.percetakan, `#${cu.kode}`].filter(Boolean).join(' · '))}</div>
<div style="margin-top:6pt"><span class="badge">${esc(jenisLabel(cu.tipe))} · harga ${cu.tipe === 'reseller' ? 'reseller' : 'end user'}</span> &nbsp;<span style="color:#ccc">${cu.aktif ? 'Aktif' : 'Nonaktif'}</span></div></td>
<td><table><tr><td style="padding:0 8pt 5pt 0"><div class="lbl">WhatsApp</div>${esc(cu.telp || '–')}</td><td style="padding:0 0 5pt"><div class="lbl">Pelanggan sejak</div>${p.pelanggan_sejak ? tgl(p.pelanggan_sejak) : '–'}</td></tr>
<tr><td style="padding:0 8pt 0 0"><div class="lbl">Alamat</div>${esc(cu.alamat || '–')}</td><td style="padding:0"><div class="lbl">Paling sering dilayani</div>${esc(p.cs_terbanyak || '–')}</td></tr></table></td></tr>
${cu.catatan ? `<tr><td colspan="2" style="padding-top:0"><span class="lbl">Catatan:</span> ${esc(cu.catatan)}</td></tr>` : ''}</table>

<h2>Ringkasan</h2>
<table class="kpi"><tr>${kpi('Total belanja', rp(k.belanja), k.peringkat ? `peringkat #${k.peringkat} dari ${k.jumlah_konsumen} konsumen` : 'belum ada order')}${kpi('Jumlah order', `${nf(k.nota)} nota`, `rata-rata ${rp(k.rata_nota)} / nota`)}${kpi('Order terakhir', k.hari_sejak == null ? '–' : k.hari_sejak === 0 ? 'Hari ini' : `${k.hari_sejak} hari lalu`, k.interval ? `biasanya order setiap ±${k.interval} hari` : k.terakhir ? tgl(k.terakhir) : '')}</tr>
<tr>${kpi('Piutang berjalan', rp(k.piutang), k.piutang_nota ? `${k.piutang_nota} nota · tertua ${k.piutang_tertua} hari` : 'tidak ada', k.piutang > 0 ? 'bad' : '')}${kpi('Saldo deposit', rp(k.deposit), k.deposit_bebas !== k.deposit ? `${rp(k.deposit - k.deposit_bebas)} sedang dicairkan` : 'bisa dipakai di order berikutnya', 'brand')}${kpi('Pembatalan', `${k.batal_dokumen} dokumen`, k.batal_dokumen ? `${rp(k.batal_nilai)}${batalPersen}` : 'tidak ada')}</tr></table>
<p style="margin:6pt 0 0">Status bayar ${nf(k.nota)} nota: <b class="ok">Lunas ${st.lunas || 0}</b> · <b class="brand">DP ${st.dp || 0}</b> · <b class="bad">Belum bayar ${st.belum || 0}</b> · <b class="mut">Batal ${st.batal || 0}</b> &nbsp;|&nbsp; Diambil ${p.orders.filter((x) => x.status_ambil === 'diambil').length} · belum ${p.orders.filter((x) => x.status_ambil !== 'diambil' && x.status_batal !== 'penuh').length}</p>

<table class="two"><tr><td class="col">
<h2>Belanja per bulan · ${esc(p.tahun)}</h2>
<table class="t"><thead><tr><th>Bulan</th><th class="r">Cash</th><th class="r">Piutang</th><th class="r">Batal</th><th style="width:64pt"></th></tr></thead><tbody>
${p.bulan.map((b, i) => `<tr><td>${BLN[i]}</td><td class="r">${n0(b.cash)}</td><td class="r ${b.piutang ? 'bad' : ''}">${n0(b.piutang)}</td><td class="r mut">${n0(b.batal)}</td><td><span class="bar" style="width:${((b.cash / maxB) * 50).toFixed(1)}pt"></span><span class="bar p" style="width:${((b.piutang / maxB) * 50).toFixed(1)}pt"></span></td></tr>`).join('')}
</tbody><tfoot><tr><td>Total</td><td class="r">${nf(tot.cash)}</td><td class="r">${nf(tot.piutang)}</td><td class="r">${nf(tot.batal)}</td><td></td></tr></tfoot></table>
</td><td class="col">
<h2>Produk favorit</h2>
${p.produk.length ? `<table class="t"><thead><tr><th>Produk</th><th class="r">Qty</th><th class="r">Nilai</th></tr></thead><tbody>${p.produk.map((x) => `<tr><td>${esc(x.nama)}</td><td class="r">${nf(x.qty)}</td><td class="r">${nf(x.nilai)}</td></tr>`).join('')}</tbody></table>` : '<p class="mut">Belum ada.</p>'}
<h2>Kebiasaan</h2>
<table class="kv">${kv('Hari paling sering order', p.kebiasaan.hari.join(' & ') || '–')}${kv('Jam ramai', p.kebiasaan.jam || '–')}${kv('Rata-rata lama bayar', p.kebiasaan.lama_bayar == null ? '–' : `${p.kebiasaan.lama_bayar} hari`)}${kv('Cara bayar', Object.entries(p.kebiasaan.cara).map(([c, v]) => `${CARA[c] || c} ${caraTot ? Math.round((v / caraTot) * 100) : 0}%`).join(' · ') || '–')}</table>
<h2>Umur piutang</h2>
<table class="t"><thead><tr><th>0–30 hari</th><th>31–60 hari</th><th>&gt; 60 hari</th></tr></thead><tbody><tr><td>${rp(p.aging.a)}<br><span class="mut">${p.aging.an} nota</span></td><td>${rp(p.aging.b)}<br><span class="mut">${p.aging.bn} nota</span></td><td class="${p.aging.c ? 'bad' : ''}">${rp(p.aging.c)}<br><span class="mut">${p.aging.cn} nota</span></td></tr></tbody></table>
</td></tr></table>

${piutang.length ? `<h2>Tagihan belum lunas · ${piutang.length} nota</h2>
<table class="t"><thead><tr><th>Nota</th><th>Tanggal</th><th class="r">Umur</th><th>Item</th><th class="r">Total</th><th class="r">Sisa</th></tr></thead><tbody>
${piutang.map((x) => `<tr><td class="mono">${esc(x.nomor)}</td><td class="nw">${tgl(x.tanggal)}</td><td class="r">${x.umur} hari</td><td>${esc(x.ringkas)}</td><td class="r">${nf(x.total - x.batal_nilai)}</td><td class="r bad">${nf(x.sisa)}</td></tr>`).join('')}
</tbody><tfoot><tr><td colspan="5">Total piutang</td><td class="r bad">${nf(k.piutang)}</td></tr></tfoot></table>` : ''}

<h2>Riwayat order · ${p.orders.length} nota</h2>
<table class="t"><thead><tr><th class="c">#</th><th>Nota</th><th>Tanggal</th><th>Item</th><th class="r">Total</th><th class="r">Sisa</th><th>Bayar</th><th>Ambil</th></tr></thead><tbody>${orderRows || '<tr><td colspan="8" class="c mut">Belum ada order.</td></tr>'}</tbody>
<tfoot><tr><td colspan="4">Total</td><td class="r">${nf(p.orders.reduce((a, x) => a + x.total, 0))}</td><td class="r">${nf(k.piutang)}</td><td colspan="2"></td></tr></tfoot></table>

<h2>Pembayaran · ${p.payments.length}</h2>
${p.payments.length ? `<table class="t"><thead><tr><th>Tanggal</th><th>Nota</th><th>Metode</th><th>Kasir</th><th class="r">Nominal</th></tr></thead><tbody>${p.payments.map((x) => `<tr><td class="nw">${tgl(x.tanggal)}</td><td class="mono">${esc(x.nota)}</td><td>${esc(x.metode)}</td><td>${esc(x.kasir)}</td><td class="r">${nf(x.nominal)}</td></tr>`).join('')}</tbody>
<tfoot><tr><td colspan="4">Total dibayar</td><td class="r">${nf(p.payments.reduce((a, x) => a + x.nominal, 0))}</td></tr></tfoot></table>` : '<p class="mut">Belum ada pembayaran.</p>'}

<h2>Mutasi deposit · saldo ${rp(k.deposit)}</h2>
${p.deposit.length ? `<table class="t"><thead><tr><th>Tanggal</th><th>No.</th><th>Keterangan</th><th class="r">Masuk</th><th class="r">Keluar</th><th class="r">Saldo</th></tr></thead><tbody>${p.deposit.map((m) => `<tr><td class="nw">${tgl(m.tanggal)}</td><td class="mono">${esc(m.nomor)}</td><td>${esc(DEP[m.jenis] || m.jenis)}${m.keterangan ? ` · ${esc(m.keterangan)}` : ''}</td><td class="r ok">${m.masuk ? nf(m.masuk) : ''}</td><td class="r bad">${m.keluar ? nf(m.keluar) : ''}</td><td class="r"><b>${nf(m.saldo)}</b></td></tr>`).join('')}</tbody></table>` : '<p class="mut">Belum ada deposit.</p>'}

<h2>Pembatalan · ${p.pembatalan.length}</h2>
${p.pembatalan.length ? `<table class="t"><thead><tr><th>Dokumen</th><th>Tanggal</th><th>Nota</th><th>Alasan</th><th class="r">Nilai batal</th><th>Status</th></tr></thead><tbody>${p.pembatalan.map((x) => `<tr><td class="mono">${esc(x.nomor)}</td><td class="nw">${tgl(x.tanggal)}</td><td class="mono">${esc(x.order_nomor)}</td><td>${esc(x.alasan)}<br><span class="mut">${esc(x.diajukan_nama)}</span></td><td class="r">${nf(x.nilai_batal || x.nilai_item)}</td><td>${CN[x.status] || x.status}</td></tr>`).join('')}</tbody></table>` : '<p class="mut">Tidak ada pembatalan.</p>'}

<table class="ttd"><tr><td>Konsumen<br><br><br>( ${esc(cu.nama)} )</td><td>${esc(shop.nama)}<br><br><br>( ${esc(o.olehNama || '....................')} )</td></tr></table>
<div class="foot">Kartu konsumen ${esc(cu.nama)} #${esc(cu.kode)} · ${esc(shop.nama)} · dicetak ${tglJam(sekarang)}. Angka sesuai data sistem saat dicetak.</div>
</body></html>`;
  return html;
}

const fileBase = (p: Profile) => `Kartu Konsumen ${p.customer.kode} ${p.customer.nama}`.replace(/[\\/:*?"<>|]+/g, ' ').trim();

/** Cetak A4 / simpan PDF: dokumen dimuat di iframe tersembunyi lalu jendela print dibuka (pilih "Simpan sebagai PDF"). */
export function printCustomerReport(p: Profile, shop: ReceiptShop, o: ReportOpts = {}) {
  printHtml(customerReportHtml(p, shop, o), fileBase(p));
}

/** Cetak dokumen HTML A4 lewat iframe tersembunyi; judul = nama file default saat disimpan PDF. */
export function printHtml(html: string, title: string) {
  const fr = document.createElement('iframe');
  fr.setAttribute('aria-hidden', 'true');
  fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(fr);
  const doc = fr.contentDocument!;
  doc.open(); doc.write(html); doc.close();
  // pakai huruf aplikasi (Inter) bila tersedia
  try {
    const fonts = Array.from(document.styleSheets).flatMap((s) => { try { return Array.from(s.cssRules); } catch { return []; } })
      .filter((r) => r.constructor.name === 'CSSFontFaceRule' || r.cssText.startsWith('@font-face')).map((r) => r.cssText).join('\n');
    if (fonts) { const st = doc.createElement('style'); st.textContent = fonts; doc.head.appendChild(st); }
  } catch { /* huruf cadangan dipakai */ }
  const prevTitle = document.title;
  document.title = title; // nama file default saat "Simpan sebagai PDF"
  const go = () => {
    try { fr.contentWindow!.focus(); fr.contentWindow!.print(); } catch { /* pratinjau tertentu memblokir print */ }
    setTimeout(() => { document.title = prevTitle; fr.remove(); }, 1500);
  };
  const f = (doc as Document & { fonts?: FontFaceSet }).fonts;
  setTimeout(() => (f ? f.ready.then(go, go) : go()), 150);
}

/** Word tidak membaca CSS kelas dengan baik: gaya hasil akhir tiap elemen disalin jadi style inline. */
const INH = ['color', 'font-size', 'font-weight', 'font-style', 'font-family', 'text-align', 'white-space', 'letter-spacing', 'text-transform', 'text-decoration-line', 'line-height'];
const ALWAYS = ['color', 'font-size', 'font-family', 'font-weight'];
const BOX = ['background-color', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'vertical-align'];
const SIDES = ['top', 'right', 'bottom', 'left'];
export function inlineHtml(html: string): Promise<string> {
  return new Promise((resolve) => {
    const fr = document.createElement('iframe');
    fr.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;visibility:hidden';
    document.body.appendChild(fr);
    const doc = fr.contentDocument!;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
      const win = fr.contentWindow!;
      const all = Array.from(doc.body.querySelectorAll<HTMLElement>('*'));
      const css = all.map((el) => {
        const c = win.getComputedStyle(el), pc = win.getComputedStyle(el.parentElement || doc.body);
        const out: string[] = [];
        for (const k of INH) { const v = c.getPropertyValue(k); if (v && (ALWAYS.includes(k) || v !== pc.getPropertyValue(k))) out.push(`${k === 'text-decoration-line' ? 'text-decoration' : k}:${v}`); }
        for (const k of BOX) { const v = c.getPropertyValue(k); if (v && v !== '0px' && v !== 'rgba(0, 0, 0, 0)' && v !== 'baseline') out.push(`${k}:${v}`); }
        for (const sd of SIDES) { const w = c.getPropertyValue(`border-${sd}-width`); if (w && w !== '0px' && c.getPropertyValue(`border-${sd}-style`) !== 'none') out.push(`border-${sd}:${w} ${c.getPropertyValue(`border-${sd}-style`)} ${c.getPropertyValue(`border-${sd}-color`)}`); }
        if (el.tagName === 'TABLE') { out.push('border-collapse:collapse', 'width:100%'); el.setAttribute('width', '100%'); el.setAttribute('cellspacing', '0'); }
        if ((el.tagName === 'TD' || el.tagName === 'TH') && el.parentElement) {
          const tw = el.closest('table')!.getBoundingClientRect().width, w = el.getBoundingClientRect().width;
          if (tw && w) el.setAttribute('width', `${Math.round((w / tw) * 100)}%`);
        }
        return out;
      });
      all.forEach((el, n) => { const own = el.getAttribute('style'); el.setAttribute('style', [...css[n], ...(own ? [own] : [])].join(';')); el.removeAttribute('class'); });
      const bodyStyle = `font-family:${win.getComputedStyle(doc.body).fontFamily};font-size:${win.getComputedStyle(doc.body).fontSize};color:#111`;
      const out = doc.body.innerHTML;
      fr.remove();
      resolve(`<!DOCTYPE html><html lang="id" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${doc.title}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>@page WordSection1 { size: 21cm 29.7cm; margin: 1.4cm 1.3cm 1.6cm; } div.WordSection1 { page: WordSection1; } table { border-collapse: collapse; }</style></head>
<body style="${bodyStyle}"><div class="WordSection1">${out}</div></body></html>`);
    }, 50);
  });
}

/** Unduh sebagai dokumen Word (.doc) yang bisa diedit. Aplikasi PC: tersimpan di Downloads lalu dibuka. */
export async function downloadCustomerDoc(p: Profile, shop: ReceiptShop, o: ReportOpts = {}) {
  await downloadDoc(customerReportHtml(p, shop, o), fileBase(p));
}

/** Simpan dokumen HTML sebagai file Word (.doc) A4. */
export async function downloadDoc(html: string, base: string) {
  const body = await inlineHtml(html);
  const name = `${base.replace(/[\\/:*?"<>|]+/g, ' ').trim()}.doc`;
  const bytes = new TextEncoder().encode('﻿' + body);
  if (isTauri) {
    const path = await invoke<string>('save_download', { name, data: Array.from(bytes) });
    window.dispatchEvent(new CustomEvent('fortuner:file-saved', { detail: { path, name: path.split(/[\\/]/).pop() } }));
    try { await invoke('open_path', { path, reveal: false }); } catch { /* file tetap tersimpan */ }
    return;
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/msword' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

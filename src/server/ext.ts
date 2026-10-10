/**
 * v1.1 — Stok bahan, pembelian, stok opname, HPP (bahan + klik), buku besar, laba rugi, analisa margin.
 * Dipisah dari core.ts supaya rapi; helper dari core disuntikkan lewat makeExt().
 *
 * Aturan stok:
 *  - Bertambah lewat Pembelian (harga rata-rata tertimbang diperbarui).
 *  - Berkurang otomatis sesuai resep produk saat item selesai diproduksi (atau saat dibayar, lihat setting
 *    stok_kurang_saat), dan pasti saat barang diserahkan ke konsumen. Sekali per item.
 *  - Stok opname mencatat selisih fisik vs sistem.
 * HPP per item = Σ(pemakaian bahan × harga rata-rata) + klik × tarif klik mesin, disimpan di item saat stok dikurangi.
 * Buku besar dibentuk dari transaksi (bukan diinput ulang), ditambah jurnal manual untuk saldo awal/koreksi.
 */
import type { Row } from './schema';
import type { Env, Store } from './store';
import { hargaBerlaku } from '../lib/pricing';
import type { PermissionMap, PriceRow } from '../types';

type Op = 'lihat' | 'tambah' | 'ubah' | 'hapus' | 'ekspor';
export interface ExtCtx { s: Store; env: Env; user?: Row; perms?: PermissionMap }
export interface Helpers {
  fail: (code: string, msg: string) => never;
  str: (v: unknown) => string;
  bool: (v: unknown) => boolean;
  newId: (env: Env, prefix: string) => string;
  iso: (env: Env) => string;
  addDays: (ymd: string, n: number) => string;
  isYmd: (s: string) => boolean;
  settingsMap: (s: Store) => Record<string, string>;
  need: (c: any, key: string, op?: Op) => void;
  stamp: (c: any, isNew: boolean) => Row;
  log: (c: any, aksi: string, tabel: string, recordId: string, ringkasan: string, alasan?: string) => void;
}

export interface Account { kode: string; nama: string; tipe: 'aset' | 'kewajiban' | 'modal' | 'pendapatan' | 'hpp' | 'beban' }
export interface JLine { akun: string; d: number; k: number }
export interface JEntry { tanggal: string; ref: string; sumber: string; keterangan: string; lines: JLine[] }

const num = (v: unknown) => Number(v) || 0;
const r2 = (n: number) => Math.round(n * 100) / 100;
const debitNormal = (t: Account['tipe']) => t === 'aset' || t === 'hpp' || t === 'beban';

export const BASE_ACCOUNTS: Account[] = [
  { kode: '1110', nama: 'Kas kecil', tipe: 'aset' },
  { kode: '1200', nama: 'Piutang usaha', tipe: 'aset' },
  { kode: '1300', nama: 'Persediaan bahan', tipe: 'aset' },
  { kode: '1400', nama: 'Aset tetap & peralatan', tipe: 'aset' },
  { kode: '2100', nama: 'Hutang usaha (supplier)', tipe: 'kewajiban' },
  { kode: '2110', nama: 'Hutang biaya klik mesin', tipe: 'kewajiban' },
  { kode: '3100', nama: 'Modal / saldo awal', tipe: 'modal' },
  { kode: '3200', nama: 'Prive (ambil pribadi)', tipe: 'modal' },
  { kode: '4100', nama: 'Pendapatan penjualan', tipe: 'pendapatan' },
  { kode: '4900', nama: 'Pendapatan lain', tipe: 'pendapatan' },
  { kode: '5100', nama: 'HPP bahan baku', tipe: 'hpp' },
  { kode: '5110', nama: 'HPP biaya klik mesin', tipe: 'hpp' },
  { kode: '5120', nama: 'Bahan di luar stok', tipe: 'hpp' },
  { kode: '5130', nama: 'Selisih persediaan (opname)', tipe: 'hpp' },
  { kode: '6900', nama: 'Beban kas kecil', tipe: 'beban' },
  { kode: '6910', nama: 'Selisih kas', tipe: 'beban' },
];

export function makeExt(h: Helpers) {
  const { fail, str, bool, newId, iso, addDays, isYmd, settingsMap, need, stamp, log } = h;
  const can = (c: ExtCtx, key: string, op: Op = 'lihat') => !!c.perms?.[key]?.[op];
  const needAny = (c: ExtCtx, keys: [string, Op][]) => { if (!keys.some(([k, o]) => can(c, k, o))) fail('FORBIDDEN', 'Anda tidak punya akses untuk tindakan ini.'); };
  const today = (c: ExtCtx) => c.env.today();
  /** Harga bahan hanya untuk yang mengurus pembelian / laba. Operator & CS cukup melihat jumlah. */
  const seeCost = (c: ExtCtx) => can(c, 'pembelian') || can(c, 'laporan.laba') || can(c, 'master.harga_beli');
  const hideCost = (c: ExtCtx, r: Row, keys: string[]) => { if (seeCost(c)) return r; const o = { ...r }; keys.forEach((k) => { o[k] = null; }); return o; };
  const byId = (rows: Row[]) => Object.fromEntries(rows.map((r) => [str(r.id), r])) as Record<string, Row>;

  // ---------------- mutasi stok ----------------
  function move(c: ExtCtx, mat: Row, qty: number, jenis: string, harga: number, tanggal: string, refTabel: string, refId: string, ket: string) {
    const stokLama = num(mat.stok);
    const stok = r2(stokLama + qty);
    const patch: Row = { stok, ...stamp(c, false) };
    if (jenis === 'beli' || jenis === 'awal') {
      patch.harga_rata = stokLama > 0 && num(mat.harga_rata) > 0 ? r2((stokLama * num(mat.harga_rata) + qty * harga) / stok) : r2(harga);
      patch.harga_terakhir = r2(harga);
    } else if (jenis === 'batal_beli' && stok > 0) {
      const v = (stokLama * num(mat.harga_rata) + qty * harga) / stok; // qty negatif
      if (v > 0) patch.harga_rata = r2(v);
    }
    c.s.update('materials', 'id', str(mat.id), patch);
    Object.assign(mat, patch);
    return c.s.insert('stock_moves', {
      id: newId(c.env, 'stm'), tanggal, material_id: str(mat.id), jenis, qty: r2(qty), harga: r2(harga), nilai: Math.round(qty * harga), saldo: stok,
      ref_tabel: refTabel, ref_id: refId, keterangan: ket.slice(0, 200), ...stamp(c, true),
    });
  }

  const stokMode = (c: ExtCtx) => (settingsMap(c.s).stok_kurang_saat === 'bayar' ? 'bayar' : 'selesai');

  /** Kurangi stok sesuai resep + catat HPP item. Aman dipanggil berulang (sekali per item). */
  function deductItem(c: ExtCtx, item: Row, tanggal: string, cache?: { mats: Record<string, Row>; recipes: Row[]; machines: Record<string, Row>; orders: Record<string, Row> }) {
    if (str(item.stok_at) || str(item.status_produksi) === 'batal') return false;
    const mats = cache?.mats || byId(c.s.all('materials'));
    const recipes = (cache?.recipes || c.s.all('recipes')).filter((r) => r.product_id === item.product_id);
    const machines = cache?.machines || byId(c.s.all('machines'));
    const o = (cache?.orders || byId(c.s.all('orders')))[str(item.order_id)];
    let hppB = 0;
    recipes.forEach((r) => {
      const m = mats[str(r.material_id)];
      if (!m) return;
      const q = r2(num(r.qty) * (r.per === 'klik' ? num(item.klik) : num(item.qty)));
      if (!(q > 0)) return;
      const hr = num(m.harga_rata);
      move(c, m, -q, 'pakai', hr, tanggal, 'order_items', str(item.id), `${str(o?.nomor)} ${str(item.nama_produk)}`);
      hppB += q * hr;
    });
    const hppK = num(item.klik) * num(machines[str(item.mesin_id)]?.biaya_klik);
    const patch = { hpp_bahan: Math.round(hppB), hpp_klik: Math.round(hppK), stok_at: tanggal + 'T' + iso(c.env).slice(11) };
    c.s.update('order_items', 'id', str(item.id), patch);
    Object.assign(item, patch);
    return true;
  }
  function deductOrder(c: ExtCtx, orderId: string, tanggal = today(c)) {
    c.s.all('order_items').filter((i) => i.order_id === orderId).forEach((i) => deductItem(c, i, tanggal));
  }

  // hook dari core
  const hooks = {
    onProductionDone(c: ExtCtx, itemIds: string[]) {
      if (stokMode(c) !== 'selesai') return;
      c.s.all('order_items').filter((i) => itemIds.includes(str(i.id))).forEach((i) => deductItem(c, i, today(c)));
    },
    onPayment(c: ExtCtx, orderId: string) { if (stokMode(c) === 'bayar') deductOrder(c, orderId); },
    onPickup(c: ExtCtx, orderId: string) { deductOrder(c, orderId); },
  };

  // ---------------- perhitungan HPP produk (estimasi untuk resep & margin) ----------------
  function productCost(c: ExtCtx, productId: string, sisi: 1 | 2, cache?: { mats: Record<string, Row>; recipes: Row[]; machines: Record<string, Row>; products: Record<string, Row> }) {
    const p = (cache?.products || byId(c.s.all('products')))[productId];
    const mats = cache?.mats || byId(c.s.all('materials'));
    const machines = cache?.machines || byId(c.s.all('machines'));
    const recipes = (cache?.recipes || c.s.all('recipes')).filter((r) => r.product_id === productId);
    const klik = p?.jenis_harga === 'matriks' ? sisi : 1;
    let bahan = 0;
    const rincian = recipes.map((r) => {
      const m = mats[str(r.material_id)];
      const q = num(r.qty) * (r.per === 'klik' ? klik : 1);
      const nilai = q * num(m?.harga_rata);
      bahan += nilai;
      return { material_id: str(r.material_id), nama: str(m?.nama), satuan: str(m?.satuan), qty: r2(q), harga: num(m?.harga_rata), nilai: r2(nilai) };
    });
    const tarif = num(machines[str(p?.mesin_id)]?.biaya_klik);
    return { bahan: r2(bahan), klik: r2(klik * tarif), total: r2(bahan + klik * tarif), klik_per_unit: klik, tarif_klik: tarif, resep: recipes.length > 0, rincian };
  }

  // ---------------- jurnal (buku besar) ----------------
  function buildJournal(c: ExtCtx) {
    const accounts: Record<string, Account> = Object.fromEntries(BASE_ACCOUNTS.map((a) => [a.kode, a]));
    const methods = c.s.all('payment_methods');
    methods.forEach((m) => { accounts['1100:' + m.id] = { kode: '1100:' + str(m.id), nama: `Kas & bank: ${str(m.nama)}`, tipe: 'aset' }; });
    const kas = (methodId: unknown) => {
      const k = '1100:' + str(methodId);
      if (!accounts[k]) accounts[k] = { kode: k, nama: 'Kas & bank: (metode tidak dikenal)', tipe: 'aset' };
      return k;
    };
    const tunai = methods.find((m) => m.jenis === 'tunai');
    const cats = byId(c.s.all('expense_categories'));
    c.s.all('expense_categories').forEach((x) => {
      if (!['bahan', 'aset', 'klik'].includes(str(x.jenis))) accounts['6100:' + x.id] = { kode: '6100:' + str(x.id), nama: `Beban ${str(x.nama)}`, tipe: 'beban' };
    });
    const E: JEntry[] = [];
    const add = (tanggal: string, ref: string, sumber: string, keterangan: string, lines: JLine[]) => {
      const ls = lines.filter((l) => Math.round(l.d) || Math.round(l.k)).map((l) => ({ akun: l.akun, d: Math.round(l.d), k: Math.round(l.k) }));
      if (ls.length) E.push({ tanggal: str(tanggal).slice(0, 10), ref, sumber, keterangan, lines: ls });
    };
    const orders = c.s.all('orders');
    const oById = byId(orders);
    orders.forEach((o) => { if (!bool(o.batal) && num(o.total)) add(str(o.tanggal), str(o.nomor), 'nota', `Penjualan ${str(o.nomor)}`, [{ akun: '1200', d: num(o.total), k: 0 }, { akun: '4100', d: 0, k: num(o.total) }]); });
    c.s.all('payments').forEach((p) => add(str(p.tanggal), str(oById[str(p.order_id)]?.nomor), 'pembayaran', `Pembayaran ${str(oById[str(p.order_id)]?.nomor)}`, [{ akun: kas(p.method_id), d: num(p.nominal), k: 0 }, { akun: '1200', d: 0, k: num(p.nominal) }]));
    const mats = byId(c.s.all('materials'));
    c.s.all('stock_moves').forEach((m) => {
      const v = Math.abs(num(m.nilai));
      const nm = str(mats[str(m.material_id)]?.nama);
      if (m.jenis === 'pakai') add(str(m.tanggal), str(m.keterangan).split(' ')[0], 'stok', `Pemakaian ${nm}`, [{ akun: '5100', d: v, k: 0 }, { akun: '1300', d: 0, k: v }]);
      else if (m.jenis === 'opname') add(str(m.tanggal), 'OPNAME', 'stok', `Selisih opname ${nm}`, num(m.qty) < 0 ? [{ akun: '5130', d: v, k: 0 }, { akun: '1300', d: 0, k: v }] : [{ akun: '1300', d: v, k: 0 }, { akun: '5130', d: 0, k: v }]);
      else if (m.jenis === 'awal') add(str(m.tanggal), 'STOK AWAL', 'stok', `Stok awal ${nm}`, [{ akun: '1300', d: v, k: 0 }, { akun: '3100', d: 0, k: v }]);
    });
    c.s.all('order_items').forEach((i) => {
      if (num(i.hpp_klik) && str(i.stok_at)) add(str(i.stok_at), str(oById[str(i.order_id)]?.nomor), 'stok', `Biaya klik ${str(i.nama_produk)}`, [{ akun: '5110', d: num(i.hpp_klik), k: 0 }, { akun: '2110', d: 0, k: num(i.hpp_klik) }]);
    });
    c.s.all('purchases').forEach((p) => {
      if (bool(p.deleted)) return;
      add(str(p.tanggal), str(p.nota) || 'PEMBELIAN', 'pembelian', `Pembelian bahan ${str(p.nota)}`, [{ akun: '1300', d: num(p.total), k: 0 }, p.cara_bayar === 'hutang' ? { akun: '2100', d: 0, k: num(p.total) } : { akun: kas(p.method_id), d: 0, k: num(p.total) }]);
    });
    c.s.all('expenses').forEach((x) => {
      if (bool(x.deleted) || str(x.purchase_id)) return;
      const j = str(cats[str(x.kategori_id)]?.jenis);
      const dr = j === 'bahan' ? '5120' : j === 'aset' ? '1400' : j === 'klik' ? '2110' : accounts['6100:' + x.kategori_id] ? '6100:' + str(x.kategori_id) : '6100:lain';
      if (!accounts[dr]) accounts[dr] = { kode: dr, nama: 'Beban lain-lain', tipe: 'beban' };
      add(str(x.tanggal), str(x.nota) || 'PENGELUARAN', 'pengeluaran', str(x.item), [{ akun: dr, d: num(x.total), k: 0 }, x.cara_bayar === 'hutang' ? { akun: '2100', d: 0, k: num(x.total) } : { akun: kas(x.method_id), d: 0, k: num(x.total) }]);
    });
    c.s.all('bill_payments').forEach((b) => add(str(b.tanggal), 'BAYAR HUTANG', 'hutang', str(b.keterangan) || 'Pembayaran hutang supplier', [{ akun: '2100', d: num(b.nominal), k: 0 }, { akun: kas(b.method_id), d: 0, k: num(b.nominal) }]));
    c.s.all('petty_cash').forEach((p) => {
      if (bool(p.deleted)) return;
      if (num(p.masuk)) add(str(p.tanggal), 'KAS KECIL', 'kas kecil', str(p.item) || 'Isi kas kecil', [{ akun: '1110', d: num(p.masuk), k: 0 }, { akun: tunai ? kas(tunai.id) : '3100', d: 0, k: num(p.masuk) }]);
      if (num(p.keluar)) add(str(p.tanggal), 'KAS KECIL', 'kas kecil', str(p.item), [{ akun: '6900', d: num(p.keluar), k: 0 }, { akun: '1110', d: 0, k: num(p.keluar) }]);
    });
    c.s.all('cash_deposits').forEach((d) => {
      const sel = num(d.selisih);
      if (!sel) return;
      add(str(d.tanggal), 'TUTUP KAS', 'kas', str(d.keterangan) || 'Selisih tutup kas', sel < 0 ? [{ akun: '6910', d: -sel, k: 0 }, { akun: kas(d.method_id), d: 0, k: -sel }] : [{ akun: kas(d.method_id), d: sel, k: 0 }, { akun: '6910', d: 0, k: sel }]);
    });
    c.s.all('journals').forEach((j) => {
      if (bool(j.deleted)) return;
      const lines = (Array.isArray(j.lines) ? j.lines : []) as { akun: string; debit: number; kredit: number }[];
      lines.forEach((l) => { if (!accounts[l.akun]) accounts[l.akun] = { kode: l.akun, nama: l.akun, tipe: 'beban' }; });
      add(str(j.tanggal), 'JURNAL', 'manual', str(j.keterangan), lines.map((l) => ({ akun: str(l.akun), d: num(l.debit), k: num(l.kredit) })));
    });
    E.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    return { accounts, entries: E };
  }

  function trial(c: ExtCtx, from: string, to: string) {
    const { accounts, entries } = buildJournal(c);
    const agg: Record<string, { awal: number; d: number; k: number }> = {};
    entries.forEach((e) => {
      if (e.tanggal > to) return;
      e.lines.forEach((l) => {
        const a = (agg[l.akun] ||= { awal: 0, d: 0, k: 0 });
        if (e.tanggal < from) a.awal += l.d - l.k; else { a.d += l.d; a.k += l.k; }
      });
    });
    const rows = Object.entries(agg).map(([kode, a]) => {
      const acc = accounts[kode] || { kode, nama: kode, tipe: 'beban' as const };
      const sign = debitNormal(acc.tipe) ? 1 : -1;
      return { kode, nama: acc.nama, tipe: acc.tipe, saldo_awal: sign * a.awal, debit: a.d, kredit: a.k, saldo_akhir: sign * (a.awal + a.d - a.k) };
    }).sort((x, y) => x.kode.localeCompare(y.kode));
    return { rows, total_debit: rows.reduce((s, r) => s + r.debit, 0), total_kredit: rows.reduce((s, r) => s + r.kredit, 0) };
  }

  function pnl(c: ExtCtx, from: string, to: string) {
    const { accounts, entries } = buildJournal(c);
    const sum: Record<string, number> = {};
    entries.forEach((e) => { if (e.tanggal >= from && e.tanggal <= to) e.lines.forEach((l) => { sum[l.akun] = (sum[l.akun] || 0) + l.d - l.k; }); });
    const val = (k: string) => { const a = accounts[k]; return a && !debitNormal(a.tipe) ? -(sum[k] || 0) : sum[k] || 0; };
    const pendapatan = val('4100');
    const lain = val('4900');
    const hpp = [
      { kode: '5100', nama: 'Bahan baku (kertas, stiker, film)', nilai: val('5100') },
      { kode: '5110', nama: 'Biaya klik mesin', nilai: val('5110') },
      { kode: '5120', nama: 'Bahan di luar stok', nilai: val('5120') },
      { kode: '5130', nama: 'Selisih persediaan (opname)', nilai: val('5130') },
    ];
    const totalHpp = hpp.reduce((s, x) => s + x.nilai, 0);
    const beban = Object.keys(accounts).filter((k) => accounts[k].tipe === 'beban' && val(k)).map((k) => ({ kode: k, nama: accounts[k].nama, nilai: val(k) })).sort((a, b) => b.nilai - a.nilai);
    const totalBeban = beban.reduce((s, x) => s + x.nilai, 0);
    return { pendapatan, pendapatan_lain: lain, hpp, total_hpp: totalHpp, laba_kotor: pendapatan + lain - totalHpp, beban, total_beban: totalBeban, laba_bersih: pendapatan + lain - totalHpp - totalBeban };
  }

  // ---------------- handler ----------------
  const handlers: Record<string, { auth: boolean; fn: (c: any, p: any) => unknown }> = {
    'stock.meta': {
      auth: true,
      fn: (c: ExtCtx) => {
        needAny(c, [['stok', 'lihat'], ['pembelian', 'lihat'], ['master.produk', 'lihat']]);
        const mats = c.s.all('materials');
        return {
          materials: mats.map((m) => hideCost(c, { ...m, nilai: Math.round(num(m.stok) * num(m.harga_rata)), status: !bool(m.aktif) ? 'nonaktif' : num(m.stok) <= 0 ? 'habis' : num(m.stok) <= num(m.stok_min) ? 'menipis' : 'aman' }, ['harga_rata', 'harga_terakhir', 'nilai'])),
          lihat_harga: seeCost(c),
          suppliers: c.s.all('suppliers').filter((x) => bool(x.aktif)).map((x) => ({ id: x.id, nama: x.nama })),
          payment_methods: c.s.all('payment_methods').filter((x) => bool(x.aktif)).map((x) => ({ id: x.id, nama: x.nama, jenis: x.jenis })),
          mode: stokMode(c),
        };
      },
    },
    'material.save': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        const m = p.material || {};
        need(c, 'stok', 'ubah'); // daftar bahan = master data; operator cukup opname (tambah)
        const nama = str(m.nama), satuan = str(m.satuan) || 'lembar', kode = str(m.kode).toUpperCase();
        if (!nama) fail('VALIDATION', 'Nama bahan wajib diisi.');
        return c.s.withLock(() => {
          const all = c.s.all('materials');
          if (kode && all.some((x) => str(x.kode).toUpperCase() === kode && x.id !== m.id)) fail('VALIDATION', `Kode ${kode} sudah dipakai.`);
          if (all.some((x) => str(x.nama).toLowerCase() === nama.toLowerCase() && x.id !== m.id)) fail('VALIDATION', `Bahan "${nama}" sudah ada.`);
          const data = { kode, nama, satuan, kategori: str(m.kategori), stok_min: Math.max(0, num(m.stok_min)), aktif: m.aktif !== false, catatan: str(m.catatan).slice(0, 200) };
          if (m.id) {
            const cur = all.find((x) => x.id === m.id) || fail('NOT_FOUND', 'Bahan tidak ditemukan.');
            const row = c.s.update('materials', 'id', str((cur as Row).id), { ...data, ...stamp(c, false) });
            log(c, 'ubah_bahan', 'materials', str(m.id), nama);
            return row;
          }
          const row = c.s.insert('materials', { id: newId(c.env, 'mat'), ...data, stok: 0, harga_rata: 0, harga_terakhir: 0, ...stamp(c, true) });
          const awal = num(m.stok_awal), hAwal = num(m.harga_awal);
          if (awal > 0) move(c, row, awal, 'awal', hAwal, today(c), 'materials', str(row.id), 'Stok awal');
          log(c, 'tambah_bahan', 'materials', str(row.id), `${nama}${awal ? ` stok awal ${awal} ${satuan}` : ''}`);
          return c.s.all('materials').find((x) => x.id === row.id);
        });
      },
    },
    'recipe.get': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        needAny(c, [['master.produk', 'lihat'], ['stok', 'lihat']]);
        const pid = str(p.product_id);
        const lines = c.s.all('recipes').filter((r) => r.product_id === pid);
        return { lines, satu_sisi: productCost(c, pid, 1), bolak_balik: productCost(c, pid, 2), lihat_harga: can(c, 'master.harga_beli') || can(c, 'laporan.laba') };
      },
    },
    'recipe.save': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        needAny(c, [['master.produk', 'ubah'], ['stok', 'ubah']]);
        const pid = str(p.product_id);
        const prod = c.s.all('products').find((x) => x.id === pid) || fail('NOT_FOUND', 'Produk tidak ditemukan.');
        if (bool((prod as Row).kertas_sendiri) && Array.isArray(p.lines) && p.lines.length) fail('VALIDATION', 'Produk kertas sendiri (upah print) tidak memakai bahan dari stok. HPP-nya hanya biaya klik mesin.');
        const mats = byId(c.s.all('materials'));
        const lines = (Array.isArray(p.lines) ? p.lines : []).map((l: any) => ({ material_id: str(l.material_id), qty: num(l.qty), per: l.per === 'klik' ? 'klik' : 'unit' }));
        lines.forEach((l: any) => { if (!mats[l.material_id]) fail('VALIDATION', 'Ada bahan yang tidak dikenal.'); if (!(l.qty > 0)) fail('VALIDATION', 'Jumlah pemakaian harus lebih dari 0.'); });
        if (new Set(lines.map((l: any) => l.material_id)).size !== lines.length) fail('VALIDATION', 'Bahan yang sama tercantum dua kali.');
        return c.s.withLock(() => {
          c.s.all('recipes').filter((r) => r.product_id === pid).forEach((r) => c.s.remove('recipes', 'id', str(r.id)));
          lines.forEach((l: any) => c.s.insert('recipes', { id: newId(c.env, 'rcp'), product_id: pid, ...l, ...stamp(c, true) }));
          log(c, 'resep', 'products', pid, `Resep: ${lines.map((l: any) => `${mats[l.material_id].nama} ${l.qty}/${l.per}`).join(', ') || '(kosong)'}`);
          return { lines: c.s.all('recipes').filter((r) => r.product_id === pid), satu_sisi: productCost(c, pid, 1), bolak_balik: productCost(c, pid, 2) };
        });
      },
    },
    'stock.card': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        need(c, 'stok');
        const mid = str(p.material_id);
        const m = c.s.all('materials').find((x) => x.id === mid) || fail('NOT_FOUND', 'Bahan tidak ditemukan.');
        const from = isYmd(str(p.from)) ? str(p.from) : '0000-01-01', to = isYmd(str(p.to)) ? str(p.to) : '9999-12-31';
        const moves = c.s.all('stock_moves').filter((x) => x.material_id === mid).sort((a, b) => str(a.tanggal).localeCompare(str(b.tanggal))); // stabil: urutan input dalam tanggal yang sama
        const before = moves.filter((x) => str(x.tanggal) < from);
        const saldoAwal = r2(before.reduce((s, x) => s + num(x.qty), 0));
        let saldo = saldoAwal;
        const rows = moves.filter((x) => str(x.tanggal) >= from && str(x.tanggal) <= to).map((x) => { saldo = r2(saldo + num(x.qty)); return hideCost(c, { ...x, saldo_berjalan: saldo }, ['harga', 'nilai']); });
        return { material: hideCost(c, m as Row, ['harga_rata', 'harga_terakhir']), saldo_awal: saldoAwal, rows, masuk: r2(rows.filter((r) => num(r.qty) > 0).reduce((s, r) => s + num(r.qty), 0)), keluar: r2(-rows.filter((r) => num(r.qty) < 0).reduce((s, r) => s + num(r.qty), 0)), saldo_akhir: saldo };
      },
    },
    'opname.save': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        need(c, 'stok', 'tambah');
        const lines = (Array.isArray(p.lines) ? p.lines : []).filter((l: any) => l.stok_fisik !== '' && l.stok_fisik != null);
        if (!lines.length) fail('VALIDATION', 'Isi jumlah fisik minimal satu bahan.');
        return c.s.withLock(() => {
          const mats = byId(c.s.all('materials'));
          const id = newId(c.env, 'opn');
          const t = today(c);
          let nilai = 0, n = 0;
          lines.forEach((l: any) => {
            const m = mats[str(l.material_id)] || fail('VALIDATION', 'Bahan tidak dikenal.');
            const fisik = num(l.stok_fisik);
            if (fisik < 0) fail('VALIDATION', `Jumlah fisik ${str(m.nama)} tidak boleh minus.`);
            const sistem = num(m.stok);
            const sel = r2(fisik - sistem);
            const hr = num(m.harga_rata);
            if (sel) move(c, m, sel, 'opname', hr, t, 'opnames', id, `Opname: ${str(l.keterangan) || 'selisih hitung fisik'}`);
            c.s.insert('opname_items', { id: newId(c.env, 'opi'), opname_id: id, material_id: m.id, stok_sistem: sistem, stok_fisik: fisik, selisih: sel, harga: hr, nilai: Math.round(sel * hr), keterangan: str(l.keterangan).slice(0, 200) });
            nilai += Math.round(sel * hr); n++;
          });
          c.s.insert('opnames', { id, tanggal: t, keterangan: str(p.keterangan).slice(0, 200), jumlah_item: n, nilai_selisih: nilai, ...stamp(c, true) });
          log(c, 'opname', 'opnames', id, `Stok opname ${n} bahan, selisih ${nilai.toLocaleString('id-ID')}`);
          return { id, jumlah_item: n, nilai_selisih: seeCost(c) ? nilai : null };
        });
      },
    },
    'opname.list': {
      auth: true,
      fn: (c: ExtCtx) => {
        need(c, 'stok');
        const mats = byId(c.s.all('materials'));
        const users = byId(c.s.all('users'));
        const items = c.s.all('opname_items');
        return c.s.all('opnames').map((o): Row => ({ ...o, oleh: str(users[str(o.created_by)]?.nama), nilai_selisih: seeCost(c) ? o.nilai_selisih : null, items: items.filter((i) => i.opname_id === o.id).map((i) => hideCost(c, { ...i, nama: str(mats[str(i.material_id)]?.nama), satuan: str(mats[str(i.material_id)]?.satuan) }, ['harga', 'nilai'])) })).sort((a, b) => str(b.created_at).localeCompare(str(a.created_at)));
      },
    },
    'purchase.save': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        need(c, 'pembelian', 'tambah');
        const r = p.purchase || {};
        const t = str(r.tanggal);
        if (!isYmd(t) || t > today(c)) fail('VALIDATION', 'Tanggal tidak valid.');
        const cara = r.cara_bayar === 'hutang' ? 'hutang' : 'lunas';
        if (cara === 'hutang' && !r.supplier_id) fail('VALIDATION', 'Pembelian tempo harus memilih supplier.');
        if (cara === 'lunas' && !c.s.all('payment_methods').some((m) => m.id === r.method_id)) fail('VALIDATION', 'Pilih metode pembayaran.');
        const items = (Array.isArray(r.items) ? r.items : []).map((i: any) => ({ material_id: str(i.material_id), qty_beli: num(i.qty_beli), satuan_beli: str(i.satuan_beli), isi: num(i.isi) || 1, harga_beli: Math.round(num(i.harga_beli)) }));
        if (!items.length) fail('VALIDATION', 'Tambahkan minimal satu bahan.');
        return c.s.withLock(() => {
          const mats = byId(c.s.all('materials'));
          items.forEach((i: any) => { if (!mats[i.material_id]) fail('VALIDATION', 'Ada bahan yang tidak dikenal.'); if (!(i.qty_beli > 0) || !(i.harga_beli > 0)) fail('VALIDATION', `Isi jumlah dan harga untuk ${str(mats[i.material_id].nama)}.`); });
          const total = items.reduce((s: number, i: any) => s + Math.round(i.qty_beli * i.harga_beli), 0);
          const id = newId(c.env, 'pur');
          const cat = c.s.all('expense_categories').find((x) => x.jenis === 'bahan');
          const ringkas = items.map((i: any) => `${str(mats[i.material_id].nama)} ${i.qty_beli} ${i.satuan_beli || mats[i.material_id].satuan}`).join(', ');
          const eid = newId(c.env, 'exp');
          let billId = '';
          if (cara === 'hutang') {
            billId = newId(c.env, 'bil');
            const jt = isYmd(str(r.jatuh_tempo)) ? str(r.jatuh_tempo) : addDays(t, 30);
            c.s.insert('supplier_bills', { id: billId, tanggal: t, nota: str(r.nota), supplier_id: str(r.supplier_id), expense_id: eid, total, terbayar: 0, sisa: total, jatuh_tempo: jt, keterangan: `Pembelian bahan: ${ringkas}`.slice(0, 300), ...stamp(c, true) });
          }
          c.s.insert('expenses', {
            id: eid, tanggal: t, nota: str(r.nota).slice(0, 80), supplier_id: str(r.supplier_id), kategori_id: str(cat?.id), product_id: '', item: `Pembelian bahan: ${ringkas}`.slice(0, 200), qty: 1, satuan: 'nota', harga: total, total,
            isi_per_satuan: null, mesin_id: '', cara_bayar: cara, method_id: cara === 'lunas' ? str(r.method_id) : '', bill_id: billId, keterangan: str(r.keterangan).slice(0, 300), deleted: false, purchase_id: id, ...stamp(c, true),
          });
          c.s.insert('purchases', { id, tanggal: t, nota: str(r.nota).slice(0, 80), supplier_id: str(r.supplier_id), total, cara_bayar: cara, method_id: cara === 'lunas' ? str(r.method_id) : '', bill_id: billId, expense_id: eid, jatuh_tempo: cara === 'hutang' ? (isYmd(str(r.jatuh_tempo)) ? str(r.jatuh_tempo) : addDays(t, 30)) : '', keterangan: str(r.keterangan).slice(0, 300), deleted: false, ...stamp(c, true) });
          items.forEach((i: any) => {
            const m = mats[i.material_id];
            const qtyStok = r2(i.qty_beli * i.isi), hargaStok = r2(i.harga_beli / i.isi);
            c.s.insert('purchase_items', { id: newId(c.env, 'pui'), purchase_id: id, ...i, satuan_beli: i.satuan_beli || str(m.satuan), subtotal: Math.round(i.qty_beli * i.harga_beli), qty_stok: qtyStok, harga_stok: hargaStok });
            move(c, m, qtyStok, 'beli', hargaStok, t, 'purchases', id, `Pembelian ${str(r.nota)}`.trim());
          });
          log(c, 'pembelian', 'purchases', id, `Pembelian ${total.toLocaleString('id-ID')} (${cara}): ${ringkas}`);
          return { id, total };
        });
      },
    },
    'purchase.list': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        need(c, 'pembelian');
        const from = isYmd(str(p.from)) ? str(p.from) : '0000-01-01', to = isYmd(str(p.to)) ? str(p.to) : '9999-12-31';
        const sup = byId(c.s.all('suppliers')), met = byId(c.s.all('payment_methods')), mats = byId(c.s.all('materials')), bills = byId(c.s.all('supplier_bills')), users = byId(c.s.all('users'));
        const items = c.s.all('purchase_items');
        return c.s.all('purchases').filter((x) => !bool(x.deleted) && str(x.tanggal) >= from && str(x.tanggal) <= to).map((x) => ({
          ...x, supplier: str(sup[str(x.supplier_id)]?.nama), metode: str(met[str(x.method_id)]?.nama), oleh: str(users[str(x.created_by)]?.nama),
          sisa_hutang: x.bill_id ? num(bills[str(x.bill_id)]?.sisa) : 0,
          items: items.filter((i) => i.purchase_id === x.id).map((i) => ({ ...i, nama: str(mats[str(i.material_id)]?.nama), satuan: str(mats[str(i.material_id)]?.satuan) })),
        }));
      },
    },
    'purchase.delete': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        need(c, 'pembelian', 'hapus');
        if (!str(p.alasan)) fail('VALIDATION', 'Isi alasan penghapusan.');
        return c.s.withLock(() => {
          const x = c.s.all('purchases').find((r) => r.id === p.id && !bool(r.deleted)) || fail('NOT_FOUND', 'Pembelian tidak ditemukan.');
          const pr = x as Row;
          if (pr.bill_id) {
            const b = c.s.all('supplier_bills').find((r) => r.id === pr.bill_id);
            if (b && num(b.terbayar) > 0) fail('VALIDATION', 'Hutang pembelian ini sudah dicicil. Hapus tidak diizinkan.');
            if (b) c.s.update('supplier_bills', 'id', str(b.id), { sisa: 0, total: 0, keterangan: `DIHAPUS: ${str(b.keterangan)}`.slice(0, 300), ...stamp(c, false) });
          }
          const mats = byId(c.s.all('materials'));
          c.s.all('purchase_items').filter((i) => i.purchase_id === pr.id).forEach((i) => { const m = mats[str(i.material_id)]; if (m) move(c, m, -num(i.qty_stok), 'batal_beli', num(i.harga_stok), today(c), 'purchases', str(pr.id), `Hapus pembelian ${str(pr.nota)}`); });
          if (pr.expense_id) c.s.update('expenses', 'id', str(pr.expense_id), { deleted: true, ...stamp(c, false) });
          c.s.update('purchases', 'id', str(pr.id), { deleted: true, ...stamp(c, false) });
          log(c, 'hapus_pembelian', 'purchases', str(pr.id), `Hapus pembelian ${str(pr.nota)} ${num(pr.total).toLocaleString('id-ID')}`, str(p.alasan));
          return { ok: true };
        });
      },
    },
    'margin.list': {
      auth: true,
      fn: (c: ExtCtx) => {
        need(c, 'laporan.laba');
        const cache = { mats: byId(c.s.all('materials')), recipes: c.s.all('recipes'), machines: byId(c.s.all('machines')), products: byId(c.s.all('products')) };
        const prices = c.s.all('price_history') as unknown as PriceRow[];
        const minMargin = num(settingsMap(c.s).margin_min || 20);
        const t = today(c);
        return {
          margin_min: minMargin,
          rows: c.s.all('products').filter((x) => bool(x.aktif) && x.jenis_harga !== 'manual').map((x) => {
            const h = hargaBerlaku(prices.filter((r) => r.product_id === x.id), t);
            const c1 = productCost(c, str(x.id), 1, cache), c2 = productCost(c, str(x.id), 2, cache);
            const pr = (k: string, cost: number) => { const v = h ? num((h as any)[k]) : 0; return v ? { harga: v, margin: Math.round(((v - cost) / v) * 1000) / 10 } : null; };
            const cells = { es: pr('es', c1.total), rb: pr('rb', c1.total), es_bb: x.jenis_harga === 'matriks' ? pr('es_bb', c2.total) : null, rb_bb: x.jenis_harga === 'matriks' ? pr('rb_bb', c2.total) : null };
            const margins = Object.values(cells).filter(Boolean).map((v) => (v as { margin: number }).margin);
            const terendah = margins.length ? Math.min(...margins) : null;
            return {
              id: x.id, kode: x.kode, nama: x.nama, kategori: x.kategori, jenis_harga: x.jenis_harga, mesin: str(cache.machines[str(x.mesin_id)]?.nama),
              kertas_sendiri: bool(x.kertas_sendiri), resep: c1.resep || bool(x.kertas_sendiri), hpp_bahan: c1.bahan, hpp_klik: c1.klik, hpp: c1.total, hpp_bb: x.jenis_harga === 'matriks' ? c2.total : null, ...cells, margin_terendah: terendah,
              status: !c1.resep && !bool(x.kertas_sendiri) ? 'tanpa_resep' : terendah == null ? 'tanpa_harga' : terendah < 0 ? 'rugi' : terendah < minMargin ? 'tipis' : 'aman',
            };
          }),
        };
      },
    },
    'report.pnl': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        need(c, 'laporan.laba');
        const to = isYmd(str(p.to)) ? str(p.to) : today(c);
        const from = isYmd(str(p.from)) ? str(p.from) : to.slice(0, 8) + '01';
        const days = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
        const pFrom = addDays(from, -days), pTo = addDays(from, -1);
        const orders = byId(c.s.all('orders').filter((o) => !bool(o.batal) && str(o.tanggal) >= from && str(o.tanggal) <= to));
        const belum = c.s.all('order_items').filter((i) => orders[str(i.order_id)] && !str(i.stok_at) && i.status_produksi !== 'batal');
        const klikCat = new Set(c.s.all('expense_categories').filter((x) => x.jenis === 'klik').map((x) => str(x.id)));
        const tagihanKlik = c.s.all('expenses').filter((x) => !bool(x.deleted) && klikCat.has(str(x.kategori_id)) && str(x.tanggal) >= from && str(x.tanggal) <= to).reduce((s, x) => s + num(x.total), 0);
        return { from, to, sekarang: pnl(c, from, to), sebelumnya: { from: pFrom, to: pTo, ...pnl(c, pFrom, pTo) }, belum_hpp: { item: belum.length, nilai_jual: belum.reduce((s, i) => s + num(i.subtotal), 0) }, tagihan_klik: tagihanKlik };
      },
    },
    'ledger.trial': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        need(c, 'laporan.laba');
        const to = isYmd(str(p.to)) ? str(p.to) : today(c);
        const from = isYmd(str(p.from)) ? str(p.from) : to.slice(0, 8) + '01';
        return { from, to, ...trial(c, from, to) };
      },
    },
    'ledger.get': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        need(c, 'laporan.laba');
        const to = isYmd(str(p.to)) ? str(p.to) : today(c);
        const from = isYmd(str(p.from)) ? str(p.from) : to.slice(0, 8) + '01';
        const akun = str(p.akun);
        const { accounts, entries } = buildJournal(c);
        const acc = accounts[akun] || fail('NOT_FOUND', 'Akun tidak ditemukan.');
        const sign = debitNormal(acc.tipe) ? 1 : -1;
        let awal = 0;
        const rows: Row[] = [];
        entries.forEach((e) => e.lines.forEach((l) => {
          if (l.akun !== akun || e.tanggal > to) return;
          if (e.tanggal < from) { awal += sign * (l.d - l.k); return; }
          rows.push({ tanggal: e.tanggal, ref: e.ref, sumber: e.sumber, keterangan: e.keterangan, debit: l.d, kredit: l.k });
        }));
        let saldo = awal;
        rows.forEach((r) => { saldo += sign * (num(r.debit) - num(r.kredit)); r.saldo = saldo; });
        return { akun: acc, from, to, saldo_awal: awal, rows, saldo_akhir: saldo, accounts: Object.values(accounts).sort((a, b) => a.kode.localeCompare(b.kode)) };
      },
    },
    'journal.list': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        need(c, 'laporan.laba');
        const to = isYmd(str(p.to)) ? str(p.to) : today(c);
        const from = isYmd(str(p.from)) ? str(p.from) : to.slice(0, 8) + '01';
        const { accounts, entries } = buildJournal(c);
        const users = byId(c.s.all('users'));
        return {
          accounts: Object.values(accounts).sort((a, b) => a.kode.localeCompare(b.kode)),
          entries: entries.filter((e) => e.tanggal >= from && e.tanggal <= to),
          manual: c.s.all('journals').filter((j) => !bool(j.deleted)).map((j) => ({ ...j, oleh: str(users[str(j.created_by)]?.nama) })),
        };
      },
    },
    'journal.save': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        need(c, 'laporan.laba', 'tambah');
        const j = p.journal || {};
        const t = str(j.tanggal);
        if (!isYmd(t)) fail('VALIDATION', 'Tanggal tidak valid.');
        if (!str(j.keterangan)) fail('VALIDATION', 'Isi keterangan jurnal.');
        const lines = (Array.isArray(j.lines) ? j.lines : []).map((l: any) => ({ akun: str(l.akun), debit: Math.round(num(l.debit)), kredit: Math.round(num(l.kredit)) })).filter((l: any) => l.akun && (l.debit || l.kredit));
        if (lines.length < 2) fail('VALIDATION', 'Jurnal minimal dua baris.');
        const d = lines.reduce((s: number, l: any) => s + l.debit, 0), k = lines.reduce((s: number, l: any) => s + l.kredit, 0);
        if (d !== k) fail('VALIDATION', `Debit (${d.toLocaleString('id-ID')}) dan kredit (${k.toLocaleString('id-ID')}) harus sama.`);
        const known = buildJournal(c).accounts;
        lines.forEach((l: any) => { if (!known[l.akun]) fail('VALIDATION', `Akun ${l.akun} tidak dikenal.`); });
        return c.s.withLock(() => {
          const row = c.s.insert('journals', { id: newId(c.env, 'jrn'), tanggal: t, keterangan: str(j.keterangan).slice(0, 200), lines, deleted: false, ...stamp(c, true) });
          log(c, 'jurnal', 'journals', str(row.id), `${str(j.keterangan)} ${d.toLocaleString('id-ID')}`);
          return row;
        });
      },
    },
    'journal.delete': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        need(c, 'laporan.laba', 'hapus');
        if (!str(p.alasan)) fail('VALIDATION', 'Isi alasan penghapusan.');
        return c.s.withLock(() => {
          const j = c.s.all('journals').find((x) => x.id === p.id && !bool(x.deleted)) || fail('NOT_FOUND', 'Jurnal tidak ditemukan.');
          c.s.update('journals', 'id', str((j as Row).id), { deleted: true, ...stamp(c, false) });
          log(c, 'hapus_jurnal', 'journals', str((j as Row).id), str((j as Row).keterangan), str(p.alasan));
          return { ok: true };
        });
      },
    },
  };

  /** Ringkasan untuk dashboard: bahan menipis/habis. */
  function lowStock(c: ExtCtx) {
    return c.s.all('materials').filter((m) => bool(m.aktif) && num(m.stok) <= num(m.stok_min))
      .map((m) => ({ id: m.id, nama: m.nama, satuan: m.satuan, stok: num(m.stok), stok_min: num(m.stok_min) }))
      .sort((a, b) => a.stok / Math.max(1, a.stok_min) - b.stok / Math.max(1, b.stok_min));
  }

  return { handlers, hooks, deductItem, move, productCost, buildJournal, pnl, trial, lowStock };
}

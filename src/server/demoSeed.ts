import { _hashPasswordForSeed, _newId, _ext, seedBase, formatNota, counterKey } from './core';
import { hargaBerlaku, hitungHarga } from '../lib/pricing';
import type { Env, Store } from './store';

/**
 * Data contoh untuk mode demo. SENGAJA bukan data asli (repo publik):
 * harga dan nama konsumen di sini hanya ilustrasi. Data asli diimpor lewat menu Produk → Import Excel.
 */
export function seedDemo(s: Store, env: Env) {
  seedBase(s, env, { username: 'owner', password: 'owner123', nama: 'Owner Demo' });
  const now = env.now().toISOString();
  const st = { created_at: now, created_by: 'seed', updated_at: now, updated_by: 'seed' };
  // owner demo tidak dipaksa ganti password
  const owner = s.all('users').find((u) => u.role === 'owner')!;
  s.update('users', 'id', String(owner.id), { harus_ganti_password: false });
  const users: [string, string, string, boolean][] = [
    ['admin', 'Admin Demo', 'admin', false], ['cs', 'Riska (CS)', 'cs', true], ['kasir', 'Tina (Kasir)', 'kasir', true],
    ['operator', 'Ismed (Operator)', 'operator', false], ['keuangan', 'Dedy (Keuangan)', 'keuangan', false],
  ];
  users.forEach(([u, n, r, k]) => {
    const salt = env.uuid();
    s.insert('users', { id: _newId(env, 'usr'), username: u, nama: n, role: r, salt, password_hash: _hashPasswordForSeed(u + '123', salt), khusus_kantor: k, jam_login_dari: '', jam_login_sampai: '', aktif: true, harus_ganti_password: false, ...st });
  });
  const mesin = (n: string) => String(s.all('machines').find((m) => m.nama === n)?.id || '');
  const today = env.today();
  const shift = (n: number) => { const [y, m, d] = today.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
  type P = [string, string, string, string, string, (number | null)[]];
  const products: P[] = [
    ['1', 'HVS warna A3+', 'Kertas', 'versant', 'matriks', [1500, 2500, 1700, 3000, 3200, 4300, 3400, 4700]],
    ['2', 'Art paper 120', 'Kertas', 'versant', 'matriks', [1600, 2700, 1800, 3100, 3300, 4400, 3500, 4800]],
    ['3', 'Art paper 150', 'Kertas', 'versant', 'matriks', [1700, 2800, 1900, 3200, 3400, 4500, 3600, 4900]],
    ['5', 'Art carton 210', 'Kertas', 'versant', 'matriks', [1900, 3000, 2100, 3400, 3600, 4700, 3800, 5100]],
    ['7', 'Art carton 260', 'Kertas', 'versant', 'matriks', [2100, 3200, 2300, 3600, 3800, 4900, 4000, 5300]],
    ['9', 'Stiker kromo', 'Stiker', 'versant', 'matriks', [2300, null, 2500, null, 4200, null, 4400, null]],
    ['12', 'Stiker glossy', 'Stiker', 'versant', 'matriks', [6500, null, 6500, null, 8000, null, 8000, null]],
    ['16', 'Linen', 'Kertas', 'versant', 'matriks', [2600, 3700, 2800, 4100, 4300, 5500, 4500, 5900]],
    ['22', 'BW HVS A3+', 'Hitam putih', 'Mahogani', 'matriks', [400, 550, 450, 650, 1400, 1550, 1450, 1650]],
    ['33', 'KS warna (kertas sendiri)', 'Kertas sendiri', 'versant', 'matriks', [1200, 2300, 1400, 2700, 3000, 4100, 3200, 4500]],
    ['29', 'BW KS (kertas sendiri)', 'Kertas sendiri', 'Mahogani', 'matriks', [200, 400, 300, 500, 1200, 1400, 1300, 1500]],
    ['36', 'Cutting stiker standar', 'Finishing', 'graphtech', 'cutting', [1000, 2000, 3000, 4000, null, null, null, null]],
    ['39', 'Cutting stiker rumit', 'Finishing', 'graphtech', 'cutting', [3000, 4000, 5000, 6000, null, null, null, null]],
    ['44', 'Laminating doff', 'Finishing', 'laminating', 'matriks', [1250, 1000, 1500, 1100, 3500, null, 3500, null]],
    ['81', 'DTF A4', 'DTF', 'DTF', 'tetap', [10000, null, null, null, null, null, null, null]],
    ['80', 'DTF A3', 'DTF', 'DTF', 'tetap', [20000, null, null, null, null, null, null, null]],
    ['42', 'Desain', 'Jasa', 'desain', 'manual', []],
  ];
  const keys = ['rb', 'rb_bb', 'rs', 'rs_bb', 'eb', 'eb_bb', 'es', 'es_bb'];
  products.forEach(([kode, nama, kat, m, jenis, harga]) => {
    const id = _newId(env, 'prd');
    s.insert('products', { id, kode, nama, kategori: kat, mesin_id: mesin(m), jenis_harga: jenis, satuan: 'lembar', aktif: true, kertas_sendiri: kat === 'Kertas sendiri', ...st });
    if (!harga.length) return;
    const tiers: Record<string, number | null> = {};
    keys.forEach((k, i) => (tiers[k] = harga[i] ?? null));
    if (kode === '5') {
      // contoh riwayat: harga lama, harga sekarang, dan kenaikan terjadwal
      const old: Record<string, number | null> = {}; keys.forEach((k) => (old[k] = tiers[k] == null ? null : (tiers[k] as number) - 100));
      s.insert('price_history', { id: _newId(env, 'prc'), product_id: id, berlaku_mulai: shift(-120), berlaku_sampai: shift(-31), ...old, catatan: 'Harga awal', ...st });
      s.insert('price_history', { id: _newId(env, 'prc'), product_id: id, berlaku_mulai: shift(-30), berlaku_sampai: shift(13), ...tiers, catatan: 'Kenaikan kertas', ...st });
      const nxt: Record<string, number | null> = {}; keys.forEach((k) => (nxt[k] = tiers[k] == null ? null : (tiers[k] as number) + 200));
      s.insert('price_history', { id: _newId(env, 'prc'), product_id: id, berlaku_mulai: shift(14), berlaku_sampai: '', ...nxt, catatan: 'Kenaikan terjadwal', ...st });
    } else {
      s.insert('price_history', { id: _newId(env, 'prc'), product_id: id, berlaku_mulai: shift(-60), berlaku_sampai: '', ...tiers, catatan: 'Harga awal', ...st });
    }
  });
  const custs: [string, string, string, string][] = [
    ['1001', 'Umum (walk-in)', '-', 'enduser'], ['1002', 'Percetakan Cahaya Ilmu', '0812-0000-1102', 'reseller'],
    ['1003', 'Rumah Desain Nusa', '0813-0000-2203', 'reseller'], ['1004', 'Sablon Kencana', '0852-0000-3304', 'reseller'],
    ['1005', 'Toko Sinar Abadi', '0821-0000-4405', 'enduser'], ['1006', 'SDIT Al Hikmah', '0811-0000-5506', 'enduser'],
    ['1007', 'Grafika Mandala', '0857-0000-6607', 'reseller'], ['1008', 'Kedai Kopi Senja', '0896-0000-7708', 'enduser'],
  ];
  custs.forEach(([kode, nama, telp, tipe]) => s.insert('customers', { id: _newId(env, 'cus'), kode, nama, telp, tipe, alamat: '', catatan: '', aktif: true, ...st }));
  [['Toko Kertas Sejahtera', 'Kertas'], ['Mitra Stiker Utama', 'Stiker'], ['Sumber Film DTF', 'Film DTF'], ['Plastik Makmur', 'Plastik, laminating']].forEach(([n, b]) =>
    s.insert('suppliers', { id: _newId(env, 'sup'), nama: n, telp: '', bahan: b, aktif: true, ...st }));
  // contoh perangkat menunggu persetujuan
  s.insert('devices', { id: _newId(env, 'dev'), kode_pc: '', nama: 'Perangkat baru (cs)', jenis: 'web', device_hash: 'contoh', status: 'menunggu', printer_koneksi: '', printer_alamat: '', lebar_kertas: '', laci_otomatis: false, disetujui_oleh: '', last_seen: now, ...st });
  seedOrders(s, env);
}

/** Contoh transaksi 40 hari terakhir supaya Order, Piutang, dan Dashboard terisi. */
function seedOrders(s: Store, env: Env) {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const today = env.today();
  const shift = (n: number) => { const [y, m, d] = today.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
  const products = s.all('products').filter((p) => p.jenis_harga !== 'manual');
  const prices = s.all('price_history');
  const customers = s.all('customers');
  const methods = s.all('payment_methods');
  const tunai = methods.find((m) => m.nama === 'Tunai')!;
  const cs = s.all('users').filter((u) => u.role === 'cs' || u.role === 'admin');
  const kasir = s.all('users').find((u) => u.role === 'kasir')!;
  const counters: Record<string, number> = {};
  const kets = ['brosur', 'kartu nama', 'stiker label', 'cover buku', 'sertifikat', 'undangan', 'menu', 'id card', 'nota', 'poster'];
  const qtys = [1, 2, 5, 10, 20, 30, 50, 100, 150, 300];
  for (let off = -40; off <= 0; off++) {
    const tanggal = shift(off);
    const n = off === 0 ? 5 : 3 + Math.floor(rnd() * 6);
    for (let k = 0; k < n; k++) {
      const kode = rnd() < 0.6 ? 'K1' : 'K2';
      const key = counterKey(kode, tanggal);
      const no = (counters[key] = (counters[key] || 0) + 1);
      const id = 'ord_' + env.uuid().replace(/-/g, '').slice(0, 20);
      const cust = pick(customers);
      const tipe = cust.tipe === 'reseller' ? 'reseller' : 'enduser';
      const jam = `${String(8 + Math.floor((k / n) * 11)).padStart(2, '0')}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}:00`;
      const created = new Date(`${tanggal}T${jam}+07:00`).toISOString();
      const items: Record<string, unknown>[] = [];
      const ni = 1 + Math.floor(rnd() * 3);
      for (let i = 0; i < ni; i++) {
        const prod = pick(products);
        const jenis = String(prod.jenis_harga);
        const qty = jenis === 'tetap' ? 1 + Math.floor(rnd() * 4) : pick(qtys);
        const sisi = jenis === 'matriks' && rnd() < 0.3 ? 2 : 1;
        const ukuran = Math.floor(rnd() * 4);
        const prow = hargaBerlaku(prices.filter((x) => x.product_id === prod.id) as any, tanggal) as any;
        const r = hitungHarga({ jenis: jenis as any, harga: prow, tipe, qty, sisi: sisi as 1 | 2, ukuran, minQtyBanyak: 26 });
        if (r.harga == null) continue;
        const status = off < -2 ? 'selesai' : pick(['antrian', 'proses', 'selesai']);
        items.push({ id: `${id}-i${i + 1}`, order_id: id, product_id: prod.id, nama_produk: prod.nama, keterangan: pick(kets), qty, sisi, ukuran_cutting: jenis === 'cutting' ? ukuran : 0,
          klik: jenis === 'matriks' ? qty * sisi : qty, tier: r.tier, harga_satuan: r.harga, harga_beli: null, harga_manual: false, subtotal: r.harga * qty, mesin_id: prod.mesin_id,
          status_produksi: status, operator_id: '', selesai_at: '', price_version_id: prow?.id || '', created_at: created, created_by: 'seed', updated_at: created, updated_by: 'seed' });
      }
      if (!items.length) continue;
      const total = items.reduce((a, i) => a + Number(i.subtotal), 0);
      const pays: Record<string, unknown>[] = [];
      const r = rnd();
      const met = () => (rnd() < 0.55 ? tunai : pick(methods));
      if (r < 0.6) pays.push({ nominal: total, tanggal, method: met() });
      else if (r < 0.82) {
        const dp = Math.max(1000, Math.round(total / 2 / 1000) * 1000);
        pays.push({ nominal: Math.min(dp, total), tanggal, method: met() });
        if (off < -3 && rnd() < 0.7) pays.push({ nominal: total - Math.min(dp, total), tanggal: shift(Math.min(0, off + 1 + Math.floor(rnd() * 5))), method: met() });
      } else if (off < -5 && rnd() < 0.5) pays.push({ nominal: total, tanggal: shift(Math.min(0, off + 2 + Math.floor(rnd() * 7))), method: met() });
      const terbayar = pays.reduce((a, x) => a + Number(x.nominal), 0);
      const sisa = total - terbayar;
      const diambil = sisa <= 0 && off < -2 && rnd() < 0.9; // hanya nota yang semua itemnya sudah selesai
      s.insert('orders', { id, nomor: formatNota('FT', kode, tanggal, no), tanggal, kode_pc: kode, no_urut: no, customer_id: cust.id, cs_id: pick(cs).id, total, terbayar, sisa,
        status_bayar: sisa <= 0 ? 'lunas' : terbayar > 0 ? 'dp' : 'belum', status_ambil: diambil ? 'diambil' : 'belum', tgl_ambil: diambil ? created : '', batal: false, alasan_batal: '',
        dibuat_offline: false, catatan: '', created_at: created, created_by: 'seed', updated_at: created, updated_by: 'seed' });
      items.forEach((it) => s.insert('order_items', it));
      pays.forEach((x, i) => s.insert('payments', { id: `${id}-p${i + 1}`, order_id: id, tanggal: x.tanggal, nominal: x.nominal, method_id: (x.method as any).id, kasir_id: kasir.id,
        catatan: i === 0 ? 'Bayar saat order' : 'Pelunasan', created_at: created, created_by: 'seed', updated_at: created, updated_by: 'seed' }));
    }
  }
  Object.entries(counters).forEach(([key, value]) => s.insert('counters', { key, value }));

  // ---- counter mesin 14 hari (hari ini belum diisi) ----
  const ordDate = Object.fromEntries(s.all('orders').map((o) => [o.id, o.tanggal]));
  const klik: Record<string, number> = {};
  s.all('order_items').forEach((i) => { const k = `${ordDate[String(i.order_id)]}|${i.mesin_id}`; klik[k] = (klik[k] || 0) + Number(i.klik || 0); });
  const opr = s.all('users').find((u) => u.role === 'operator')!;
  const now = env.now().toISOString();
  s.all('machines').filter((m) => m.pakai_counter && m.nama !== 'Dopo').forEach((m, mi) => {
    let c = mi === 0 ? 1482300 : 638900;
    for (let off = -14; off <= -1; off++) {
      const t = shift(off);
      const fo = klik[`${t}|${m.id}`] || 0;
      if (!fo && rnd() < 0.5) continue;
      const rt = Math.floor(rnd() * 6), ro = Math.floor(rnd() * 4), rf = Math.floor(rnd() * 3);
      const batal = rnd() < 0.2 ? Math.floor(rnd() * 4) : 0;
      const drift = rnd() < 0.25 ? Math.floor(rnd() * 12) - 4 : 0; // selisih kecil sesekali
      const pakai = Math.max(0, fo - batal + rt + ro + rf + drift);
      s.insert('machine_counters', { id: 'cnt_' + env.uuid().replace(/-/g, '').slice(0, 12), tanggal: t, mesin_id: m.id, counter_awal: c, counter_akhir: c + pakai,
        reject_trouble: rt, reject_operator: ro, reject_fo: rf, batal, keterangan: drift ? 'kalibrasi warna' : '', created_at: now, created_by: opr.id, updated_at: now, updated_by: opr.id });
      c += pakai + (rnd() < 0.2 ? 3 : 0);
    }
  });

  // ---- kas kecil ----
  const kas = s.all('users').find((u) => u.role === 'kasir')!;
  const pc = (t: string, item: string, masuk: number, keluar: number) => s.insert('petty_cash', { id: 'kk_' + env.uuid().replace(/-/g, '').slice(0, 12), tanggal: t, item, masuk, keluar, keterangan: '', deleted: false,
    created_at: `${t}T09:00:00.000Z`, created_by: kas.id, updated_at: now, updated_by: kas.id });
  pc(shift(-20), 'Saldo awal kas kecil', 500000, 0);
  const out = [['Galon & gas', 45000], ['Parkir & bensin kurir', 30000], ['Lem & isolasi', 27000], ['Konsumsi lembur', 60000], ['Plastik kemasan', 35000], ['Fotokopi dokumen', 12000]] as const;
  for (let off = -19; off <= 0; off++) {
    if (rnd() < 0.45) { const [i, n] = pick(out as unknown as [string, number][]); pc(shift(off), i, 0, n); }
    if (off === -8) pc(shift(off), 'Isi ulang dari owner', 300000, 0);
  }
  seedFinance(s, env, rnd, pick, shift);
}

/**
 * Contoh keuangan & stok (v1.1): bahan baku + resep, pembelian harian (lunas/tempo), pemakaian bahan dari item yang selesai,
 * stok opname, tagihan klik mesin, biaya operasional, jurnal saldo awal, dan target omzet bulan ini.
 * Diproses urut per hari supaya harga rata-rata dan saldo kartu stok masuk akal.
 */
function seedFinance(s: Store, env: Env, rnd: () => number, pick: <T>(a: T[]) => T, shift: (n: number) => string) {
  const now = env.now().toISOString();
  const keu = s.all('users').find((u) => u.role === 'keuangan')!;
  const st = { created_at: now, created_by: keu.id, updated_at: now, updated_by: keu.id };
  const c = { s, env, user: keu, perms: { pembelian: { lihat: true, tambah: true }, stok: { lihat: true, tambah: true, ubah: true } } } as any;
  const cat = (j: string, n?: string) => s.all('expense_categories').find((x) => x.jenis === j && (!n || String(x.nama).startsWith(n)))!.id;
  const sup = (n: string) => String(s.all('suppliers').find((x) => String(x.nama).startsWith(n))!.id);
  const prod = (kode: string) => s.all('products').find((p) => p.kode === kode);
  const tunai = String(s.all('payment_methods').find((m) => m.jenis === 'tunai')!.id);
  const bca = String(s.all('payment_methods').find((m) => String(m.nama).startsWith('BCA'))!.id);
  const id = (p: string) => p + '_' + env.uuid().replace(/-/g, '').slice(0, 12);
  const START = -46;

  // tarif klik mesin (ilustrasi)
  ([['versant', 350], ['Mahogani', 60], ['DTF', 2000]] as [string, number][]).forEach(([n, v]) => {
    const m = s.all('machines').find((x) => x.nama === n); if (m) s.update('machines', 'id', String(m.id), { biaya_klik: v });
  });

  // [kode, nama, satuan stok, kategori, stok min, satuan beli, isi, harga beli, supplier, stok awal (satuan beli)]
  type M = [string, string, string, string, number, string, number, number, string, number];
  const bahan: M[] = [
    ['HVS80', 'HVS 80 gr A3+', 'lembar', 'Kertas', 500, 'rim', 500, 78000, 'Toko Kertas', 4],
    ['AP120', 'Art paper 120 A3+', 'lembar', 'Kertas', 250, 'rim', 500, 330000, 'Toko Kertas', 2],
    ['AP150', 'Art paper 150 A3+', 'lembar', 'Kertas', 250, 'rim', 500, 380000, 'Toko Kertas', 2],
    ['AC210', 'Art carton 210 A3+', 'lembar', 'Kertas', 250, 'rim', 500, 450000, 'Toko Kertas', 2],
    ['AC260', 'Art carton 260 A3+', 'lembar', 'Kertas', 250, 'rim', 500, 520000, 'Toko Kertas', 2],
    ['LIN', 'Linen A3+', 'lembar', 'Kertas', 60, 'pack', 50, 95000, 'Toko Kertas', 3],
    ['SKR', 'Stiker kromo A3+', 'lembar', 'Stiker', 120, 'pack', 100, 95000, 'Mitra Stiker', 4],
    ['SGL', 'Stiker glossy A3+', 'lembar', 'Stiker', 120, 'pack', 100, 260000, 'Mitra Stiker', 3],
    ['LAM', 'Film laminating doff A3+', 'lembar', 'Finishing', 120, 'roll', 400, 285000, 'Plastik', 2],
    ['DTF', 'Film DTF 60 cm', 'meter', 'Film DTF', 10, 'roll', 100, 620000, 'Sumber Film', 1],
  ];
  const mat: Record<string, any> = {};
  bahan.forEach(([kode, nama, satuan, kategori, min]) => {
    mat[kode] = s.insert('materials', { id: id('mat'), kode, nama, satuan, kategori, stok: 0, stok_min: min, harga_rata: 0, harga_terakhir: 0, aktif: true, catatan: '', ...st });
  });
  const spec = Object.fromEntries(bahan.map((b) => [b[0], b]));
  // resep: [kode produk, kode bahan, qty, per]
  const resep: [string, string, number, 'unit' | 'klik'][] = [
    ['1', 'HVS80', 1, 'unit'], ['22', 'HVS80', 1, 'unit'], ['2', 'AP120', 1, 'unit'], ['3', 'AP150', 1, 'unit'], ['5', 'AC210', 1, 'unit'], ['7', 'AC260', 1, 'unit'],
    ['16', 'LIN', 1, 'unit'], ['9', 'SKR', 1, 'unit'], ['12', 'SGL', 1, 'unit'], ['44', 'LAM', 1, 'unit'], ['81', 'DTF', 0.25, 'unit'], ['80', 'DTF', 0.45, 'unit'],
  ];
  resep.forEach(([pk, mk, qty, per]) => { const p = prod(pk); if (p) s.insert('recipes', { id: id('rcp'), product_id: p.id, material_id: mat[mk].id, qty, per, ...st }); });
  const ext = _ext;

  // saldo awal: kas & bank + stok awal
  s.insert('journals', { id: id('jrn'), tanggal: shift(START), keterangan: 'Saldo awal kas & bank', lines: [
    { akun: '1100:' + tunai, debit: 3000000, kredit: 0 }, { akun: '1100:' + bca, debit: 40000000, kredit: 0 }, { akun: '3100', debit: 0, kredit: 43000000 }], deleted: false, ...st });
  bahan.forEach(([kode, , , , , , isi, harga, , awal]) => ext.move(c, mat[kode], awal * isi, 'awal', Math.round((harga * 0.97 / isi) * 100) / 100, shift(START), 'materials', String(mat[kode].id), 'Stok awal'));

  // kebutuhan bahan per hari dari item yang selesai (mode potong stok: saat selesai)
  const orders = Object.fromEntries(s.all('orders').map((o) => [o.id, o]));
  const recipes = s.all('recipes');
  const machines = Object.fromEntries(s.all('machines').map((m) => [m.id, m]));
  const byDay: Record<string, any[]> = {};
  s.all('order_items').forEach((i) => { if (i.status_produksi === 'selesai') (byDay[String(orders[String(i.order_id)]?.tanggal)] ||= []).push(i); });
  const lowAtEnd = new Set(['SGL', 'DTF', 'LIN']); // contoh stok menipis di dashboard

  for (let off = START + 1; off <= 0; off++) {
    const t = shift(off);
    const items = byDay[t] || [];
    const need: Record<string, number> = {};
    items.forEach((i) => recipes.filter((r) => r.product_id === i.product_id).forEach((r) => {
      need[String(r.material_id)] = (need[String(r.material_id)] || 0) + Number(r.qty) * (r.per === 'klik' ? Number(i.klik) : Number(i.qty));
    }));
    // belanja: bila stok setelah dipakai hari ini di bawah batas minimum
    const buy: Record<string, any[]> = {};
    const fresh = () => Object.fromEntries(s.all('materials').map((m) => [m.id, m])) as Record<string, any>;
    Object.values(fresh()).forEach((m: any) => {
      const [kode, , , , min, satBeli, isi, harga, sp] = spec[m.kode];
      const after = Number(m.stok) - (need[m.id] || 0);
      const late = off > -6 && lowAtEnd.has(kode); // sengaja telat belanja
      if (after >= (late ? 0 : 1.3 * min)) return;
      const targetStok = late ? 0.5 * min : 3 * min + (need[m.id] || 0);
      const n = Math.max(1, Math.ceil((targetStok - after) / isi));
      const naik = 1 + (off > -20 && ['AC260', 'AC210', 'SGL'].includes(kode) ? 0.04 : 0); // contoh kenaikan harga supplier
      (buy[sp] ||= []).push({ material_id: m.id, qty_beli: n, satuan_beli: satBeli, isi, harga_beli: Math.round((harga * naik) / 500) * 500 });
    });
    Object.entries(buy).forEach(([sp, its]) => {
      const total = its.reduce((a, x) => a + x.qty_beli * x.harga_beli, 0);
      const tempo = total >= 700000 && rnd() < 0.6;
      ext.handlers['purchase.save'].fn(c, { purchase: { tanggal: t, nota: `INV-${1000 + Math.floor(rnd() * 9000)}`, supplier_id: sup(sp), cara_bayar: tempo ? 'hutang' : 'lunas', method_id: rnd() < 0.5 ? tunai : bca, jatuh_tempo: shift(off + 30), items: its, keterangan: '' } });
    });
    // stok opname 7 hari lalu (pagi, sebelum produksi): beberapa selisih kecil
    if (off === -7) {
      const tOp = shift(-7);
      const opId = id('opn');
      let nilai = 0, n = 0;
      ([['HVS80', -12, 'rusak kena air'], ['AP120', -3, 'salah potong'], ['SKR', 2, 'sisa pack lama'], ['AC260', 0, '']] as [string, number, string][]).forEach(([k, sel, ket]) => {
        const m = s.all('materials').find((x) => x.id === mat[k].id)!;
        const sistem = Number(m.stok);
        if (sel) ext.move(c, m, sel, 'opname', Number(m.harga_rata), tOp, 'opnames', opId, `Opname: ${ket}`);
        s.insert('opname_items', { id: id('opi'), opname_id: opId, material_id: m.id, stok_sistem: sistem, stok_fisik: sistem + sel, selisih: sel, harga: m.harga_rata, nilai: Math.round(sel * Number(m.harga_rata)), keterangan: ket });
        nilai += Math.round(sel * Number(m.harga_rata)); n++;
      });
      s.insert('opnames', { id: opId, tanggal: tOp, keterangan: 'Cek mingguan gudang kertas', jumlah_item: n, nilai_selisih: nilai, ...st, created_at: `${tOp}T10:00:00.000Z` });
    }
    // pemakaian bahan + HPP item yang selesai hari ini
    const mats = fresh();
    items.forEach((i) => ext.deductItem(c, i, t, { mats, recipes, machines, orders }));
  }

  // contoh peringatan: batas minimum bahan ini baru dinaikkan owner, stok sekarang di bawahnya
  lowAtEnd.forEach((k) => {
    const m = s.all('materials').find((x) => x.id === mat[k].id)!;
    s.update('materials', 'id', String(m.id), { stok_min: Math.max(Number(m.stok_min), Math.ceil((Number(m.stok) * 1.4 + 1) / 10) * 10) });
  });

  // cicilan hutang supplier lama
  s.all('supplier_bills').forEach((b) => {
    const age = Math.round((Date.parse(shift(0)) - Date.parse(String(b.tanggal))) / 864e5);
    const paid = age > 20 && rnd() < 0.75 ? Number(b.total) : age > 10 && rnd() < 0.5 ? Math.round(Number(b.total) / 2) : 0;
    if (!paid) return;
    s.update('supplier_bills', 'id', String(b.id), { terbayar: paid, sisa: Number(b.total) - paid });
    s.insert('bill_payments', { id: id('bpy'), bill_id: b.id, tanggal: shift(Math.min(0, -age + 14)), nominal: paid, method_id: bca, keterangan: '', ...st });
  });

  // tagihan klik mesin (vendor versant) dibayar tiap ~30 hari
  const klikItems = s.all('order_items').filter((i) => i.stok_at && Number(i.hpp_klik));
  const tagih = (a: string, b: string) => klikItems.filter((i) => String(i.stok_at).slice(0, 10) >= a && String(i.stok_at).slice(0, 10) <= b).reduce((x, i) => x + Number(i.hpp_klik), 0);
  [[START, -16], [-15, -2]].forEach(([a, b]) => {
    const total = Math.round(tagih(shift(a), shift(b)) / 1000) * 1000;
    if (total > 0) s.insert('expenses', { id: id('exp'), tanggal: shift(b + 1), nota: `KLIK-${shift(b).slice(5, 7)}${shift(b).slice(8, 10)}`, supplier_id: '', kategori_id: cat('klik'), product_id: '', item: `Tagihan klik mesin ${shift(a)} s/d ${shift(b)}`, qty: 1, satuan: 'tagihan', harga: total, total, isi_per_satuan: null, mesin_id: '', cara_bayar: 'lunas', method_id: bca, bill_id: '', keterangan: '', deleted: false, ...st });
  });

  const ops: [number, string, number, string][] = [[-38, 'Listrik', 1250000, 'Listrik'], [-35, 'Internet kantor', 450000, 'Listrik'], [-30, 'Servis roller versant', 750000, 'Perawatan'], [-25, 'Upah lembur', 300000, 'Gaji'],
    [-28, 'Gaji karyawan', 9500000, 'Gaji'], [-27, 'Sewa ruko', 4000000, 'Sewa'], [-8, 'Listrik', 1310000, 'Listrik'], [-5, 'Internet kantor', 450000, 'Listrik'], [-3, 'Toner hitam Mahogani', 980000, 'Perawatan']];
  ops.forEach(([off, item, nn, cc]) => {
    const k = s.all('expense_categories').find((x) => String(x.nama).startsWith(cc))!.id;
    s.insert('expenses', { id: id('exp'), tanggal: shift(off), nota: '', supplier_id: '', kategori_id: k, product_id: '', item, qty: 1, satuan: 'bulan', harga: nn, total: nn, isi_per_satuan: null, mesin_id: '', cara_bayar: 'lunas', method_id: bca, bill_id: '', keterangan: '', deleted: false, ...st });
  });

  // target omzet bulan ini ≈ 10% di atas laju 30 hari terakhir
  const os = s.all('orders').filter((o) => !o.batal && String(o.tanggal) >= shift(-30));
  const perHari = os.reduce((a, o) => a + Number(o.total), 0) / 31;
  const t0 = shift(0);
  const nDays = new Date(Date.UTC(Number(t0.slice(0, 4)), Number(t0.slice(5, 7)), 0)).getUTCDate();
  s.insert('settings', { key: 'target_' + t0.slice(0, 7).replace('-', ''), value: String(Math.round((perHari * nDays * 1.1) / 500000) * 500000) });
  void pick;
}

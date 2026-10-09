import { _hashPasswordForSeed, _newId, seedBase, formatNota, counterKey } from './core';
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
    s.insert('products', { id, kode, nama, kategori: kat, mesin_id: mesin(m), jenis_harga: jenis, satuan: 'lembar', aktif: true, ...st });
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

/** Contoh pembelian bahan (mengisi harga beli), biaya operasional, dan hutang supplier. */
function seedFinance(s: Store, env: Env, rnd: () => number, pick: <T>(a: T[]) => T, shift: (n: number) => string) {
  const now = env.now().toISOString();
  const keu = s.all('users').find((u) => u.role === 'keuangan')!;
  const st = { created_at: now, created_by: keu.id, updated_at: now, updated_by: keu.id };
  const cat = (j: string, n?: string) => s.all('expense_categories').find((c) => c.jenis === j && (!n || String(c.nama).startsWith(n)))!.id;
  const sup = (n: string) => s.all('suppliers').find((x) => String(x.nama).startsWith(n))!.id;
  const prod = (kode: string) => s.all('products').find((p) => p.kode === kode);
  const tunai = s.all('payment_methods').find((m) => m.jenis === 'tunai')!.id;
  const bca = s.all('payment_methods').find((m) => String(m.nama).startsWith('BCA'))!.id;
  const id = (p: string) => p + '_' + env.uuid().replace(/-/g, '').slice(0, 12);
  // [kode produk, barang, satuan, harga per satuan beli, isi lembar per satuan, supplier]
  const bahan: [string, string, string, number, number, string][] = [
    ['7', 'Art carton 260 A3+', 'rim', 520000, 500, 'Toko Kertas'], ['5', 'Art carton 210 A3+', 'rim', 450000, 500, 'Toko Kertas'],
    ['2', 'Art paper 120 A3+', 'rim', 330000, 500, 'Toko Kertas'], ['9', 'Stiker kromo A3+', 'pack', 95000, 100, 'Mitra Stiker'],
    ['12', 'Stiker glossy A3+', 'pack', 260000, 100, 'Mitra Stiker'], ['22', 'HVS 80 A3+', 'rim', 78000, 500, 'Toko Kertas'],
    ['16', 'Linen A3+', 'pack', 85000, 50, 'Toko Kertas'], ['81', 'Film DTF 60cm', 'roll', 620000, 100, 'Sumber Film'],
  ];
  // harga beli awal 60 hari lalu supaya laba kotor nota lama ikut terhitung
  bahan.forEach(([kode, , , harga, isi, sp]) => { const p = prod(kode); if (p) s.insert('cost_history', { id: id('cst'), product_id: p.id, berlaku_mulai: shift(-60), harga_beli: Math.round((harga * 0.97 / isi) * 100) / 100, supplier_id: sup(sp), sumber: 'harga awal', ...st }); });
  for (let off = -40; off <= 0; off++) {
    const t = shift(off);
    if (rnd() < 0.35) {
      const [kode, item, satuan, harga, isi, sp] = pick(bahan);
      const p = prod(kode);
      const qty = 1 + Math.floor(rnd() * 4);
      const hutang = rnd() < 0.35;
      const eid = id('exp');
      let billId = '';
      if (hutang) {
        billId = id('bil');
        const paid = off < -20 && rnd() < 0.7 ? harga * qty : off < -10 && rnd() < 0.5 ? Math.round(harga * qty / 2) : 0;
        s.insert('supplier_bills', { id: billId, tanggal: t, nota: `INV-${100 + Math.floor(rnd() * 900)}`, supplier_id: sup(sp), expense_id: eid, total: harga * qty, terbayar: paid, sisa: harga * qty - paid, jatuh_tempo: shift(off + 30), keterangan: `${item} ${qty} ${satuan}`, ...st });
        if (paid) s.insert('bill_payments', { id: id('bpy'), bill_id: billId, tanggal: shift(Math.min(0, off + 14)), nominal: paid, method_id: bca, keterangan: '', ...st });
      }
      s.insert('expenses', { id: eid, tanggal: t, nota: `NT-${1000 + Math.floor(rnd() * 9000)}`, supplier_id: sup(sp), kategori_id: cat('bahan', 'Bahan baku'), product_id: p?.id || '', item, qty, satuan, harga,
        total: harga * qty, isi_per_satuan: isi, mesin_id: p?.mesin_id || '', cara_bayar: hutang ? 'hutang' : 'lunas', method_id: hutang ? '' : pick([tunai, bca]), bill_id: billId, keterangan: '', deleted: false, ...st });
      if (p) s.insert('cost_history', { id: id('cst'), product_id: p.id, berlaku_mulai: t, harga_beli: Math.round((harga / isi) * 100) / 100, supplier_id: sup(sp), sumber: `pembelian ${eid}`, ...st });
    }
    if (rnd() < 0.15) s.insert('expenses', { id: id('exp'), tanggal: t, nota: '', supplier_id: sup('Plastik'), kategori_id: cat('bahan', 'Bahan finishing'), product_id: '', item: 'Film laminating doff', qty: 1, satuan: 'roll', harga: 285000, total: 285000, isi_per_satuan: null, mesin_id: '', cara_bayar: 'lunas', method_id: tunai, bill_id: '', keterangan: '', deleted: false, ...st });
  }
  const ops: [number, string, number, string][] = [[-38, 'Listrik', 1250000, 'Listrik'], [-35, 'Internet kantor', 450000, 'Listrik'], [-30, 'Servis roller versant', 750000, 'Perawatan'], [-25, 'Upah lembur', 300000, 'Gaji'],
    [-8, 'Listrik', 1310000, 'Listrik'], [-5, 'Internet kantor', 450000, 'Listrik'], [-3, 'Toner hitam Mahogani', 980000, 'Perawatan']];
  ops.forEach(([off, item, n, c]) => {
    const k = s.all('expense_categories').find((x) => String(x.nama).startsWith(c))!.id;
    s.insert('expenses', { id: id('exp'), tanggal: shift(off), nota: '', supplier_id: '', kategori_id: k, product_id: '', item, qty: 1, satuan: 'bulan', harga: n, total: n, isi_per_satuan: null, mesin_id: '', cara_bayar: 'lunas', method_id: bca, bill_id: '', keterangan: '', deleted: false, ...st });
  });
}

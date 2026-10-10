/* Fortuner POS — FILE HASIL BUILD, jangan diedit langsung. Sumber: src/server/*.ts (npm run build:gas) */
"use strict";
var FortunerServer = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __export = (target, all2) => {
    for (var name in all2)
      __defProp(target, name, { get: all2[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/server/gasEntry.ts
  var gasEntry_exports = {};
  __export(gasEntry_exports, {
    backupSekarang: () => backupSekarang,
    doGet: () => doGet,
    doPost: () => doPost,
    onOpen: () => onOpen,
    pasangTriggerBackup: () => pasangTriggerBackup,
    setup: () => setup
  });

  // src/server/sha256.ts
  var K = [
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ];
  function utf8(str2) {
    const out = [];
    for (let i = 0; i < str2.length; i++) {
      let c = str2.charCodeAt(i);
      if (c >= 55296 && c <= 56319 && i + 1 < str2.length) {
        c = 65536 + (c - 55296 << 10) + (str2.charCodeAt(++i) - 56320);
      }
      if (c < 128) out.push(c);
      else if (c < 2048) out.push(192 | c >> 6, 128 | c & 63);
      else if (c < 65536) out.push(224 | c >> 12, 128 | c >> 6 & 63, 128 | c & 63);
      else out.push(240 | c >> 18, 128 | c >> 12 & 63, 128 | c >> 6 & 63, 128 | c & 63);
    }
    return out;
  }
  function sha256(message) {
    const bytes = utf8(message);
    const bitLen = bytes.length * 8;
    bytes.push(128);
    while (bytes.length % 64 !== 56) bytes.push(0);
    const hi = Math.floor(bitLen / 4294967296), lo = bitLen >>> 0;
    bytes.push(hi >>> 24 & 255, hi >>> 16 & 255, hi >>> 8 & 255, hi & 255, lo >>> 24 & 255, lo >>> 16 & 255, lo >>> 8 & 255, lo & 255);
    const H = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
    const W = new Array(64);
    for (let off = 0; off < bytes.length; off += 64) {
      for (let t = 0; t < 16; t++) W[t] = bytes[off + t * 4] << 24 | bytes[off + t * 4 + 1] << 16 | bytes[off + t * 4 + 2] << 8 | bytes[off + t * 4 + 3];
      for (let t = 16; t < 64; t++) {
        const x = W[t - 15], y = W[t - 2];
        const s0 = (x >>> 7 | x << 25) ^ (x >>> 18 | x << 14) ^ x >>> 3;
        const s1 = (y >>> 17 | y << 15) ^ (y >>> 19 | y << 13) ^ y >>> 10;
        W[t] = W[t - 16] + s0 + W[t - 7] + s1 | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) {
        const S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
        const ch = e & f ^ ~e & g;
        const t1 = h + S1 + ch + K[t] + W[t] | 0;
        const S0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10);
        const mj = a & b ^ a & c ^ b & c;
        const t2 = S0 + mj | 0;
        h = g;
        g = f;
        f = e;
        e = d + t1 | 0;
        d = c;
        c = b;
        b = a;
        a = t1 + t2 | 0;
      }
      H[0] = H[0] + a | 0;
      H[1] = H[1] + b | 0;
      H[2] = H[2] + c | 0;
      H[3] = H[3] + d | 0;
      H[4] = H[4] + e | 0;
      H[5] = H[5] + f | 0;
      H[6] = H[6] + g | 0;
      H[7] = H[7] + h | 0;
    }
    return H.map((v) => (v >>> 0).toString(16).padStart(8, "0")).join("");
  }

  // src/lib/modules.ts
  var MODULES = [
    { key: "dashboard", label: "Dashboard", group: "Umum" },
    { key: "fo", label: "Front Office (buat order)", group: "Transaksi" },
    { key: "kasir.harga_manual", label: "Ubah harga di Front Office", group: "Transaksi" },
    { key: "kasir", label: "Kasir (terima pembayaran)", group: "Transaksi" },
    { key: "order", label: "Order", group: "Transaksi" },
    { key: "produksi", label: "Produksi", group: "Transaksi" },
    { key: "piutang", label: "Piutang", group: "Keuangan" },
    { key: "pengeluaran", label: "Pengeluaran", group: "Keuangan" },
    { key: "hutang", label: "Hutang Supplier", group: "Keuangan" },
    { key: "kas", label: "Kas", group: "Keuangan" },
    { key: "mesin", label: "Mesin & Operator", group: "Operasional" },
    { key: "stok", label: "Stok bahan & opname", group: "Operasional" },
    { key: "pembelian", label: "Pembelian bahan", group: "Operasional" },
    { key: "master.produk", label: "Produk & Harga", group: "Master Data" },
    { key: "master.harga_beli", label: "Lihat harga beli", group: "Master Data" },
    { key: "master.konsumen", label: "Konsumen", group: "Master Data" },
    { key: "master.supplier", label: "Supplier", group: "Master Data" },
    { key: "master.mesin", label: "Mesin", group: "Master Data" },
    { key: "master.metode", label: "Metode Bayar", group: "Master Data" },
    { key: "laporan", label: "Laporan", group: "Laporan" },
    { key: "laporan.laba", label: "Laporan laba", group: "Laporan" },
    { key: "pengaturan.user", label: "User", group: "Pengaturan" },
    { key: "pengaturan.role", label: "Hak akses role", group: "Pengaturan" },
    { key: "pengaturan.perangkat", label: "Perangkat", group: "Pengaturan" },
    { key: "pengaturan.umum", label: "Pengaturan umum", group: "Pengaturan" },
    { key: "pengaturan.log", label: "Log aktivitas", group: "Pengaturan" }
  ];
  var all = { lihat: true, tambah: true, ubah: true, hapus: true, ekspor: true };
  var view = { lihat: true };
  function defaultPermissions(role) {
    const p = {};
    MODULES.forEach((m) => p[m.key] = {});
    const set = (keys, v) => keys.forEach((k) => p[k] = { ...v });
    switch (role) {
      case "owner":
        set(MODULES.map((m) => m.key), all);
        break;
      case "admin":
        set(MODULES.map((m) => m.key).filter((k) => k !== "laporan.laba"), all);
        break;
      case "cs":
        set(["dashboard", "order", "produksi", "master.produk"], view);
        set(["fo"], { lihat: true, tambah: true });
        set(["master.konsumen"], { lihat: true, tambah: true, ubah: true });
        break;
      case "kasir":
        set(["dashboard", "produksi", "master.produk", "master.konsumen"], view);
        set(["kasir", "order", "piutang", "kas"], { lihat: true, tambah: true, ubah: true, ekspor: true });
        break;
      case "operator":
        set(["dashboard", "order"], view);
        set(["produksi", "mesin"], { lihat: true, tambah: true, ubah: true });
        set(["stok"], { lihat: true, tambah: true });
        break;
      case "keuangan":
        set(["dashboard", "order", "piutang", "master.produk", "master.harga_beli", "master.supplier"], { lihat: true, ekspor: true });
        set(["pengeluaran", "hutang", "kas", "laporan", "pembelian"], all);
        set(["stok"], { lihat: true, tambah: true, ubah: true, ekspor: true });
        break;
    }
    return p;
  }

  // src/lib/pricing.ts
  var TIERS = [
    { key: "rb", label: "Reseller \xB7 Banyak" },
    { key: "rb_bb", label: "Reseller \xB7 Banyak BB" },
    { key: "rs", label: "Reseller \xB7 Sedikit" },
    { key: "rs_bb", label: "Reseller \xB7 Sedikit BB" },
    { key: "eb", label: "End user \xB7 Banyak" },
    { key: "eb_bb", label: "End user \xB7 Banyak BB" },
    { key: "es", label: "End user \xB7 Sedikit" },
    { key: "es_bb", label: "End user \xB7 Sedikit BB" }
  ];
  var CUT_SIZES = ["di atas 5 cm", "3,1 \u2013 5 cm", "2 \u2013 3 cm", "di bawah 2 cm"];
  var CUT_KEYS = ["rb", "rb_bb", "rs", "rs_bb"];
  function hitungHarga(i) {
    var _a, _b;
    const h = i.harga;
    if (i.jenis === "manual") return { harga: null, tier: null, label: "Harga manual" };
    if (!h) return { harga: null, tier: null, label: "Belum ada harga", peringatan: "Produk ini belum punya harga yang berlaku." };
    if (i.jenis === "tetap") return { harga: h.rb, tier: "rb", label: "Harga tetap" };
    if (i.jenis === "cutting") {
      const k = CUT_KEYS[(_a = i.ukuran) != null ? _a : 0];
      return { harga: h[k], tier: k, label: `Cutting \xB7 ${CUT_SIZES[(_b = i.ukuran) != null ? _b : 0]}` };
    }
    const banyak = i.qty >= i.minQtyBanyak;
    let fallback = false;
    let base = `${i.tipe === "enduser" ? "e" : "r"}${banyak ? "b" : "s"}`;
    if (i.tipe === "enduser" && h[base] == null) {
      base = `r${banyak ? "b" : "s"}`;
      fallback = true;
    }
    let tier = base;
    if (i.sisi === 2 && h[base + "_bb"] != null) tier = base + "_bb";
    const label = `${base.startsWith("e") ? "End user" : "Reseller"} \xB7 ${banyak ? `Banyak (\u2265${i.minQtyBanyak})` : "Sedikit"}${tier.endsWith("_bb") ? " \xB7 BB" : ""}`;
    return {
      harga: h[tier],
      tier,
      label,
      peringatan: fallback ? "Harga end user kosong, memakai harga reseller." : i.sisi === 2 && !tier.endsWith("_bb") ? "Tidak ada harga BB, memakai harga 1 sisi." : void 0
    };
  }
  function hargaBerlaku(rows, tanggal) {
    const ok = rows.filter((r) => r.berlaku_mulai <= tanggal && (!r.berlaku_sampai || r.berlaku_sampai >= tanggal));
    ok.sort((a, b) => b.berlaku_mulai.localeCompare(a.berlaku_mulai));
    return ok[0] || null;
  }

  // src/server/ext.ts
  var num = (v) => Number(v) || 0;
  var r2 = (n) => Math.round(n * 100) / 100;
  var debitNormal = (t) => t === "aset" || t === "hpp" || t === "beban";
  var BASE_ACCOUNTS = [
    { kode: "1110", nama: "Kas kecil", tipe: "aset" },
    { kode: "1200", nama: "Piutang usaha", tipe: "aset" },
    { kode: "1300", nama: "Persediaan bahan", tipe: "aset" },
    { kode: "1400", nama: "Aset tetap & peralatan", tipe: "aset" },
    { kode: "2100", nama: "Hutang usaha (supplier)", tipe: "kewajiban" },
    { kode: "2110", nama: "Hutang biaya klik mesin", tipe: "kewajiban" },
    { kode: "3100", nama: "Modal / saldo awal", tipe: "modal" },
    { kode: "3200", nama: "Prive (ambil pribadi)", tipe: "modal" },
    { kode: "4100", nama: "Pendapatan penjualan", tipe: "pendapatan" },
    { kode: "4900", nama: "Pendapatan lain", tipe: "pendapatan" },
    { kode: "5100", nama: "HPP bahan baku", tipe: "hpp" },
    { kode: "5110", nama: "HPP biaya klik mesin", tipe: "hpp" },
    { kode: "5120", nama: "Bahan di luar stok", tipe: "hpp" },
    { kode: "5130", nama: "Selisih persediaan (opname)", tipe: "hpp" },
    { kode: "6900", nama: "Beban kas kecil", tipe: "beban" },
    { kode: "6910", nama: "Selisih kas", tipe: "beban" }
  ];
  function makeExt(h) {
    const { fail: fail2, str: str2, bool: bool2, newId: newId2, iso: iso2, addDays: addDays2, isYmd: isYmd2, settingsMap: settingsMap2, need: need2, stamp: stamp2, log: log2 } = h;
    const can = (c, key, op = "lihat") => {
      var _a, _b;
      return !!((_b = (_a = c.perms) == null ? void 0 : _a[key]) == null ? void 0 : _b[op]);
    };
    const needAny = (c, keys) => {
      if (!keys.some(([k, o]) => can(c, k, o))) fail2("FORBIDDEN", "Anda tidak punya akses untuk tindakan ini.");
    };
    const today = (c) => c.env.today();
    const seeCost = (c) => can(c, "pembelian") || can(c, "laporan.laba") || can(c, "master.harga_beli");
    const hideCost = (c, r, keys) => {
      if (seeCost(c)) return r;
      const o = { ...r };
      keys.forEach((k) => {
        o[k] = null;
      });
      return o;
    };
    const nextMonth = (ym) => {
      let y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) + 1;
      if (m > 12) {
        m = 1;
        y++;
      }
      return `${y}-${String(m).padStart(2, "0")}`;
    };
    const byId = (rows) => Object.fromEntries(rows.map((r) => [str2(r.id), r]));
    function move(c, mat, qty, jenis, harga, tanggal, refTabel, refId, ket) {
      const stokLama = num(mat.stok);
      const stok = r2(stokLama + qty);
      const patch = { stok, ...stamp2(c, false) };
      if (jenis === "beli" || jenis === "awal") {
        patch.harga_rata = stokLama > 0 && num(mat.harga_rata) > 0 ? r2((stokLama * num(mat.harga_rata) + qty * harga) / stok) : r2(harga);
        patch.harga_terakhir = r2(harga);
      } else if (jenis === "batal_beli" && stok > 0) {
        const v = (stokLama * num(mat.harga_rata) + qty * harga) / stok;
        if (v > 0) patch.harga_rata = r2(v);
      }
      c.s.update("materials", "id", str2(mat.id), patch);
      Object.assign(mat, patch);
      return c.s.insert("stock_moves", {
        id: newId2(c.env, "stm"),
        tanggal,
        material_id: str2(mat.id),
        jenis,
        qty: r2(qty),
        harga: r2(harga),
        nilai: Math.round(qty * harga),
        saldo: stok,
        ref_tabel: refTabel,
        ref_id: refId,
        keterangan: ket.slice(0, 200),
        ...stamp2(c, true)
      });
    }
    const stokMode = (c) => settingsMap2(c.s).stok_kurang_saat === "bayar" ? "bayar" : "selesai";
    function deductItem(c, item, tanggal, cache) {
      var _a;
      if (str2(item.stok_at) || str2(item.status_produksi) === "batal") return false;
      const mats = (cache == null ? void 0 : cache.mats) || byId(c.s.all("materials"));
      const recipes = ((cache == null ? void 0 : cache.recipes) || c.s.all("recipes")).filter((r) => r.product_id === item.product_id);
      const machines = (cache == null ? void 0 : cache.machines) || byId(c.s.all("machines"));
      const o = ((cache == null ? void 0 : cache.orders) || byId(c.s.all("orders")))[str2(item.order_id)];
      let hppB = 0;
      recipes.forEach((r) => {
        const m = mats[str2(r.material_id)];
        if (!m) return;
        const q = r2(num(r.qty) * (r.per === "klik" ? num(item.klik) : num(item.qty)));
        if (!(q > 0)) return;
        const hr = num(m.harga_rata);
        move(c, m, -q, "pakai", hr, tanggal, "order_items", str2(item.id), `${str2(o == null ? void 0 : o.nomor)} ${str2(item.nama_produk)}`);
        hppB += q * hr;
      });
      const hppK = num(item.klik) * num((_a = machines[str2(item.mesin_id)]) == null ? void 0 : _a.biaya_klik);
      const patch = { hpp_bahan: Math.round(hppB), hpp_klik: Math.round(hppK), stok_at: tanggal + "T" + iso2(c.env).slice(11) };
      c.s.update("order_items", "id", str2(item.id), patch);
      Object.assign(item, patch);
      return true;
    }
    function deductOrder(c, orderId, tanggal = today(c)) {
      c.s.all("order_items").filter((i) => i.order_id === orderId).forEach((i) => deductItem(c, i, tanggal));
    }
    const hooks = {
      onProductionDone(c, itemIds) {
        if (stokMode(c) !== "selesai") return;
        c.s.all("order_items").filter((i) => itemIds.includes(str2(i.id))).forEach((i) => deductItem(c, i, today(c)));
      },
      onPayment(c, orderId) {
        if (stokMode(c) === "bayar") deductOrder(c, orderId);
      },
      onPickup(c, orderId) {
        deductOrder(c, orderId);
      }
    };
    function productCost(c, productId, sisi, cache) {
      var _a;
      const p = ((cache == null ? void 0 : cache.products) || byId(c.s.all("products")))[productId];
      const mats = (cache == null ? void 0 : cache.mats) || byId(c.s.all("materials"));
      const machines = (cache == null ? void 0 : cache.machines) || byId(c.s.all("machines"));
      const recipes = ((cache == null ? void 0 : cache.recipes) || c.s.all("recipes")).filter((r) => r.product_id === productId);
      const klik = (p == null ? void 0 : p.jenis_harga) === "matriks" ? sisi : 1;
      let bahan = 0;
      const rincian = recipes.map((r) => {
        const m = mats[str2(r.material_id)];
        const q = num(r.qty) * (r.per === "klik" ? klik : 1);
        const nilai = q * num(m == null ? void 0 : m.harga_rata);
        bahan += nilai;
        return { material_id: str2(r.material_id), nama: str2(m == null ? void 0 : m.nama), satuan: str2(m == null ? void 0 : m.satuan), qty: r2(q), harga: num(m == null ? void 0 : m.harga_rata), nilai: r2(nilai) };
      });
      const tarif = num((_a = machines[str2(p == null ? void 0 : p.mesin_id)]) == null ? void 0 : _a.biaya_klik);
      return { bahan: r2(bahan), klik: r2(klik * tarif), total: r2(bahan + klik * tarif), klik_per_unit: klik, tarif_klik: tarif, resep: recipes.length > 0, rincian };
    }
    function buildJournal(c) {
      const accounts = Object.fromEntries(BASE_ACCOUNTS.map((a) => [a.kode, a]));
      const methods = c.s.all("payment_methods");
      methods.forEach((m) => {
        accounts["1100:" + m.id] = { kode: "1100:" + str2(m.id), nama: `Kas & bank: ${str2(m.nama)}`, tipe: "aset" };
      });
      const kas = (methodId) => {
        const k = "1100:" + str2(methodId);
        if (!accounts[k]) accounts[k] = { kode: k, nama: "Kas & bank: (metode tidak dikenal)", tipe: "aset" };
        return k;
      };
      const tunai = methods.find((m) => m.jenis === "tunai");
      const cats = byId(c.s.all("expense_categories"));
      c.s.all("expense_categories").forEach((x) => {
        if (!["bahan", "aset", "klik"].includes(str2(x.jenis))) accounts["6100:" + x.id] = { kode: "6100:" + str2(x.id), nama: `Beban ${str2(x.nama)}`, tipe: "beban" };
      });
      const E = [];
      const add = (tanggal, ref, sumber, keterangan, lines) => {
        const ls = lines.filter((l) => Math.round(l.d) || Math.round(l.k)).map((l) => ({ akun: l.akun, d: Math.round(l.d), k: Math.round(l.k) }));
        if (ls.length) E.push({ tanggal: str2(tanggal).slice(0, 10), ref, sumber, keterangan, lines: ls });
      };
      const orders = c.s.all("orders");
      const oById = byId(orders);
      orders.forEach((o) => {
        if (!bool2(o.batal) && num(o.total)) add(str2(o.tanggal), str2(o.nomor), "nota", `Penjualan ${str2(o.nomor)}`, [{ akun: "1200", d: num(o.total), k: 0 }, { akun: "4100", d: 0, k: num(o.total) }]);
      });
      c.s.all("payments").forEach((p) => {
        var _a, _b;
        return add(str2(p.tanggal), str2((_a = oById[str2(p.order_id)]) == null ? void 0 : _a.nomor), "pembayaran", `Pembayaran ${str2((_b = oById[str2(p.order_id)]) == null ? void 0 : _b.nomor)}`, [{ akun: kas(p.method_id), d: num(p.nominal), k: 0 }, { akun: "1200", d: 0, k: num(p.nominal) }]);
      });
      const mats = byId(c.s.all("materials"));
      c.s.all("stock_moves").forEach((m) => {
        var _a;
        const v = Math.abs(num(m.nilai));
        const nm = str2((_a = mats[str2(m.material_id)]) == null ? void 0 : _a.nama);
        if (m.jenis === "pakai") add(str2(m.tanggal), str2(m.keterangan).split(" ")[0], "stok", `Pemakaian ${nm}`, [{ akun: "5100", d: v, k: 0 }, { akun: "1300", d: 0, k: v }]);
        else if (m.jenis === "opname") add(str2(m.tanggal), "OPNAME", "stok", `Selisih opname ${nm}`, num(m.qty) < 0 ? [{ akun: "5130", d: v, k: 0 }, { akun: "1300", d: 0, k: v }] : [{ akun: "1300", d: v, k: 0 }, { akun: "5130", d: 0, k: v }]);
        else if (m.jenis === "awal") add(str2(m.tanggal), "STOK AWAL", "stok", `Stok awal ${nm}`, [{ akun: "1300", d: v, k: 0 }, { akun: "3100", d: 0, k: v }]);
      });
      c.s.all("order_items").forEach((i) => {
        var _a;
        if (num(i.hpp_klik) && str2(i.stok_at)) add(str2(i.stok_at), str2((_a = oById[str2(i.order_id)]) == null ? void 0 : _a.nomor), "stok", `Biaya klik ${str2(i.nama_produk)}`, [{ akun: "5110", d: num(i.hpp_klik), k: 0 }, { akun: "2110", d: 0, k: num(i.hpp_klik) }]);
      });
      c.s.all("purchases").forEach((p) => {
        if (bool2(p.deleted)) return;
        add(str2(p.tanggal), str2(p.nota) || "PEMBELIAN", "pembelian", `Pembelian bahan ${str2(p.nota)}`, [{ akun: "1300", d: num(p.total), k: 0 }, p.cara_bayar === "hutang" ? { akun: "2100", d: 0, k: num(p.total) } : { akun: kas(p.method_id), d: 0, k: num(p.total) }]);
      });
      c.s.all("expenses").forEach((x) => {
        var _a;
        if (bool2(x.deleted) || str2(x.purchase_id)) return;
        const j = str2((_a = cats[str2(x.kategori_id)]) == null ? void 0 : _a.jenis);
        const dr = j === "bahan" ? "5120" : j === "aset" ? "1400" : j === "klik" ? "2110" : accounts["6100:" + x.kategori_id] ? "6100:" + str2(x.kategori_id) : "6100:lain";
        if (!accounts[dr]) accounts[dr] = { kode: dr, nama: "Beban lain-lain", tipe: "beban" };
        add(str2(x.tanggal), str2(x.nota) || "PENGELUARAN", "pengeluaran", str2(x.item), [{ akun: dr, d: num(x.total), k: 0 }, x.cara_bayar === "hutang" ? { akun: "2100", d: 0, k: num(x.total) } : { akun: kas(x.method_id), d: 0, k: num(x.total) }]);
      });
      c.s.all("bill_payments").forEach((b) => add(str2(b.tanggal), "BAYAR HUTANG", "hutang", str2(b.keterangan) || "Pembayaran hutang supplier", [{ akun: "2100", d: num(b.nominal), k: 0 }, { akun: kas(b.method_id), d: 0, k: num(b.nominal) }]));
      c.s.all("petty_cash").forEach((p) => {
        if (bool2(p.deleted)) return;
        if (num(p.masuk)) add(str2(p.tanggal), "KAS KECIL", "kas kecil", str2(p.item) || "Isi kas kecil", [{ akun: "1110", d: num(p.masuk), k: 0 }, { akun: tunai ? kas(tunai.id) : "3100", d: 0, k: num(p.masuk) }]);
        if (num(p.keluar)) add(str2(p.tanggal), "KAS KECIL", "kas kecil", str2(p.item), [{ akun: "6900", d: num(p.keluar), k: 0 }, { akun: "1110", d: 0, k: num(p.keluar) }]);
      });
      c.s.all("cash_deposits").forEach((d) => {
        const sel = num(d.selisih);
        if (!sel) return;
        add(str2(d.tanggal), "TUTUP KAS", "kas", str2(d.keterangan) || "Selisih tutup kas", sel < 0 ? [{ akun: "6910", d: -sel, k: 0 }, { akun: kas(d.method_id), d: 0, k: -sel }] : [{ akun: kas(d.method_id), d: sel, k: 0 }, { akun: "6910", d: 0, k: sel }]);
      });
      c.s.all("journals").forEach((j) => {
        if (bool2(j.deleted)) return;
        const lines = Array.isArray(j.lines) ? j.lines : [];
        lines.forEach((l) => {
          if (!accounts[l.akun]) accounts[l.akun] = { kode: l.akun, nama: l.akun, tipe: "beban" };
        });
        add(str2(j.tanggal), "JURNAL", "manual", str2(j.keterangan), lines.map((l) => ({ akun: str2(l.akun), d: num(l.debit), k: num(l.kredit) })));
      });
      E.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
      return { accounts, entries: E };
    }
    function trial(c, from, to) {
      const { accounts, entries } = buildJournal(c);
      const agg = {};
      entries.forEach((e) => {
        if (e.tanggal > to) return;
        e.lines.forEach((l) => {
          var _a;
          const a = agg[_a = l.akun] || (agg[_a] = { awal: 0, d: 0, k: 0 });
          if (e.tanggal < from) a.awal += l.d - l.k;
          else {
            a.d += l.d;
            a.k += l.k;
          }
        });
      });
      const rows = Object.entries(agg).map(([kode, a]) => {
        const acc = accounts[kode] || { kode, nama: kode, tipe: "beban" };
        const sign = debitNormal(acc.tipe) ? 1 : -1;
        return { kode, nama: acc.nama, tipe: acc.tipe, saldo_awal: sign * a.awal, debit: a.d, kredit: a.k, saldo_akhir: sign * (a.awal + a.d - a.k) };
      }).sort((x, y) => x.kode.localeCompare(y.kode));
      return { rows, total_debit: rows.reduce((s, r) => s + r.debit, 0), total_kredit: rows.reduce((s, r) => s + r.kredit, 0) };
    }
    function pnl(c, from, to) {
      const { accounts, entries } = buildJournal(c);
      const sum = {};
      entries.forEach((e) => {
        if (e.tanggal >= from && e.tanggal <= to) e.lines.forEach((l) => {
          sum[l.akun] = (sum[l.akun] || 0) + l.d - l.k;
        });
      });
      const val = (k) => {
        const a = accounts[k];
        return a && !debitNormal(a.tipe) ? -(sum[k] || 0) : sum[k] || 0;
      };
      const pendapatan = val("4100");
      const lain = val("4900");
      const hpp = [
        { kode: "5100", nama: "Bahan baku (kertas, stiker, film)", nilai: val("5100") },
        { kode: "5110", nama: "Biaya klik mesin", nilai: val("5110") },
        { kode: "5120", nama: "Bahan di luar stok", nilai: val("5120") },
        { kode: "5130", nama: "Selisih persediaan (opname)", nilai: val("5130") }
      ];
      const totalHpp = hpp.reduce((s, x) => s + x.nilai, 0);
      const beban = Object.keys(accounts).filter((k) => accounts[k].tipe === "beban" && val(k)).map((k) => ({ kode: k, nama: accounts[k].nama, nilai: val(k) })).sort((a, b) => b.nilai - a.nilai);
      const totalBeban = beban.reduce((s, x) => s + x.nilai, 0);
      return { pendapatan, pendapatan_lain: lain, hpp, total_hpp: totalHpp, laba_kotor: pendapatan + lain - totalHpp, beban, total_beban: totalBeban, laba_bersih: pendapatan + lain - totalHpp - totalBeban };
    }
    const handlers2 = {
      "stock.meta": {
        auth: true,
        fn: (c) => {
          needAny(c, [["stok", "lihat"], ["pembelian", "lihat"], ["master.produk", "lihat"]]);
          const mats = c.s.all("materials");
          return {
            materials: mats.map((m) => hideCost(c, { ...m, nilai: Math.round(num(m.stok) * num(m.harga_rata)), status: !bool2(m.aktif) ? "nonaktif" : num(m.stok) <= 0 ? "habis" : num(m.stok) <= num(m.stok_min) ? "menipis" : "aman" }, ["harga_rata", "harga_terakhir", "nilai"])),
            lihat_harga: seeCost(c),
            suppliers: c.s.all("suppliers").filter((x) => bool2(x.aktif)).map((x) => ({ id: x.id, nama: x.nama })),
            payment_methods: c.s.all("payment_methods").filter((x) => bool2(x.aktif)).map((x) => ({ id: x.id, nama: x.nama, jenis: x.jenis })),
            mode: stokMode(c)
          };
        }
      },
      "material.save": {
        auth: true,
        fn: (c, p) => {
          const m = p.material || {};
          need2(c, "stok", "ubah");
          const nama = str2(m.nama), satuan = str2(m.satuan) || "lembar", kode = str2(m.kode).toUpperCase();
          if (!nama) fail2("VALIDATION", "Nama bahan wajib diisi.");
          return c.s.withLock(() => {
            const all2 = c.s.all("materials");
            if (kode && all2.some((x) => str2(x.kode).toUpperCase() === kode && x.id !== m.id)) fail2("VALIDATION", `Kode ${kode} sudah dipakai.`);
            if (all2.some((x) => str2(x.nama).toLowerCase() === nama.toLowerCase() && x.id !== m.id)) fail2("VALIDATION", `Bahan "${nama}" sudah ada.`);
            const data = { kode, nama, satuan, kategori: str2(m.kategori), stok_min: Math.max(0, num(m.stok_min)), aktif: m.aktif !== false, catatan: str2(m.catatan).slice(0, 200) };
            if (m.id) {
              const cur = all2.find((x) => x.id === m.id) || fail2("NOT_FOUND", "Bahan tidak ditemukan.");
              const row2 = c.s.update("materials", "id", str2(cur.id), { ...data, ...stamp2(c, false) });
              log2(c, "ubah_bahan", "materials", str2(m.id), nama);
              return row2;
            }
            const row = c.s.insert("materials", { id: newId2(c.env, "mat"), ...data, stok: 0, harga_rata: 0, harga_terakhir: 0, ...stamp2(c, true) });
            const awal = num(m.stok_awal), hAwal = num(m.harga_awal);
            if (awal > 0) move(c, row, awal, "awal", hAwal, today(c), "materials", str2(row.id), "Stok awal");
            log2(c, "tambah_bahan", "materials", str2(row.id), `${nama}${awal ? ` stok awal ${awal} ${satuan}` : ""}`);
            return c.s.all("materials").find((x) => x.id === row.id);
          });
        }
      },
      "recipe.get": {
        auth: true,
        fn: (c, p) => {
          needAny(c, [["master.produk", "lihat"], ["stok", "lihat"]]);
          const pid = str2(p.product_id);
          const lines = c.s.all("recipes").filter((r) => r.product_id === pid);
          return { lines, satu_sisi: productCost(c, pid, 1), bolak_balik: productCost(c, pid, 2), lihat_harga: can(c, "master.harga_beli") || can(c, "laporan.laba") };
        }
      },
      "recipe.save": {
        auth: true,
        fn: (c, p) => {
          needAny(c, [["master.produk", "ubah"], ["stok", "ubah"]]);
          const pid = str2(p.product_id);
          const prod = c.s.all("products").find((x) => x.id === pid) || fail2("NOT_FOUND", "Produk tidak ditemukan.");
          if (bool2(prod.kertas_sendiri) && Array.isArray(p.lines) && p.lines.length) fail2("VALIDATION", "Produk kertas sendiri (upah print) tidak memakai bahan dari stok. HPP-nya hanya biaya klik mesin.");
          const mats = byId(c.s.all("materials"));
          const lines = (Array.isArray(p.lines) ? p.lines : []).map((l) => ({ material_id: str2(l.material_id), qty: num(l.qty), per: l.per === "klik" ? "klik" : "unit" }));
          lines.forEach((l) => {
            if (!mats[l.material_id]) fail2("VALIDATION", "Ada bahan yang tidak dikenal.");
            if (!(l.qty > 0)) fail2("VALIDATION", "Jumlah pemakaian harus lebih dari 0.");
          });
          if (new Set(lines.map((l) => l.material_id)).size !== lines.length) fail2("VALIDATION", "Bahan yang sama tercantum dua kali.");
          return c.s.withLock(() => {
            c.s.all("recipes").filter((r) => r.product_id === pid).forEach((r) => c.s.remove("recipes", "id", str2(r.id)));
            lines.forEach((l) => c.s.insert("recipes", { id: newId2(c.env, "rcp"), product_id: pid, ...l, ...stamp2(c, true) }));
            log2(c, "resep", "products", pid, `Resep: ${lines.map((l) => `${mats[l.material_id].nama} ${l.qty}/${l.per}`).join(", ") || "(kosong)"}`);
            return { lines: c.s.all("recipes").filter((r) => r.product_id === pid), satu_sisi: productCost(c, pid, 1), bolak_balik: productCost(c, pid, 2) };
          });
        }
      },
      "stock.card": {
        auth: true,
        fn: (c, p) => {
          need2(c, "stok");
          const mid = str2(p.material_id);
          const m = c.s.all("materials").find((x) => x.id === mid) || fail2("NOT_FOUND", "Bahan tidak ditemukan.");
          const from = isYmd2(str2(p.from)) ? str2(p.from) : "0000-01-01", to = isYmd2(str2(p.to)) ? str2(p.to) : "9999-12-31";
          const moves = c.s.all("stock_moves").filter((x) => x.material_id === mid).sort((a, b) => str2(a.tanggal).localeCompare(str2(b.tanggal)));
          const before = moves.filter((x) => str2(x.tanggal) < from);
          const saldoAwal = r2(before.reduce((s, x) => s + num(x.qty), 0));
          let saldo = saldoAwal;
          const rows = moves.filter((x) => str2(x.tanggal) >= from && str2(x.tanggal) <= to).map((x) => {
            saldo = r2(saldo + num(x.qty));
            return hideCost(c, { ...x, saldo_berjalan: saldo }, ["harga", "nilai"]);
          });
          return { material: hideCost(c, m, ["harga_rata", "harga_terakhir"]), saldo_awal: saldoAwal, rows, masuk: r2(rows.filter((r) => num(r.qty) > 0).reduce((s, r) => s + num(r.qty), 0)), keluar: r2(-rows.filter((r) => num(r.qty) < 0).reduce((s, r) => s + num(r.qty), 0)), saldo_akhir: saldo };
        }
      },
      "opname.save": {
        auth: true,
        fn: (c, p) => {
          need2(c, "stok", "tambah");
          const lines = (Array.isArray(p.lines) ? p.lines : []).filter((l) => l.stok_fisik !== "" && l.stok_fisik != null);
          if (!lines.length) fail2("VALIDATION", "Isi jumlah fisik minimal satu bahan.");
          return c.s.withLock(() => {
            const mats = byId(c.s.all("materials"));
            const id = newId2(c.env, "opn");
            const t = today(c);
            let nilai = 0, n = 0;
            lines.forEach((l) => {
              const m = mats[str2(l.material_id)] || fail2("VALIDATION", "Bahan tidak dikenal.");
              const fisik = num(l.stok_fisik);
              if (fisik < 0) fail2("VALIDATION", `Jumlah fisik ${str2(m.nama)} tidak boleh minus.`);
              const sistem = num(m.stok);
              const sel = r2(fisik - sistem);
              const hr = num(m.harga_rata);
              if (sel) move(c, m, sel, "opname", hr, t, "opnames", id, `Opname: ${str2(l.keterangan) || "selisih hitung fisik"}`);
              c.s.insert("opname_items", { id: newId2(c.env, "opi"), opname_id: id, material_id: m.id, stok_sistem: sistem, stok_fisik: fisik, selisih: sel, harga: hr, nilai: Math.round(sel * hr), keterangan: str2(l.keterangan).slice(0, 200) });
              nilai += Math.round(sel * hr);
              n++;
            });
            c.s.insert("opnames", { id, tanggal: t, keterangan: str2(p.keterangan).slice(0, 200), jumlah_item: n, nilai_selisih: nilai, ...stamp2(c, true) });
            log2(c, "opname", "opnames", id, `Stok opname ${n} bahan, selisih ${nilai.toLocaleString("id-ID")}`);
            return { id, jumlah_item: n, nilai_selisih: seeCost(c) ? nilai : null };
          });
        }
      },
      "opname.list": {
        auth: true,
        fn: (c) => {
          need2(c, "stok");
          const mats = byId(c.s.all("materials"));
          const users = byId(c.s.all("users"));
          const items = c.s.all("opname_items");
          return c.s.all("opnames").map((o) => {
            var _a;
            return { ...o, oleh: str2((_a = users[str2(o.created_by)]) == null ? void 0 : _a.nama), nilai_selisih: seeCost(c) ? o.nilai_selisih : null, items: items.filter((i) => i.opname_id === o.id).map((i) => {
              var _a2, _b;
              return hideCost(c, { ...i, nama: str2((_a2 = mats[str2(i.material_id)]) == null ? void 0 : _a2.nama), satuan: str2((_b = mats[str2(i.material_id)]) == null ? void 0 : _b.satuan) }, ["harga", "nilai"]);
            }) };
          }).sort((a, b) => str2(b.created_at).localeCompare(str2(a.created_at)));
        }
      },
      "purchase.save": {
        auth: true,
        fn: (c, p) => {
          need2(c, "pembelian", "tambah");
          const r = p.purchase || {};
          const t = str2(r.tanggal);
          if (!isYmd2(t) || t > today(c)) fail2("VALIDATION", "Tanggal tidak valid.");
          const cara = r.cara_bayar === "hutang" ? "hutang" : "lunas";
          if (cara === "hutang" && !r.supplier_id) fail2("VALIDATION", "Pembelian tempo harus memilih supplier.");
          if (cara === "lunas" && !c.s.all("payment_methods").some((m) => m.id === r.method_id)) fail2("VALIDATION", "Pilih metode pembayaran.");
          const items = (Array.isArray(r.items) ? r.items : []).map((i) => ({ material_id: str2(i.material_id), qty_beli: num(i.qty_beli), satuan_beli: str2(i.satuan_beli), isi: num(i.isi) || 1, harga_beli: Math.round(num(i.harga_beli)) }));
          if (!items.length) fail2("VALIDATION", "Tambahkan minimal satu bahan.");
          return c.s.withLock(() => {
            const mats = byId(c.s.all("materials"));
            items.forEach((i) => {
              if (!mats[i.material_id]) fail2("VALIDATION", "Ada bahan yang tidak dikenal.");
              if (!(i.qty_beli > 0) || !(i.harga_beli > 0)) fail2("VALIDATION", `Isi jumlah dan harga untuk ${str2(mats[i.material_id].nama)}.`);
            });
            const total = items.reduce((s, i) => s + Math.round(i.qty_beli * i.harga_beli), 0);
            const id = newId2(c.env, "pur");
            const cat = c.s.all("expense_categories").find((x) => x.jenis === "bahan");
            const ringkas = items.map((i) => `${str2(mats[i.material_id].nama)} ${i.qty_beli} ${i.satuan_beli || mats[i.material_id].satuan}`).join(", ");
            const eid = newId2(c.env, "exp");
            let billId = "";
            if (cara === "hutang") {
              billId = newId2(c.env, "bil");
              const jt = isYmd2(str2(r.jatuh_tempo)) ? str2(r.jatuh_tempo) : addDays2(t, 30);
              c.s.insert("supplier_bills", { id: billId, tanggal: t, nota: str2(r.nota), supplier_id: str2(r.supplier_id), expense_id: eid, total, terbayar: 0, sisa: total, jatuh_tempo: jt, keterangan: `Pembelian bahan: ${ringkas}`.slice(0, 300), ...stamp2(c, true) });
            }
            c.s.insert("expenses", {
              id: eid,
              tanggal: t,
              nota: str2(r.nota).slice(0, 80),
              supplier_id: str2(r.supplier_id),
              kategori_id: str2(cat == null ? void 0 : cat.id),
              product_id: "",
              item: `Pembelian bahan: ${ringkas}`.slice(0, 200),
              qty: 1,
              satuan: "nota",
              harga: total,
              total,
              isi_per_satuan: null,
              mesin_id: "",
              cara_bayar: cara,
              method_id: cara === "lunas" ? str2(r.method_id) : "",
              bill_id: billId,
              keterangan: str2(r.keterangan).slice(0, 300),
              deleted: false,
              purchase_id: id,
              ...stamp2(c, true)
            });
            c.s.insert("purchases", { id, tanggal: t, nota: str2(r.nota).slice(0, 80), supplier_id: str2(r.supplier_id), total, cara_bayar: cara, method_id: cara === "lunas" ? str2(r.method_id) : "", bill_id: billId, expense_id: eid, jatuh_tempo: cara === "hutang" ? isYmd2(str2(r.jatuh_tempo)) ? str2(r.jatuh_tempo) : addDays2(t, 30) : "", keterangan: str2(r.keterangan).slice(0, 300), deleted: false, ...stamp2(c, true) });
            items.forEach((i) => {
              const m = mats[i.material_id];
              const qtyStok = r2(i.qty_beli * i.isi), hargaStok = r2(i.harga_beli / i.isi);
              c.s.insert("purchase_items", { id: newId2(c.env, "pui"), purchase_id: id, ...i, satuan_beli: i.satuan_beli || str2(m.satuan), subtotal: Math.round(i.qty_beli * i.harga_beli), qty_stok: qtyStok, harga_stok: hargaStok });
              move(c, m, qtyStok, "beli", hargaStok, t, "purchases", id, `Pembelian ${str2(r.nota)}`.trim());
            });
            log2(c, "pembelian", "purchases", id, `Pembelian ${total.toLocaleString("id-ID")} (${cara}): ${ringkas}`);
            return { id, total };
          });
        }
      },
      "purchase.list": {
        auth: true,
        fn: (c, p) => {
          need2(c, "pembelian");
          const from = isYmd2(str2(p.from)) ? str2(p.from) : "0000-01-01", to = isYmd2(str2(p.to)) ? str2(p.to) : "9999-12-31";
          const sup = byId(c.s.all("suppliers")), met = byId(c.s.all("payment_methods")), mats = byId(c.s.all("materials")), bills = byId(c.s.all("supplier_bills")), users = byId(c.s.all("users"));
          const items = c.s.all("purchase_items");
          return c.s.all("purchases").filter((x) => !bool2(x.deleted) && str2(x.tanggal) >= from && str2(x.tanggal) <= to).map((x) => {
            var _a, _b, _c, _d;
            return {
              ...x,
              supplier: str2((_a = sup[str2(x.supplier_id)]) == null ? void 0 : _a.nama),
              metode: str2((_b = met[str2(x.method_id)]) == null ? void 0 : _b.nama),
              oleh: str2((_c = users[str2(x.created_by)]) == null ? void 0 : _c.nama),
              sisa_hutang: x.bill_id ? num((_d = bills[str2(x.bill_id)]) == null ? void 0 : _d.sisa) : 0,
              items: items.filter((i) => i.purchase_id === x.id).map((i) => {
                var _a2, _b2;
                return { ...i, nama: str2((_a2 = mats[str2(i.material_id)]) == null ? void 0 : _a2.nama), satuan: str2((_b2 = mats[str2(i.material_id)]) == null ? void 0 : _b2.satuan) };
              })
            };
          });
        }
      },
      "purchase.delete": {
        auth: true,
        fn: (c, p) => {
          need2(c, "pembelian", "hapus");
          if (!str2(p.alasan)) fail2("VALIDATION", "Isi alasan penghapusan.");
          return c.s.withLock(() => {
            const x = c.s.all("purchases").find((r) => r.id === p.id && !bool2(r.deleted)) || fail2("NOT_FOUND", "Pembelian tidak ditemukan.");
            const pr = x;
            if (pr.bill_id) {
              const b = c.s.all("supplier_bills").find((r) => r.id === pr.bill_id);
              if (b && num(b.terbayar) > 0) fail2("VALIDATION", "Hutang pembelian ini sudah dicicil. Hapus tidak diizinkan.");
              if (b) c.s.update("supplier_bills", "id", str2(b.id), { sisa: 0, total: 0, keterangan: `DIHAPUS: ${str2(b.keterangan)}`.slice(0, 300), ...stamp2(c, false) });
            }
            const mats = byId(c.s.all("materials"));
            c.s.all("purchase_items").filter((i) => i.purchase_id === pr.id).forEach((i) => {
              const m = mats[str2(i.material_id)];
              if (m) move(c, m, -num(i.qty_stok), "batal_beli", num(i.harga_stok), today(c), "purchases", str2(pr.id), `Hapus pembelian ${str2(pr.nota)}`);
            });
            if (pr.expense_id) c.s.update("expenses", "id", str2(pr.expense_id), { deleted: true, ...stamp2(c, false) });
            c.s.update("purchases", "id", str2(pr.id), { deleted: true, ...stamp2(c, false) });
            log2(c, "hapus_pembelian", "purchases", str2(pr.id), `Hapus pembelian ${str2(pr.nota)} ${num(pr.total).toLocaleString("id-ID")}`, str2(p.alasan));
            return { ok: true };
          });
        }
      },
      "margin.list": {
        auth: true,
        fn: (c) => {
          need2(c, "laporan.laba");
          const cache = { mats: byId(c.s.all("materials")), recipes: c.s.all("recipes"), machines: byId(c.s.all("machines")), products: byId(c.s.all("products")) };
          const prices = c.s.all("price_history");
          const minMargin = num(settingsMap2(c.s).margin_min || 20);
          const t = today(c);
          return {
            margin_min: minMargin,
            rows: c.s.all("products").filter((x) => bool2(x.aktif) && x.jenis_harga !== "manual").map((x) => {
              var _a;
              const h2 = hargaBerlaku(prices.filter((r) => r.product_id === x.id), t);
              const c1 = productCost(c, str2(x.id), 1, cache), c2 = productCost(c, str2(x.id), 2, cache);
              const pr = (k, cost) => {
                const v = h2 ? num(h2[k]) : 0;
                return v ? { harga: v, margin: Math.round((v - cost) / v * 1e3) / 10 } : null;
              };
              const cells = { es: pr("es", c1.total), rb: pr("rb", c1.total), es_bb: x.jenis_harga === "matriks" ? pr("es_bb", c2.total) : null, rb_bb: x.jenis_harga === "matriks" ? pr("rb_bb", c2.total) : null };
              const margins = Object.values(cells).filter(Boolean).map((v) => v.margin);
              const terendah = margins.length ? Math.min(...margins) : null;
              return {
                id: x.id,
                kode: x.kode,
                nama: x.nama,
                kategori: x.kategori,
                jenis_harga: x.jenis_harga,
                mesin: str2((_a = cache.machines[str2(x.mesin_id)]) == null ? void 0 : _a.nama),
                kertas_sendiri: bool2(x.kertas_sendiri),
                resep: c1.resep || bool2(x.kertas_sendiri),
                hpp_bahan: c1.bahan,
                hpp_klik: c1.klik,
                hpp: c1.total,
                hpp_bb: x.jenis_harga === "matriks" ? c2.total : null,
                ...cells,
                margin_terendah: terendah,
                status: !c1.resep && !bool2(x.kertas_sendiri) ? "tanpa_resep" : terendah == null ? "tanpa_harga" : terendah < 0 ? "rugi" : terendah < minMargin ? "tipis" : "aman"
              };
            })
          };
        }
      },
      "report.pnl": {
        auth: true,
        fn: (c, p) => {
          need2(c, "laporan.laba");
          const to = isYmd2(str2(p.to)) ? str2(p.to) : today(c);
          const from = isYmd2(str2(p.from)) ? str2(p.from) : to.slice(0, 8) + "01";
          const days = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
          const pFrom = addDays2(from, -days), pTo = addDays2(from, -1);
          const orders = byId(c.s.all("orders").filter((o) => !bool2(o.batal) && str2(o.tanggal) >= from && str2(o.tanggal) <= to));
          const belum = c.s.all("order_items").filter((i) => orders[str2(i.order_id)] && !str2(i.stok_at) && i.status_produksi !== "batal");
          const klikCat = new Set(c.s.all("expense_categories").filter((x) => x.jenis === "klik").map((x) => str2(x.id)));
          const tagihanKlik = c.s.all("expenses").filter((x) => !bool2(x.deleted) && klikCat.has(str2(x.kategori_id)) && str2(x.tanggal) >= from && str2(x.tanggal) <= to).reduce((s, x) => s + num(x.total), 0);
          return { from, to, sekarang: pnl(c, from, to), sebelumnya: { from: pFrom, to: pTo, ...pnl(c, pFrom, pTo) }, belum_hpp: { item: belum.length, nilai_jual: belum.reduce((s, i) => s + num(i.subtotal), 0) }, tagihan_klik: tagihanKlik };
        }
      },
      "analytics.get": {
        auth: true,
        fn: (c, p) => {
          var _a, _b, _c, _d;
          need2(c, "laporan");
          const t = today(c);
          const grain = p.grain === "bulan" ? "bulan" : "hari";
          const to = isYmd2(str2(p.to)) ? str2(p.to) : t;
          let from = isYmd2(str2(p.from)) ? str2(p.from) : grain === "bulan" ? `${addDays2(to, -330).slice(0, 7)}-01` : addDays2(to, -29);
          if (grain === "bulan") from = `${from.slice(0, 7)}-01`;
          if (from > to) fail2("VALIDATION", "Tanggal awal harus sebelum tanggal akhir.");
          const laba = seeCost(c);
          const productId = str2(p.product_id);
          const materialId = str2(p.material_id);
          const keyOf = (d) => grain === "bulan" ? d.slice(0, 7) : d;
          const keys = [];
          if (grain === "hari") {
            for (let d = from; d <= to && keys.length < 400; d = addDays2(d, 1)) keys.push(d);
          } else {
            let y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7));
            const end = to.slice(0, 7);
            while (keys.length < 60) {
              const k = `${y}-${String(m).padStart(2, "0")}`;
              if (k > end) break;
              keys.push(k);
              m++;
              if (m > 12) {
                m = 1;
                y++;
              }
            }
          }
          const zero = () => Object.fromEntries(keys.map((k) => [k, 0]));
          const inR = (d) => str2(d) >= from && str2(d) <= to;
          const cache = { mats: byId(c.s.all("materials")), recipes: c.s.all("recipes"), machines: byId(c.s.all("machines")), products: byId(c.s.all("products")) };
          const unitCost = {};
          const costOf = (i) => {
            if (str2(i.stok_at)) return num(i.hpp_bahan) + num(i.hpp_klik);
            const k = `${str2(i.product_id)}|${num(i.sisi) === 2 ? 2 : 1}`;
            if (!(k in unitCost)) unitCost[k] = productCost(c, str2(i.product_id), num(i.sisi) === 2 ? 2 : 1, cache).total;
            return unitCost[k] * num(i.qty);
          };
          const allOrders = c.s.all("orders").filter((o) => !bool2(o.batal));
          const oById = byId(allOrders);
          const omzet = zero(), hpp = zero(), qty = zero();
          const nota = {};
          const perProduk = {};
          c.s.all("order_items").forEach((i) => {
            var _a2;
            const o = oById[str2(i.order_id)];
            if (!o || i.status_produksi === "batal" || !inR(o.tanggal)) return;
            const k = keyOf(str2(o.tanggal));
            const sub = num(i.subtotal), cst = costOf(i);
            const pid = str2(i.product_id);
            const pr = perProduk[pid] || (perProduk[pid] = { id: pid, kode: str2((_a2 = cache.products[pid]) == null ? void 0 : _a2.kode), nama: str2(i.nama_produk), qty: 0, omzet: 0, hpp: 0, nota: /* @__PURE__ */ new Set() });
            pr.qty += num(i.qty);
            pr.omzet += sub;
            pr.hpp += cst;
            pr.nota.add(str2(o.id));
            if (productId && pid !== productId) return;
            if (k in omzet) {
              omzet[k] += sub;
              hpp[k] += cst;
              qty[k] += num(i.qty);
              (nota[k] || (nota[k] = /* @__PURE__ */ new Set())).add(str2(o.id));
            }
          });
          const penjualan = keys.map((k) => {
            var _a2;
            return { key: k, omzet: Math.round(omzet[k]), hpp: laba ? Math.round(hpp[k]) : null, laba: laba ? Math.round(omzet[k] - hpp[k]) : null, qty: qty[k], nota: ((_a2 = nota[k]) == null ? void 0 : _a2.size) || 0 };
          });
          const purchases = c.s.all("purchases").filter((x) => !bool2(x.deleted) && inR(x.tanggal));
          const pById = byId(purchases);
          const beli = zero(), beliTrx = {};
          const perBahan = {};
          c.s.all("purchase_items").forEach((i) => {
            const pr = pById[str2(i.purchase_id)];
            if (!pr) return;
            const mid = str2(i.material_id);
            const m = cache.mats[mid];
            const b = perBahan[mid] || (perBahan[mid] = { id: mid, nama: str2(m == null ? void 0 : m.nama) || "\u2013", satuan: str2(m == null ? void 0 : m.satuan), qty: 0, total: 0 });
            b.qty += num(i.qty_stok);
            b.total += num(i.subtotal);
            if (materialId && mid !== materialId) return;
            const k = keyOf(str2(pr.tanggal));
            if (k in beli) {
              beli[k] += num(i.subtotal);
              (beliTrx[k] || (beliTrx[k] = /* @__PURE__ */ new Set())).add(str2(pr.id));
            }
          });
          const pembelian = laba ? keys.map((k) => {
            var _a2;
            return { key: k, total: Math.round(beli[k]), transaksi: ((_a2 = beliTrx[k]) == null ? void 0 : _a2.size) || 0 };
          }) : null;
          const bucketEnd = (k) => grain === "hari" ? k : addDays2(`${nextMonth(k)}-01`, -1);
          const ends = keys.map((k) => {
            const e = bucketEnd(k);
            return e > to ? to : e;
          });
          const cum = (events) => {
            events.sort((a, b) => a[0].localeCompare(b[0]));
            let j = 0, run = 0;
            return ends.map((e) => {
              while (j < events.length && events[j][0] <= e) {
                run += events[j][1];
                j++;
              }
              return Math.round(run);
            });
          };
          const piutangEv = [];
          allOrders.forEach((o) => piutangEv.push([str2(o.tanggal), num(o.total)]));
          c.s.all("payments").forEach((x) => {
            if (oById[str2(x.order_id)]) piutangEv.push([str2(x.tanggal), -num(x.nominal)]);
          });
          const piutang = cum(piutangEv);
          let hutang = null;
          if (laba) {
            const hutangEv = [];
            c.s.all("supplier_bills").forEach((b) => hutangEv.push([str2(b.tanggal), num(b.total)]));
            c.s.all("bill_payments").forEach((x) => hutangEv.push([str2(x.tanggal), -num(x.nominal)]));
            hutang = cum(hutangEv);
          }
          const saldo = keys.map((k, i) => ({ key: k, piutang: piutang[i], hutang: hutang ? hutang[i] : null }));
          const cust = byId(c.s.all("customers"));
          const months = [];
          {
            let y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7));
            while (months.length < 24) {
              const k = `${y}-${String(m).padStart(2, "0")}`;
              if (k > to.slice(0, 7)) break;
              months.push(k);
              m++;
              if (m > 12) {
                m = 1;
                y++;
              }
            }
          }
          const perCust = {};
          allOrders.filter((o) => inR(o.tanggal)).forEach((o) => {
            const id = str2(o.customer_id);
            const cu = cust[id];
            const r = perCust[id] || (perCust[id] = { id, nama: str2(cu == null ? void 0 : cu.nama) || "\u2013", tipe: str2(cu == null ? void 0 : cu.tipe), omzet: 0, nota: 0, terbayar: 0, sisa: 0, bulanan: {}, terakhir: "" });
            r.omzet += num(o.total);
            r.nota += 1;
            r.terbayar += num(o.terbayar);
            r.sisa += Math.max(0, num(o.sisa));
            const mk = str2(o.tanggal).slice(0, 7);
            r.bulanan[mk] = (r.bulanan[mk] || 0) + num(o.total);
            if (str2(o.tanggal) > r.terakhir) r.terakhir = str2(o.tanggal);
          });
          const custAll = Object.values(perCust).filter((r) => !/^umum|walk/i.test(r.nama));
          const totalOmzet = Object.values(perCust).reduce((a, r) => a + r.omzet, 0);
          const pelanggan = custAll.sort((a, b) => b.omzet - a.omzet).slice(0, Math.min(50, Math.max(1, Number(p.top) || 10))).map((r, i) => ({ ...r, rank: i + 1, porsi: totalOmzet ? Math.round(r.omzet / totalOmzet * 1e3) / 10 : 0 }));
          const len = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
          const pFrom = addDays2(from, -len), pTo = addDays2(from, -1);
          let prevOmzet = 0, prevHpp = 0;
          c.s.all("order_items").forEach((i) => {
            const o = oById[str2(i.order_id)];
            if (!o || i.status_produksi === "batal" || str2(o.tanggal) < pFrom || str2(o.tanggal) > pTo) return;
            if (productId && str2(i.product_id) !== productId) return;
            prevOmzet += num(i.subtotal);
            prevHpp += costOf(i);
          });
          const prevBeli = c.s.all("purchases").filter((x) => !bool2(x.deleted) && str2(x.tanggal) >= pFrom && str2(x.tanggal) <= pTo).reduce((a, x) => a + num(x.total), 0);
          const sumOmzet = penjualan.reduce((a, x) => a + x.omzet, 0);
          const sumHpp = keys.reduce((a, k) => a + hpp[k], 0);
          return {
            from,
            to,
            grain,
            keys,
            lihat_laba: laba,
            product_id: productId,
            material_id: materialId,
            penjualan,
            pembelian,
            saldo,
            pelanggan,
            months,
            ringkasan: {
              omzet: sumOmzet,
              laba: laba ? Math.round(sumOmzet - sumHpp) : null,
              margin: laba && sumOmzet ? Math.round((sumOmzet - sumHpp) / sumOmzet * 1e3) / 10 : null,
              nota: new Set(Object.values(nota).flatMap((x) => [...x])).size,
              pembelian: laba ? (pembelian || []).reduce((a, x) => a + x.total, 0) : null,
              piutang: (_a = piutang[piutang.length - 1]) != null ? _a : 0,
              piutang_awal: (_b = piutang[0]) != null ? _b : 0,
              hutang: hutang ? (_c = hutang[hutang.length - 1]) != null ? _c : 0 : null,
              hutang_awal: hutang ? (_d = hutang[0]) != null ? _d : 0 : null,
              sebelumnya: { from: pFrom, to: pTo, omzet: Math.round(prevOmzet), laba: laba ? Math.round(prevOmzet - prevHpp) : null, pembelian: laba ? Math.round(prevBeli) : null }
            },
            produk: Object.values(perProduk).map((r) => ({ id: r.id, kode: r.kode, nama: r.nama, qty: r.qty, nota: r.nota.size, omzet: Math.round(r.omzet), hpp: laba ? Math.round(r.hpp) : null, laba: laba ? Math.round(r.omzet - r.hpp) : null, margin: laba && r.omzet ? Math.round((r.omzet - r.hpp) / r.omzet * 1e3) / 10 : null })).sort((a, b) => b.omzet - a.omzet),
            bahan: laba ? Object.values(perBahan).map((b) => ({ ...b, total: Math.round(b.total) })).sort((a, b) => b.total - a.total) : []
          };
        }
      },
      "ledger.trial": {
        auth: true,
        fn: (c, p) => {
          need2(c, "laporan.laba");
          const to = isYmd2(str2(p.to)) ? str2(p.to) : today(c);
          const from = isYmd2(str2(p.from)) ? str2(p.from) : to.slice(0, 8) + "01";
          return { from, to, ...trial(c, from, to) };
        }
      },
      "ledger.get": {
        auth: true,
        fn: (c, p) => {
          need2(c, "laporan.laba");
          const to = isYmd2(str2(p.to)) ? str2(p.to) : today(c);
          const from = isYmd2(str2(p.from)) ? str2(p.from) : to.slice(0, 8) + "01";
          const akun = str2(p.akun);
          const { accounts, entries } = buildJournal(c);
          const acc = accounts[akun] || fail2("NOT_FOUND", "Akun tidak ditemukan.");
          const sign = debitNormal(acc.tipe) ? 1 : -1;
          let awal = 0;
          const rows = [];
          entries.forEach((e) => e.lines.forEach((l) => {
            if (l.akun !== akun || e.tanggal > to) return;
            if (e.tanggal < from) {
              awal += sign * (l.d - l.k);
              return;
            }
            rows.push({ tanggal: e.tanggal, ref: e.ref, sumber: e.sumber, keterangan: e.keterangan, debit: l.d, kredit: l.k });
          }));
          let saldo = awal;
          rows.forEach((r) => {
            saldo += sign * (num(r.debit) - num(r.kredit));
            r.saldo = saldo;
          });
          return { akun: acc, from, to, saldo_awal: awal, rows, saldo_akhir: saldo, accounts: Object.values(accounts).sort((a, b) => a.kode.localeCompare(b.kode)) };
        }
      },
      "journal.list": {
        auth: true,
        fn: (c, p) => {
          need2(c, "laporan.laba");
          const to = isYmd2(str2(p.to)) ? str2(p.to) : today(c);
          const from = isYmd2(str2(p.from)) ? str2(p.from) : to.slice(0, 8) + "01";
          const { accounts, entries } = buildJournal(c);
          const users = byId(c.s.all("users"));
          return {
            accounts: Object.values(accounts).sort((a, b) => a.kode.localeCompare(b.kode)),
            entries: entries.filter((e) => e.tanggal >= from && e.tanggal <= to),
            manual: c.s.all("journals").filter((j) => !bool2(j.deleted)).map((j) => {
              var _a;
              return { ...j, oleh: str2((_a = users[str2(j.created_by)]) == null ? void 0 : _a.nama) };
            })
          };
        }
      },
      "journal.save": {
        auth: true,
        fn: (c, p) => {
          need2(c, "laporan.laba", "tambah");
          const j = p.journal || {};
          const t = str2(j.tanggal);
          if (!isYmd2(t)) fail2("VALIDATION", "Tanggal tidak valid.");
          if (!str2(j.keterangan)) fail2("VALIDATION", "Isi keterangan jurnal.");
          const lines = (Array.isArray(j.lines) ? j.lines : []).map((l) => ({ akun: str2(l.akun), debit: Math.round(num(l.debit)), kredit: Math.round(num(l.kredit)) })).filter((l) => l.akun && (l.debit || l.kredit));
          if (lines.length < 2) fail2("VALIDATION", "Jurnal minimal dua baris.");
          const d = lines.reduce((s, l) => s + l.debit, 0), k = lines.reduce((s, l) => s + l.kredit, 0);
          if (d !== k) fail2("VALIDATION", `Debit (${d.toLocaleString("id-ID")}) dan kredit (${k.toLocaleString("id-ID")}) harus sama.`);
          const known = buildJournal(c).accounts;
          lines.forEach((l) => {
            if (!known[l.akun]) fail2("VALIDATION", `Akun ${l.akun} tidak dikenal.`);
          });
          return c.s.withLock(() => {
            const row = c.s.insert("journals", { id: newId2(c.env, "jrn"), tanggal: t, keterangan: str2(j.keterangan).slice(0, 200), lines, deleted: false, ...stamp2(c, true) });
            log2(c, "jurnal", "journals", str2(row.id), `${str2(j.keterangan)} ${d.toLocaleString("id-ID")}`);
            return row;
          });
        }
      },
      "journal.delete": {
        auth: true,
        fn: (c, p) => {
          need2(c, "laporan.laba", "hapus");
          if (!str2(p.alasan)) fail2("VALIDATION", "Isi alasan penghapusan.");
          return c.s.withLock(() => {
            const j = c.s.all("journals").find((x) => x.id === p.id && !bool2(x.deleted)) || fail2("NOT_FOUND", "Jurnal tidak ditemukan.");
            c.s.update("journals", "id", str2(j.id), { deleted: true, ...stamp2(c, false) });
            log2(c, "hapus_jurnal", "journals", str2(j.id), str2(j.keterangan), str2(p.alasan));
            return { ok: true };
          });
        }
      }
    };
    function lowStock(c) {
      return c.s.all("materials").filter((m) => bool2(m.aktif) && num(m.stok) <= num(m.stok_min)).map((m) => ({ id: m.id, nama: m.nama, satuan: m.satuan, stok: num(m.stok), stok_min: num(m.stok_min) })).sort((a, b) => a.stok / Math.max(1, a.stok_min) - b.stok / Math.max(1, b.stok_min));
    }
    return { handlers: handlers2, hooks, deductItem, move, productCost, buildJournal, pnl, trial, lowStock };
  }

  // src/server/core.ts
  var API_VERSION = 1;
  var ApiError = class extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  };
  var fail = (code, msg) => {
    throw new ApiError(code, msg);
  };
  var str = (v) => v == null ? "" : String(v).trim();
  var numOrNull = (v) => {
    if (v === "" || v == null) return null;
    const n = Number(String(v).replace(/[^\d.-]/g, ""));
    return isNaN(n) ? null : n;
  };
  var bool = (v) => v === true || v === "TRUE" || v === "true" || v === 1 || v === "1" || v === "ya";
  var newId = (env, prefix) => `${prefix}_${env.uuid().replace(/-/g, "").slice(0, 12)}`;
  var iso = (env) => env.now().toISOString();
  var addDays = (ymd, n) => {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    return dt.toISOString().slice(0, 10);
  };
  var isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  function hashPassword(password, salt) {
    let h = salt + ":" + password;
    for (let i = 0; i < 300; i++) h = sha256(h + salt);
    return h;
  }
  var publicUser = (u) => {
    const { password_hash: _h, salt: _s, ...rest } = u;
    return rest;
  };
  function settingsMap(s) {
    const m = {};
    s.all("settings").forEach((r) => m[str(r.key)] = str(r.value));
    return m;
  }
  function permsFor(s, role) {
    const row = s.all("role_permissions").find((r) => r.role === role);
    const base = defaultPermissions(role);
    if (role === "owner") return base;
    if (!row || !row.permissions) return base;
    const saved = row.permissions;
    MODULES.forEach((m) => {
      if (saved[m.key]) base[m.key] = saved[m.key];
    });
    return base;
  }
  function log(c, aksi, tabel, recordId, ringkasan, alasan = "") {
    var _a, _b, _c;
    c.s.insert("activity_log", {
      id: newId(c.env, "log"),
      waktu: iso(c.env),
      user_id: str((_a = c.user) == null ? void 0 : _a.id),
      user_nama: str(((_b = c.user) == null ? void 0 : _b.nama) || ((_c = c.user) == null ? void 0 : _c.username)),
      aksi,
      tabel,
      record_id: recordId,
      ringkasan: ringkasan.slice(0, 500),
      alasan
    });
  }
  function need(c, key, op = "lihat") {
    var _a, _b;
    if (!((_b = (_a = c.perms) == null ? void 0 : _a[key]) == null ? void 0 : _b[op])) fail("FORBIDDEN", "Anda tidak punya akses untuk tindakan ini.");
  }
  var stamp = (c, isNew) => {
    var _a, _b, _c;
    return isNew ? { created_at: iso(c.env), created_by: str((_a = c.user) == null ? void 0 : _a.id), updated_at: iso(c.env), updated_by: str((_b = c.user) == null ? void 0 : _b.id) } : { updated_at: iso(c.env), updated_by: str((_c = c.user) == null ? void 0 : _c.id) };
  };
  function deviceRow(c) {
    if (!c.req.deviceId) return void 0;
    const h = sha256("dev:" + c.req.deviceId);
    return c.s.all("devices").find((d) => d.device_hash === h);
  }
  var cleanInfo = (i) => i && typeof i === "object" ? {
    nama: str(i.nama).slice(0, 60),
    jenis: i.jenis === "desktop" ? "desktop" : "web",
    versi: str(i.versi).slice(0, 20),
    kode: str(i.kode).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4),
    lokasi: str(i.lokasi).slice(0, 60)
  } : {};
  var ROLE_LABEL = { owner: "owner", admin: "admin", cs: "CS", kasir: "kasir", operator: "operator", keuangan: "keuangan" };
  var parseRoles = (v) => str(v).split(",").map((x) => x.trim()).filter(Boolean);
  var cleanRoles = (v) => (Array.isArray(v) ? v.map(String) : parseRoles(v)).filter((r) => r in ROLE_LABEL).join(",");
  function checkDevice(c, user, onLogin, info = {}) {
    const dev = deviceRow(c);
    if (dev && dev.status === "disetujui" && user.role !== "owner") {
      const izin = parseRoles(dev.role_izin);
      if (izin.length && !izin.includes(str(user.role))) {
        fail("ROLE_NOT_ALLOWED", `PC ${str(dev.kode_pc)} hanya untuk ${izin.map((r) => ROLE_LABEL[r] || r).join(", ")}. Akun ${ROLE_LABEL[str(user.role)] || user.role} tidak bisa login di sini.`);
      }
    }
    if (onLogin && dev) {
      const patch = { last_seen: iso(c.env) };
      if (info.versi) patch.versi_app = info.versi;
      if (info.nama) patch.nama_komputer = info.nama;
      if (info.jenis === "desktop" && dev.jenis !== "desktop") patch.jenis = "desktop";
      if (dev.status === "menunggu") {
        if (info.kode && !dev.kode_pc) patch.kode_pc = info.kode;
        if (info.lokasi && !dev.lokasi) patch.lokasi = info.lokasi;
      }
      c.s.update("devices", "id", str(dev.id), patch);
    }
    if (!bool(user.khusus_kantor)) return;
    if (dev && dev.status === "disetujui") return;
    if (onLogin && c.req.deviceId && !dev) {
      c.s.insert("devices", {
        id: newId(c.env, "dev"),
        kode_pc: info.kode || "",
        nama: info.nama || "Perangkat baru (" + str(user.username) + ")",
        jenis: info.jenis || "web",
        device_hash: sha256("dev:" + c.req.deviceId),
        status: "menunggu",
        printer_koneksi: "",
        printer_alamat: "",
        lebar_kertas: "",
        laci_otomatis: false,
        disetujui_oleh: "",
        last_seen: iso(c.env),
        role_izin: "",
        lokasi: info.lokasi || "",
        nama_komputer: info.nama || "",
        versi_app: info.versi || "",
        created_at: iso(c.env),
        created_by: str(user.id)
      });
    }
    fail("DEVICE_NOT_ALLOWED", (dev == null ? void 0 : dev.status) === "dicabut" ? "Akses perangkat ini sudah dicabut admin." : "Akun ini hanya bisa dipakai di perangkat kantor yang sudah disetujui. Minta admin menyetujui perangkat ini di Pengaturan \u2192 Perangkat.");
  }
  function checkDeviceLimit(c, exceptId) {
    const max = Number(settingsMap(c.s).maks_perangkat || 0);
    if (!max) return;
    const aktif = c.s.all("devices").filter((d) => d.status === "disetujui" && d.id !== exceptId).length;
    if (aktif >= max) fail("DEVICE_LIMIT", `Sudah ada ${aktif} perangkat aktif (batas ${max}). Cabut perangkat yang tidak dipakai, atau naikkan batas di Pengaturan \u2192 Umum.`);
  }
  function checkHours(c, user) {
    const dari = str(user.jam_login_dari), sampai = str(user.jam_login_sampai);
    if (!dari || !sampai || user.role === "owner") return;
    const now = c.env.timeHM();
    if (now < dari || now > sampai) fail("OUTSIDE_HOURS", `Akun ini hanya bisa login pukul ${dari}\u2013${sampai}.`);
  }
  function makeSession(c, user) {
    var _a;
    const token = (c.env.uuid() + c.env.uuid()).replace(/-/g, "");
    const jam = Number(settingsMap(c.s).sesi_jam || 12);
    const exp = new Date(c.env.now().getTime() + jam * 3600 * 1e3).toISOString();
    const nowIso = iso(c.env);
    c.s.all("sessions").filter((r) => str(r.expired_at) < nowIso).forEach((r) => c.s.remove("sessions", "token_hash", str(r.token_hash)));
    c.s.insert("sessions", { token_hash: sha256("tok:" + token), user_id: user.id, device_id: str((_a = deviceRow(c)) == null ? void 0 : _a.id), expired_at: exp, created_at: nowIso });
    return { token, user: publicUser(user), permissions: permsFor(c.s, str(user.role)), expired_at: exp };
  }
  function authenticate(c) {
    if (!c.req.token) fail("AUTH_REQUIRED", "Silakan login dulu.");
    const h = sha256("tok:" + c.req.token);
    const ses = c.s.all("sessions").find((r) => r.token_hash === h);
    if (!ses || str(ses.expired_at) < iso(c.env)) fail("AUTH_REQUIRED", "Sesi berakhir. Silakan login lagi.");
    const user = c.s.all("users").find((u) => u.id === ses.user_id);
    if (!user || !bool(user.aktif)) fail("AUTH_REQUIRED", "Akun tidak aktif.");
    checkDevice(c, user, false);
    c.user = user;
    c.perms = permsFor(c.s, str(user.role));
  }
  var pad = (n, l = 2) => String(n).padStart(l, "0");
  var counterKey = (kode, ymd) => `nota-${kode}-${ymd.slice(0, 7)}`;
  var formatNota = (prefix, kode, ymd, n) => `${prefix || "FT"}-${kode}-${ymd.slice(5, 7)}${ymd.slice(2, 4)}-${pad(n, 4)}`;
  function bumpCounter(c, key, value) {
    const row = c.s.all("counters").find((r) => r.key === key);
    if (!row) c.s.insert("counters", { key, value });
    else if (Number(row.value) < value) c.s.update("counters", "key", key, { value });
  }
  function statusBayar(total, terbayar) {
    if (terbayar >= total && total > 0) return "lunas";
    if (terbayar > 0) return "dp";
    return total === 0 ? "lunas" : "belum";
  }
  function recalcOrder(c, orderId) {
    const o = c.s.all("orders").find((x) => x.id === orderId);
    const terbayar = c.s.all("payments").filter((x) => x.order_id === orderId).reduce((a, x) => a + Number(x.nominal || 0), 0);
    const total = Number(o.total);
    c.s.update("orders", "id", orderId, { terbayar, sisa: total - terbayar, status_bayar: bool(o.batal) ? "batal" : statusBayar(total, terbayar), ...stamp(c, false) });
  }
  function orderDetail(c, id) {
    var _a, _b;
    const o = c.s.all("orders").find((x) => x.id === id) || fail("NOT_FOUND", "Nota tidak ditemukan.");
    const cu = c.s.all("customers").find((x) => x.id === o.customer_id) || {};
    const users = Object.fromEntries(c.s.all("users").map((x) => [x.id, x.nama]));
    const methods = Object.fromEntries(c.s.all("payment_methods").map((x) => [x.id, x.nama]));
    const machines = Object.fromEntries(c.s.all("machines").map((x) => [x.id, x.nama]));
    const canCost = !!((_b = (_a = c.perms) == null ? void 0 : _a["master.harga_beli"]) == null ? void 0 : _b.lihat);
    const jenis = Object.fromEntries(c.s.all("products").map((x) => [x.id, x.jenis_harga]));
    return {
      order: { ...o, customer_nama: str(cu.nama), customer_telp: str(cu.telp), customer_tipe: str(cu.tipe), customer_kode: str(cu.kode), cs_nama: str(users[str(o.cs_id)]) },
      items: c.s.all("order_items").filter((i) => i.order_id === id).map((i) => ({ ...i, harga_beli: canCost ? i.harga_beli : null, hpp_bahan: canCost ? i.hpp_bahan : null, hpp_klik: canCost ? i.hpp_klik : null, mesin_nama: str(machines[str(i.mesin_id)]), jenis_harga: str(jenis[str(i.product_id)]) })),
      payments: c.s.all("payments").filter((x) => x.order_id === id).sort((a, b) => str(a.created_at).localeCompare(str(b.created_at))).map((x) => ({ ...x, method_nama: str(methods[str(x.method_id)]), kasir_nama: str(users[str(x.kasir_id)]) })),
      payment_methods: c.s.all("payment_methods").filter((m) => bool(m.aktif)).map((m) => ({ id: m.id, nama: m.nama, jenis: m.jenis }))
    };
  }
  function createOrder(c, p) {
    var _a, _b, _c, _d, _e;
    const id = str(p.id);
    if (!/^ord_[a-z0-9]{8,40}$/.test(id)) fail("VALIDATION", "ID nota tidak valid.");
    const existing = c.s.all("orders").find((x) => x.id === id);
    if (existing) return { ...orderDetail(c, id), duplikat: true };
    const st = settingsMap(c.s);
    const today = c.env.today();
    const offline = bool(p.dibuat_offline);
    let tanggal = today;
    if (offline && isYmd(str(p.tanggal))) {
      if (str(p.tanggal) > today) fail("VALIDATION", "Tanggal nota offline lebih dari hari ini. Periksa jam komputer.");
      if (str(p.tanggal) < addDays(today, -14)) fail("VALIDATION", "Nota offline lebih dari 14 hari. Hubungi admin.");
      tanggal = str(p.tanggal);
    }
    const cust = c.s.all("customers").find((x) => x.id === p.customer_id) || fail("VALIDATION", "Pilih konsumen.");
    const tipe = cust.tipe === "reseller" ? "reseller" : "enduser";
    const rawItems = Array.isArray(p.items) ? p.items : [];
    if (!rawItems.length) fail("VALIDATION", "Nota belum berisi item.");
    if (rawItems.length > 60) fail("VALIDATION", "Maksimal 60 item per nota.");
    const products = Object.fromEntries(c.s.all("products").map((x) => [x.id, x]));
    const prices = c.s.all("price_history");
    const costs = c.s.all("cost_history");
    const minQty = Number(st.min_qty_banyak || 26);
    const canManual = !!((_b = (_a = c.perms) == null ? void 0 : _a["kasir.harga_manual"]) == null ? void 0 : _b.ubah);
    const items = rawItems.map((r, idx) => {
      const prod = products[str(r.product_id)];
      if (!prod) fail("VALIDATION", `Item ${idx + 1}: produk tidak ditemukan.`);
      if (!bool(prod.aktif) && !offline) fail("VALIDATION", `Item ${idx + 1}: ${prod.nama} sudah nonaktif.`);
      const qty = Math.round(Number(r.qty));
      if (!(qty >= 1 && qty <= 1e6)) fail("VALIDATION", `Item ${idx + 1}: jumlah tidak valid.`);
      const jenis = str(prod.jenis_harga);
      const sisi = jenis === "matriks" && Number(r.sisi) === 2 ? 2 : 1;
      const ukuran = jenis === "cutting" ? Math.max(0, Math.min(3, Math.round(Number(r.ukuran) || 0))) : 0;
      const prow = hargaBerlaku(prices.filter((x) => x.product_id === prod.id), tanggal);
      const calc = hitungHarga({ jenis, harga: prow, tipe, qty, sisi, ukuran, minQtyBanyak: minQty });
      const clientPrice = Math.round(Number(r.harga_satuan));
      let harga = calc.harga;
      let manual = false;
      if (jenis === "manual" || bool(r.harga_manual)) {
        if (jenis !== "manual" && !canManual) fail("FORBIDDEN", `Item ${idx + 1}: Anda tidak punya izin mengubah harga.`);
        if (!(clientPrice >= 0)) fail("VALIDATION", `Item ${idx + 1}: isi harga.`);
        harga = clientPrice;
        manual = true;
      } else if (offline && clientPrice >= 0 && clientPrice !== calc.harga) {
        harga = clientPrice;
      }
      if (harga == null) fail("VALIDATION", `Item ${idx + 1}: ${prod.nama} belum punya harga yang berlaku.`);
      const cost = costs.filter((x) => x.product_id === prod.id && str(x.berlaku_mulai) <= tanggal).sort((a, b) => str(b.berlaku_mulai).localeCompare(str(a.berlaku_mulai)))[0];
      return {
        id: `${id}-i${idx + 1}`,
        order_id: id,
        product_id: prod.id,
        nama_produk: prod.nama,
        keterangan: str(r.keterangan).slice(0, 200),
        qty,
        sisi,
        ukuran_cutting: ukuran,
        klik: jenis === "matriks" ? qty * sisi : qty,
        tier: manual ? "manual" : str(calc.tier),
        harga_satuan: harga,
        harga_beli: cost ? Number(cost.harga_beli) : null,
        harga_manual: manual,
        subtotal: harga * qty,
        mesin_id: str(prod.mesin_id),
        status_produksi: "antrian",
        operator_id: "",
        selesai_at: "",
        price_version_id: str(prow == null ? void 0 : prow.id)
      };
    });
    const total = items.reduce((a, i) => a + i.subtotal, 0);
    const dev = deviceRow(c);
    const kodeDev = dev && dev.status === "disetujui" ? str(dev.kode_pc) : "";
    const prefix = st.prefix_nota || "FT";
    const used = new Set(c.s.all("orders").map((o) => str(o.nomor)));
    let kode = kodeDev, no = 0, nomor = "", renomor = false;
    if (kodeDev && str(p.kode_pc) === kodeDev && Number(p.no_urut) > 0) {
      no = Math.round(Number(p.no_urut));
      nomor = formatNota(prefix, kode, tanggal, no);
      if (used.has(nomor)) renomor = true;
    } else if (offline) {
      fail("VALIDATION", "Perangkat ini tidak terdaftar, jadi tidak bisa membuat nota offline.");
    }
    if (!nomor || renomor) {
      if (!kode) kode = (st.kode_pc_web || "W").toUpperCase();
      const key = counterKey(kode, tanggal);
      let n = Number(((_c = c.s.all("counters").find((r) => r.key === key)) == null ? void 0 : _c.value) || 0);
      do {
        n++;
        nomor = formatNota(prefix, kode, tanggal, n);
      } while (used.has(nomor));
      no = n;
    }
    bumpCounter(c, counterKey(kode, tanggal), no);
    const now = iso(c.env);
    const order = {
      id,
      nomor,
      tanggal,
      kode_pc: kode,
      no_urut: no,
      customer_id: cust.id,
      cs_id: str(c.user.id),
      total,
      terbayar: 0,
      sisa: total,
      status_bayar: statusBayar(total, 0),
      status_ambil: "belum",
      tgl_ambil: "",
      batal: false,
      alasan_batal: "",
      dibuat_offline: offline,
      catatan: str(p.catatan).slice(0, 300),
      desain: str(p.desain).slice(0, 200),
      janji_selesai: str(p.janji_selesai).slice(0, 20),
      created_at: offline && str(p.created_at) ? str(p.created_at) : now,
      created_by: str(c.user.id),
      updated_at: now,
      updated_by: str(c.user.id)
    };
    c.s.insert("orders", order);
    items.forEach((i) => c.s.insert("order_items", { ...i, created_at: now, created_by: str(c.user.id), updated_at: now, updated_by: str(c.user.id) }));
    const pay = p.payment;
    if (pay && Number(pay.nominal) > 0 && ((_e = (_d = c.perms) == null ? void 0 : _d.kasir) == null ? void 0 : _e.tambah)) {
      const method = c.s.all("payment_methods").find((m) => m.id === pay.method_id) || fail("VALIDATION", "Pilih metode pembayaran.");
      const nominal = Math.min(Math.round(Number(pay.nominal)), total);
      c.s.insert("payments", { id: `${id}-p1`, order_id: id, tanggal, nominal, method_id: method.id, kasir_id: str(c.user.id), catatan: "Bayar saat order", ...stamp(c, true) });
      recalcOrder(c, id);
      ext.hooks.onPayment(c, id);
    }
    log(c, "nota_baru", "orders", id, `Nota ${nomor} ${cust.nama}: ${items.length} item, total ${total.toLocaleString("id-ID")}${offline ? " \u2014 dibuat offline" : ""}${renomor ? ` \u2014 nomor diganti dari ${formatNota(prefix, kodeDev, tanggal, Math.round(Number(p.no_urut)))}` : ""}`);
    return { ...orderDetail(c, id), renomor, nomor_awal: renomor ? formatNota(prefix, kodeDev, tanggal, Math.round(Number(p.no_urut))) : "" };
  }
  var MASTER = {
    customers: { perm: "master.konsumen", label: "konsumen", prefix: "cus", required: ["nama"] },
    suppliers: { perm: "master.supplier", label: "supplier", prefix: "sup", required: ["nama"] },
    machines: { perm: "master.mesin", label: "mesin", prefix: "mes", required: ["nama"] },
    payment_methods: { perm: "master.metode", label: "metode bayar", prefix: "pay", required: ["nama"] }
  };
  function productWithPrice(s, p, today, prices) {
    const rows = (prices || s.all("price_history")).filter((r) => r.product_id === p.id);
    const harga = hargaBerlaku(rows, today);
    const next = rows.filter((r) => r.berlaku_mulai > today).sort((a, b) => a.berlaku_mulai.localeCompare(b.berlaku_mulai))[0] || null;
    return { ...p, harga, harga_berikutnya: next };
  }
  function tiersFrom(p) {
    const o = {};
    TIERS.forEach((t) => o[t.key] = numOrNull(p[t.key]));
    return o;
  }
  function addPrice(c, productId, mulai, tiers, catatan) {
    if (!isYmd(mulai)) fail("VALIDATION", "Tanggal berlaku tidak valid.");
    const rows = c.s.all("price_history").filter((r) => r.product_id === productId).sort((a, b) => str(b.berlaku_mulai).localeCompare(str(a.berlaku_mulai)));
    const latest = rows[0];
    if (latest && mulai < str(latest.berlaku_mulai)) fail("VALIDATION", `Tanggal berlaku harus sama atau setelah harga terakhir (${latest.berlaku_mulai}).`);
    if (Object.values(tiers).every((v) => v == null)) fail("VALIDATION", "Isi minimal satu harga.");
    if (latest && mulai === str(latest.berlaku_mulai)) {
      return { row: c.s.update("price_history", "id", str(latest.id), { ...tiers, catatan: catatan || str(latest.catatan), ...stamp(c, false) }), koreksi: true, sebelum: latest };
    }
    if (latest && !str(latest.berlaku_sampai)) c.s.update("price_history", "id", str(latest.id), { berlaku_sampai: addDays(mulai, -1), ...stamp(c, false) });
    const row = c.s.insert("price_history", { id: newId(c.env, "prc"), product_id: productId, berlaku_mulai: mulai, berlaku_sampai: "", ...tiers, catatan, ...stamp(c, true) });
    return { row, koreksi: false, sebelum: latest };
  }
  function pctLabel(before, after) {
    const a = Number(before == null ? void 0 : before.rb), b = Number(after == null ? void 0 : after.rb);
    if (!a || !b) return "";
    const pct = (b - a) / a * 100;
    return ` (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)`;
  }
  var handlers = {
    ping: { auth: false, fn: (c) => ({ ok: true, version: API_VERSION, time: iso(c.env), nama_usaha: str(settingsMap(c.s).nama_usaha) }) },
    /** Status perangkat ini sebelum login (dipakai layar pendaftaran aplikasi desktop). Hanya untuk perangkat pemanggil sendiri. */
    "device.check": {
      auth: false,
      fn: (c) => {
        const d = deviceRow(c);
        return d ? { terdaftar: true, status: d.status, kode_pc: d.kode_pc, nama: d.nama, lokasi: d.lokasi, role_izin: parseRoles(d.role_izin) } : { terdaftar: false };
      }
    },
    "auth.login": {
      auth: false,
      fn: (c, p) => {
        const username = str(p.username).toLowerCase();
        const user = c.s.all("users").find((u) => str(u.username).toLowerCase() === username);
        if (!user || !bool(user.aktif) || hashPassword(str(p.password), str(user.salt)) !== user.password_hash) {
          fail("LOGIN_FAILED", "Username atau password salah.");
        }
        checkHours(c, user);
        c.s.withLock(() => checkDevice(c, user, true, cleanInfo(p.device)));
        c.user = user;
        const ses = c.s.withLock(() => makeSession(c, user));
        log(c, "login", "users", str(user.id), "Login berhasil");
        return ses;
      }
    },
    "auth.me": { auth: true, fn: (c) => ({ user: publicUser(c.user), permissions: c.perms }) },
    "auth.logout": {
      auth: true,
      fn: (c) => {
        c.s.remove("sessions", "token_hash", sha256("tok:" + c.req.token));
        return { ok: true };
      }
    },
    "auth.changePassword": {
      auth: true,
      fn: (c, p) => {
        if (hashPassword(str(p.lama), str(c.user.salt)) !== c.user.password_hash) fail("VALIDATION", "Password lama salah.");
        if (str(p.baru).length < 6) fail("VALIDATION", "Password baru minimal 6 karakter.");
        const salt = c.env.uuid();
        c.s.update("users", "id", str(c.user.id), { salt, password_hash: hashPassword(str(p.baru), salt), harus_ganti_password: false, ...stamp(c, false) });
        log(c, "ganti_password", "users", str(c.user.id), "Mengganti password sendiri");
        return { ok: true };
      }
    },
    // ----- perangkat -----
    "device.list": {
      auth: true,
      fn: (c) => {
        need(c, "pengaturan.perangkat");
        const mine = deviceRow(c);
        return c.s.all("devices").map(({ device_hash: _h, ...d }) => ({ ...d, is_this_device: !!mine && d.id === mine.id }));
      }
    },
    "device.status": {
      auth: true,
      fn: (c) => {
        const d = deviceRow(c);
        return d ? { terdaftar: true, status: d.status, kode_pc: d.kode_pc, nama: d.nama, lokasi: d.lokasi, role_izin: parseRoles(d.role_izin), printer_koneksi: d.printer_koneksi, printer_alamat: d.printer_alamat, lebar_kertas: d.lebar_kertas, laci_otomatis: d.laci_otomatis } : { terdaftar: false };
      }
    },
    "device.registerThis": {
      auth: true,
      fn: (c, p) => {
        need(c, "pengaturan.perangkat", "tambah");
        if (!c.req.deviceId) fail("VALIDATION", "ID perangkat tidak terbaca.");
        const kode = str(p.kode_pc).toUpperCase();
        if (!/^[A-Z0-9]{1,4}$/.test(kode)) fail("VALIDATION", "Kode PC 1\u20134 huruf/angka, misalnya K1.");
        if (!str(p.nama)) fail("VALIDATION", "Nama perangkat wajib diisi.");
        return c.s.withLock(() => {
          const mine = deviceRow(c);
          const dup = c.s.all("devices").find((d) => str(d.kode_pc).toUpperCase() === kode && d.id !== (mine == null ? void 0 : mine.id) && d.status !== "dicabut");
          if (dup) fail("VALIDATION", `Kode PC ${kode} sudah dipakai "${dup.nama}".`);
          if ((mine == null ? void 0 : mine.status) !== "disetujui") checkDeviceLimit(c, str((mine == null ? void 0 : mine.id) || ""));
          const info = cleanInfo(p.info);
          const data = {
            kode_pc: kode,
            nama: str(p.nama),
            jenis: p.jenis === "desktop" ? "desktop" : "web",
            status: "disetujui",
            disetujui_oleh: str(c.user.nama),
            last_seen: iso(c.env),
            lokasi: str(p.lokasi),
            role_izin: cleanRoles(p.role_izin),
            ...info.nama ? { nama_komputer: info.nama } : {},
            ...info.versi ? { versi_app: info.versi } : {}
          };
          let row;
          if (mine) row = c.s.update("devices", "id", str(mine.id), { ...data, ...stamp(c, false) });
          else row = c.s.insert("devices", { id: newId(c.env, "dev"), device_hash: sha256("dev:" + c.req.deviceId), printer_koneksi: "", printer_alamat: "", lebar_kertas: "80", laci_otomatis: false, ...data, ...stamp(c, true) });
          log(c, "daftar_perangkat", "devices", str(row.id), `Mendaftarkan ${str(data.nama)} (${kode})`);
          const { device_hash: _h, ...rest } = row;
          return rest;
        });
      }
    },
    /** Catat buka laci manual dari halaman kasir (aplikasi desktop). */
    "drawer.open": {
      auth: true,
      fn: (c, p) => {
        need(c, "kasir", "tambah");
        const d = deviceRow(c);
        log(c, "buka_laci", "devices", str(d == null ? void 0 : d.id), `Buka laci manual di ${str(d == null ? void 0 : d.kode_pc) || "perangkat tak terdaftar"}`, str(p.alasan).slice(0, 120));
        return { ok: true };
      }
    },
    "device.save": {
      auth: true,
      fn: (c, p) => {
        var _a;
        need(c, "pengaturan.perangkat", "ubah");
        const d = p.device || {};
        const cur = c.s.all("devices").find((x) => x.id === d.id) || fail("NOT_FOUND", "Perangkat tidak ditemukan.");
        const kode = str(d.kode_pc).toUpperCase();
        if (d.status === "disetujui" && !/^[A-Z0-9]{1,4}$/.test(kode)) fail("VALIDATION", "Isi kode PC (misalnya K2) sebelum menyetujui perangkat.");
        if (kode && c.s.all("devices").some((x) => str(x.kode_pc).toUpperCase() === kode && x.id !== d.id && x.status !== "dicabut")) fail("VALIDATION", `Kode PC ${kode} sudah dipakai.`);
        const patch = {
          kode_pc: kode,
          nama: str(d.nama),
          jenis: d.jenis === "desktop" ? "desktop" : "web",
          status: ["menunggu", "disetujui", "dicabut"].includes(d.status) ? d.status : "menunggu",
          printer_koneksi: ["usb", "lan"].includes(d.printer_koneksi) ? d.printer_koneksi : "",
          printer_alamat: str(d.printer_alamat),
          lebar_kertas: ["58", "80"].includes(String(d.lebar_kertas)) ? String(d.lebar_kertas) : "",
          laci_otomatis: bool(d.laci_otomatis),
          lokasi: str(d.lokasi),
          role_izin: cleanRoles(d.role_izin),
          ...stamp(c, false)
        };
        if (patch.status === "disetujui" && cur.status !== "disetujui") {
          checkDeviceLimit(c, str(d.id));
          patch.disetujui_oleh = str(c.user.nama);
        }
        const izin = parseRoles(patch.role_izin);
        if (izin.length && ((_a = deviceRow(c)) == null ? void 0 : _a.id) === d.id && c.user.role !== "owner" && !izin.includes(str(c.user.role))) fail("VALIDATION", "Role Anda tidak termasuk di daftar role PC ini, jadi Anda akan terkunci. Tambahkan role Anda atau minta owner yang mengubah.");
        const row = c.s.update("devices", "id", str(d.id), patch);
        if (patch.status === "dicabut") c.s.all("sessions").filter((x) => x.device_id === d.id).forEach((x) => c.s.remove("sessions", "token_hash", str(x.token_hash)));
        log(c, "ubah_perangkat", "devices", str(d.id), `${patch.nama} (${kode || "-"}): ${patch.status}`);
        const { device_hash: _h, ...rest } = row;
        return rest;
      }
    },
    // ----- master umum -----
    "master.list": {
      auth: true,
      fn: (c, p) => {
        const m = MASTER[p.table] || fail("VALIDATION", "Tabel tidak dikenal.");
        need(c, m.perm);
        return c.s.all(p.table);
      }
    },
    "master.save": {
      auth: true,
      fn: (c, p) => {
        const m = MASTER[p.table] || fail("VALIDATION", "Tabel tidak dikenal.");
        const r = { ...p.record || {} };
        const isNew = !r.id;
        need(c, m.perm, isNew ? "tambah" : "ubah");
        m.required.forEach((k) => {
          if (!str(r[k])) fail("VALIDATION", `Kolom ${k} wajib diisi.`);
        });
        return c.s.withLock(() => {
          const rows = c.s.all(p.table);
          if (rows.some((x) => str(x.nama).toLowerCase() === str(r.nama).toLowerCase() && x.id !== r.id && p.table !== "customers")) fail("VALIDATION", `Nama ${m.label} "${r.nama}" sudah ada.`);
          if (p.table === "customers") {
            if (!str(r.kode)) {
              const max = rows.reduce((a, x) => Math.max(a, Number(x.kode) || 0), 1e3);
              r.kode = String(max + 1);
            }
            if (rows.some((x) => str(x.kode) === str(r.kode) && x.id !== r.id)) fail("VALIDATION", `Kode konsumen ${r.kode} sudah dipakai.`);
            r.tipe = r.tipe === "reseller" ? "reseller" : "enduser";
          }
          if (p.table === "machines" && r.biaya_klik !== void 0) r.biaya_klik = Math.max(0, Number(String(r.biaya_klik).replace(",", ".")) || 0);
          delete r.created_at;
          delete r.created_by;
          Object.keys(r).forEach((k) => {
            if (typeof r[k] === "string") r[k] = r[k].trim();
          });
          let row;
          if (isNew) row = c.s.insert(p.table, { aktif: true, ...r, id: newId(c.env, m.prefix), ...stamp(c, true) });
          else row = c.s.update(p.table, "id", r.id, { ...r, ...stamp(c, false) }) || fail("NOT_FOUND", "Data tidak ditemukan.");
          log(c, isNew ? "tambah" : "ubah", p.table, str(row.id), `${isNew ? "Menambah" : "Mengubah"} ${m.label} ${r.nama}`);
          return row;
        });
      }
    },
    // ----- produk & harga -----
    "products.list": {
      auth: true,
      fn: (c) => {
        need(c, "master.produk");
        const today = c.env.today();
        const prices = c.s.all("price_history");
        return c.s.all("products").map((p) => productWithPrice(c.s, p, today, prices));
      }
    },
    "products.save": {
      auth: true,
      fn: (c, p) => {
        const r = { ...p.product || {} };
        const isNew = !r.id;
        need(c, "master.produk", isNew ? "tambah" : "ubah");
        if (!str(r.kode)) fail("VALIDATION", "Kode produk wajib diisi.");
        if (!str(r.nama)) fail("VALIDATION", "Nama produk wajib diisi.");
        if (!["matriks", "cutting", "tetap", "manual"].includes(r.jenis_harga)) fail("VALIDATION", "Pilih jenis harga.");
        return c.s.withLock(() => {
          if (c.s.all("products").some((x) => str(x.kode).toLowerCase() === str(r.kode).toLowerCase() && x.id !== r.id)) fail("VALIDATION", `Kode produk ${r.kode} sudah dipakai.`);
          const ks = bool(r.kertas_sendiri);
          const data = { kode: str(r.kode), nama: str(r.nama), kategori: str(r.kategori) || (ks ? "Kertas sendiri" : ""), mesin_id: str(r.mesin_id), jenis_harga: r.jenis_harga, satuan: str(r.satuan) || "lembar", aktif: r.aktif !== false, kertas_sendiri: ks };
          if (ks) c.s.all("recipes").filter((x) => x.product_id === r.id).forEach((x) => c.s.remove("recipes", "id", str(x.id)));
          let row;
          if (isNew) row = c.s.insert("products", { id: newId(c.env, "prd"), ...data, ...stamp(c, true) });
          else row = c.s.update("products", "id", r.id, { ...data, ...stamp(c, false) }) || fail("NOT_FOUND", "Produk tidak ditemukan.");
          if (isNew && p.harga && data.jenis_harga !== "manual") {
            const t = tiersFrom(p.harga);
            if (Object.values(t).some((v) => v != null)) addPrice(c, str(row.id), str(p.harga.berlaku_mulai) || c.env.today(), t, "Harga awal");
          }
          log(c, isNew ? "tambah" : "ubah", "products", str(row.id), `${isNew ? "Menambah" : "Mengubah"} produk ${data.kode} ${data.nama}`);
          return productWithPrice(c.s, row, c.env.today());
        });
      }
    },
    "price.history": {
      auth: true,
      fn: (c, p) => {
        need(c, "master.produk");
        return c.s.all("price_history").filter((r) => r.product_id === p.product_id).sort((a, b) => str(b.berlaku_mulai).localeCompare(str(a.berlaku_mulai)));
      }
    },
    "price.add": {
      auth: true,
      fn: (c, p) => {
        need(c, "master.produk", "ubah");
        const prod = c.s.all("products").find((x) => x.id === p.product_id) || fail("NOT_FOUND", "Produk tidak ditemukan.");
        return c.s.withLock(() => {
          const mulai = str(p.berlaku_mulai) || c.env.today();
          const res = addPrice(c, str(p.product_id), mulai, tiersFrom(p), str(p.catatan));
          log(
            c,
            res.koreksi ? "koreksi_harga" : "harga_baru",
            "price_history",
            str(res.row.id),
            `${res.koreksi ? "Koreksi" : "Harga baru"} ${prod.nama} berlaku ${mulai}${pctLabel(res.sebelum, res.row)}`,
            str(p.catatan)
          );
          return res.row;
        });
      }
    },
    "products.import": {
      auth: true,
      fn: (c, p) => {
        need(c, "master.produk", "tambah");
        need(c, "master.produk", "ubah");
        const mulai = str(p.berlaku_mulai) || c.env.today();
        const rows = Array.isArray(p.rows) ? p.rows : [];
        if (!rows.length) fail("VALIDATION", "File tidak berisi baris produk.");
        const machines = c.s.all("machines");
        const res = { dibuat: 0, diperbarui: 0, harga: 0, dilewati: [] };
        c.s.withLock(() => {
          rows.forEach((r, i) => {
            const kode = str(r.kode), nama = str(r.nama);
            if (!kode || !nama) {
              res.dilewati.push(`Baris ${i + 2}: kode/nama kosong`);
              return;
            }
            const jenis = ["matriks", "cutting", "tetap", "manual"].includes(str(r.jenis_harga)) ? str(r.jenis_harga) : "matriks";
            let mesinId = "";
            const mesinNama = str(r.mesin);
            if (mesinNama) {
              let m = machines.find((x) => str(x.nama).toLowerCase() === mesinNama.toLowerCase());
              if (!m) {
                m = c.s.insert("machines", { id: newId(c.env, "mes"), nama: mesinNama, pakai_counter: false, aktif: true, ...stamp(c, true) });
                machines.push(m);
              }
              mesinId = str(m.id);
            }
            const ks = r.kertas_sendiri === void 0 || r.kertas_sendiri === "" ? /(^|\s)ks(\s|$)/i.test(nama) : bool(r.kertas_sendiri);
            const data = { kode, nama, kategori: str(r.kategori) || (ks ? "Kertas sendiri" : ""), mesin_id: mesinId, jenis_harga: jenis, satuan: str(r.satuan) || "lembar", aktif: r.aktif === void 0 || r.aktif === "" ? true : bool(r.aktif), kertas_sendiri: ks };
            let prod = c.s.all("products").find((x) => str(x.kode).toLowerCase() === kode.toLowerCase());
            if (prod) {
              c.s.update("products", "id", str(prod.id), { ...data, ...stamp(c, false) });
              res.diperbarui++;
            } else {
              prod = c.s.insert("products", { id: newId(c.env, "prd"), ...data, ...stamp(c, true) });
              res.dibuat++;
            }
            const t = tiersFrom(r);
            if (jenis !== "manual" && Object.values(t).some((v) => v != null)) {
              const cur = hargaBerlaku(c.s.all("price_history").filter((x) => x.product_id === prod.id), mulai);
              const same = cur && TIERS.every((tt) => {
                var _a, _b;
                return ((_a = cur[tt.key]) != null ? _a : null) === ((_b = t[tt.key]) != null ? _b : null);
              });
              if (!same) {
                try {
                  addPrice(c, str(prod.id), mulai, t, "Import Excel");
                  res.harga++;
                } catch (e) {
                  res.dilewati.push(`Baris ${i + 2} (${kode}): ${e.message}`);
                }
              }
            }
          });
        });
        log(c, "import", "products", "", `Import produk: ${res.dibuat} baru, ${res.diperbarui} diperbarui, ${res.harga} harga baru (berlaku ${mulai})`);
        return res;
      }
    },
    // ----- user & role -----
    "users.list": { auth: true, fn: (c) => {
      need(c, "pengaturan.user");
      return c.s.all("users").map(publicUser);
    } },
    "users.save": {
      auth: true,
      fn: (c, p) => {
        const u = { ...p.user || {} };
        const isNew = !u.id;
        need(c, "pengaturan.user", isNew ? "tambah" : "ubah");
        const username = str(u.username).toLowerCase();
        if (!/^[a-z0-9._-]{3,30}$/.test(username)) fail("VALIDATION", "Username 3\u201330 karakter: huruf kecil, angka, titik, minus.");
        if (!str(u.nama)) fail("VALIDATION", "Nama wajib diisi.");
        if (!["owner", "admin", "cs", "kasir", "operator", "keuangan"].includes(u.role)) fail("VALIDATION", "Role tidak dikenal.");
        if (u.role === "owner" && c.user.role !== "owner") fail("FORBIDDEN", "Hanya owner yang bisa membuat atau mengubah akun owner.");
        if (isNew && str(p.password).length < 6) fail("VALIDATION", "Password minimal 6 karakter.");
        return c.s.withLock(() => {
          const users = c.s.all("users");
          if (users.some((x) => str(x.username).toLowerCase() === username && x.id !== u.id)) fail("VALIDATION", `Username ${username} sudah dipakai.`);
          const cur = users.find((x) => x.id === u.id);
          if ((cur == null ? void 0 : cur.role) === "owner" && c.user.role !== "owner") fail("FORBIDDEN", "Hanya owner yang bisa mengubah akun owner.");
          const aktif = u.aktif !== false;
          if (cur && cur.role === "owner" && (u.role !== "owner" || !aktif) && users.filter((x) => x.role === "owner" && bool(x.aktif)).length <= 1) {
            fail("VALIDATION", "Harus ada minimal satu owner aktif.");
          }
          const data = {
            username,
            nama: str(u.nama),
            role: u.role,
            khusus_kantor: bool(u.khusus_kantor),
            aktif,
            jam_login_dari: str(u.jam_login_dari),
            jam_login_sampai: str(u.jam_login_sampai)
          };
          if (str(p.password)) {
            if (str(p.password).length < 6) fail("VALIDATION", "Password minimal 6 karakter.");
            const salt = c.env.uuid();
            Object.assign(data, { salt, password_hash: hashPassword(str(p.password), salt), harus_ganti_password: true });
          }
          let row;
          if (isNew) row = c.s.insert("users", { id: newId(c.env, "usr"), ...data, ...stamp(c, true) });
          else row = c.s.update("users", "id", u.id, { ...data, ...stamp(c, false) }) || fail("NOT_FOUND", "User tidak ditemukan.");
          if (!aktif) c.s.all("sessions").filter((x) => x.user_id === row.id).forEach((x) => c.s.remove("sessions", "token_hash", str(x.token_hash)));
          log(c, isNew ? "tambah" : "ubah", "users", str(row.id), `${isNew ? "Menambah" : "Mengubah"} user ${username} (${u.role})${str(p.password) && !isNew ? ", reset password" : ""}`);
          return publicUser(row);
        });
      }
    },
    "roles.get": {
      auth: true,
      fn: (c) => {
        need(c, "pengaturan.role");
        const out = {};
        ["owner", "admin", "cs", "kasir", "operator", "keuangan"].forEach((r) => out[r] = permsFor(c.s, r));
        return out;
      }
    },
    "roles.save": {
      auth: true,
      fn: (c, p) => {
        need(c, "pengaturan.role", "ubah");
        if (p.role === "owner") fail("VALIDATION", "Hak akses owner selalu penuh.");
        if (p.role === "admin" && c.user.role !== "owner") fail("FORBIDDEN", "Hanya owner yang bisa mengubah hak akses admin.");
        const clean = {};
        MODULES.forEach((m) => {
          const v = (p.permissions || {})[m.key] || {};
          clean[m.key] = { lihat: !!v.lihat, tambah: !!v.tambah, ubah: !!v.ubah, hapus: !!v.hapus, ekspor: !!v.ekspor };
        });
        c.s.withLock(() => {
          const exists = c.s.all("role_permissions").some((r) => r.role === p.role);
          if (exists) c.s.update("role_permissions", "role", p.role, { permissions: clean, updated_at: iso(c.env), updated_by: str(c.user.id) });
          else c.s.insert("role_permissions", { role: p.role, permissions: clean, updated_at: iso(c.env), updated_by: str(c.user.id) });
        });
        log(c, "ubah_hak_akses", "role_permissions", p.role, `Mengubah hak akses role ${p.role}`);
        return clean;
      }
    },
    // ----- kasir & order (Tahap 2) -----
    "pos.bootstrap": {
      auth: true,
      fn: (c) => {
        var _a, _b, _c, _d, _e, _f, _g;
        if (!((_b = (_a = c.perms) == null ? void 0 : _a.fo) == null ? void 0 : _b.lihat) && !((_d = (_c = c.perms) == null ? void 0 : _c.kasir) == null ? void 0 : _d.lihat)) fail("FORBIDDEN", "Anda tidak punya akses untuk tindakan ini.");
        const today = c.env.today();
        const prices = c.s.all("price_history");
        const st = settingsMap(c.s);
        const dev = deviceRow(c);
        const kode = dev && dev.status === "disetujui" ? str(dev.kode_pc) : "";
        const counter = kode ? Number(((_e = c.s.all("counters").find((r) => r.key === counterKey(kode, today))) == null ? void 0 : _e.value) || 0) : 0;
        return {
          today,
          settings: st,
          device: dev ? { kode_pc: kode, nama: dev.nama, status: dev.status, printer_koneksi: dev.printer_koneksi, printer_alamat: dev.printer_alamat, lebar_kertas: dev.lebar_kertas, laci_otomatis: bool(dev.laci_otomatis) } : null,
          counter: { key: kode ? counterKey(kode, today) : "", value: counter },
          products: c.s.all("products").filter((p) => bool(p.aktif)).map((p) => productWithPrice(c.s, p, today, prices)),
          // harga terjadwal ikut dikirim supaya saat offline lewat tengah malam harga tetap benar
          price_rows: prices.filter((r) => !str(r.berlaku_sampai) || str(r.berlaku_sampai) >= addDays(today, -1)),
          customers: c.s.all("customers").filter((x) => bool(x.aktif)).map((x) => ({ id: x.id, kode: x.kode, nama: x.nama, telp: x.telp, tipe: x.tipe })),
          payment_methods: c.s.all("payment_methods").filter((x) => bool(x.aktif)),
          machines: c.s.all("machines"),
          can_manual: !!((_g = (_f = c.perms) == null ? void 0 : _f["kasir.harga_manual"]) == null ? void 0 : _g.ubah)
        };
      }
    },
    "orders.create": {
      auth: true,
      fn: (c, p) => {
        need(c, "fo", "tambah");
        return c.s.withLock(() => createOrder(c, p));
      }
    },
    "orders.list": {
      auth: true,
      fn: (c, p) => {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (!((_b = (_a = c.perms) == null ? void 0 : _a.order) == null ? void 0 : _b.lihat) && !((_d = (_c = c.perms) == null ? void 0 : _c.piutang) == null ? void 0 : _d.lihat) && !((_f = (_e = c.perms) == null ? void 0 : _e.kasir) == null ? void 0 : _f.lihat) && !((_h = (_g = c.perms) == null ? void 0 : _g.fo) == null ? void 0 : _h.lihat)) fail("FORBIDDEN", "Anda tidak punya akses untuk tindakan ini.");
        const from = str(p.from), to = str(p.to), piutang = !!p.piutang;
        const cust = Object.fromEntries(c.s.all("customers").map((x) => [x.id, x]));
        const users = Object.fromEntries(c.s.all("users").map((x) => [x.id, x.nama]));
        const orders = c.s.all("orders").filter((o) => piutang ? !bool(o.batal) && Number(o.sisa) > 0 : (!from || str(o.tanggal) >= from) && (!to || str(o.tanggal) <= to));
        const ids = new Set(orders.map((o) => o.id));
        const itemsBy = {};
        c.s.all("order_items").forEach((it) => {
          var _a2;
          if (ids.has(it.order_id)) (itemsBy[_a2 = str(it.order_id)] || (itemsBy[_a2] = [])).push(it);
        });
        return orders.map((o) => {
          const its = itemsBy[str(o.id)] || [];
          const cu = cust[str(o.customer_id)] || {};
          return {
            ...o,
            customer_nama: str(cu.nama),
            customer_telp: str(cu.telp),
            customer_tipe: str(cu.tipe),
            cs_nama: str(users[str(o.cs_id)]),
            item_count: its.length,
            ringkas: its.map((i) => i.nama_produk).filter((v, i, a) => a.indexOf(v) === i).join(", ").slice(0, 120),
            produksi_selesai: its.length > 0 && its.every((i) => i.status_produksi === "selesai")
          };
        });
      }
    },
    "orders.get": {
      auth: true,
      fn: (c, p) => {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (!((_b = (_a = c.perms) == null ? void 0 : _a.order) == null ? void 0 : _b.lihat) && !((_d = (_c = c.perms) == null ? void 0 : _c.piutang) == null ? void 0 : _d.lihat) && !((_f = (_e = c.perms) == null ? void 0 : _e.kasir) == null ? void 0 : _f.lihat) && !((_h = (_g = c.perms) == null ? void 0 : _g.fo) == null ? void 0 : _h.lihat)) fail("FORBIDDEN", "Anda tidak punya akses untuk tindakan ini.");
        return orderDetail(c, str(p.order_id));
      }
    },
    "orders.pay": {
      auth: true,
      fn: (c, p) => {
        var _a, _b, _c, _d, _e, _f;
        if (!((_b = (_a = c.perms) == null ? void 0 : _a.kasir) == null ? void 0 : _b.tambah) && !((_d = (_c = c.perms) == null ? void 0 : _c.order) == null ? void 0 : _d.ubah) && !((_f = (_e = c.perms) == null ? void 0 : _e.piutang) == null ? void 0 : _f.ubah)) fail("FORBIDDEN", "Anda tidak punya akses untuk mencatat pembayaran.");
        return c.s.withLock(() => {
          const pid = str(p.payment_id) || newId(c.env, "pmt");
          const exist = c.s.all("payments").find((x) => x.id === pid);
          if (exist) return { ...orderDetail(c, str(exist.order_id)), duplikat: true };
          const o = c.s.all("orders").find((x) => x.id === p.order_id) || fail("NOT_FOUND", "Nota tidak ditemukan. Bila nota dibuat saat offline, tunggu sampai nota itu terkirim.");
          if (bool(o.batal)) fail("VALIDATION", "Nota ini sudah dibatalkan.");
          const nominal = Math.round(Number(p.nominal) || 0);
          if (nominal <= 0) fail("VALIDATION", "Nominal pembayaran harus lebih dari 0.");
          const offline = bool(p.dibuat_offline);
          if (!offline && nominal > Number(o.sisa)) fail("VALIDATION", `Nominal melebihi sisa tagihan (${Number(o.sisa).toLocaleString("id-ID")}).`);
          const method = c.s.all("payment_methods").find((m) => m.id === p.method_id) || fail("VALIDATION", "Pilih metode pembayaran.");
          const tanggal = offline && isYmd(str(p.tanggal)) && str(p.tanggal) <= c.env.today() ? str(p.tanggal) : c.env.today();
          c.s.insert("payments", { id: pid, order_id: o.id, tanggal, nominal, method_id: method.id, kasir_id: str(c.user.id), catatan: str(p.catatan), ...stamp(c, true) });
          recalcOrder(c, str(o.id));
          ext.hooks.onPayment(c, str(o.id));
          log(c, "bayar", "orders", str(o.id), `Pembayaran ${nominal.toLocaleString("id-ID")} (${method.nama}) untuk ${o.id}${offline ? " \u2014 dibuat offline" : ""}`);
          return orderDetail(c, str(o.id));
        });
      }
    },
    "orders.ambil": {
      auth: true,
      fn: (c, p) => {
        need(c, "order", "ubah");
        return c.s.withLock(() => {
          const o = c.s.all("orders").find((x) => x.id === p.order_id) || fail("NOT_FOUND", "Nota tidak ditemukan.");
          const ambil = p.diambil !== false;
          if (ambil && Number(o.sisa) > 0 && !str(p.alasan)) fail("NEED_REASON", "Nota masih ada sisa tagihan. Isi alasan bila tetap diserahkan.");
          c.s.update("orders", "id", str(o.id), { status_ambil: ambil ? "diambil" : "belum", tgl_ambil: ambil ? iso(c.env) : "", ...stamp(c, false) });
          if (ambil) ext.hooks.onPickup(c, str(o.id));
          log(c, ambil ? "ambil" : "batal_ambil", "orders", str(o.id), `${ambil ? "Diambil" : "Batal diambil"}: ${o.id}`, str(p.alasan));
          return orderDetail(c, str(o.id));
        });
      }
    },
    "orders.cancel": {
      auth: true,
      fn: (c, p) => {
        need(c, "order", "hapus");
        if (!str(p.alasan)) fail("VALIDATION", "Isi alasan pembatalan.");
        return c.s.withLock(() => {
          const o = c.s.all("orders").find((x) => x.id === p.order_id) || fail("NOT_FOUND", "Nota tidak ditemukan.");
          if (Number(o.terbayar) > 0) fail("VALIDATION", "Nota sudah ada pembayaran. Pengembalian uang dicatat di modul Pengeluaran (Tahap 5), baru nota bisa dibatalkan.");
          c.s.update("orders", "id", str(o.id), { batal: true, alasan_batal: str(p.alasan), sisa: 0, status_bayar: "batal", ...stamp(c, false) });
          c.s.all("order_items").filter((i) => i.order_id === o.id).forEach((i) => c.s.update("order_items", "id", str(i.id), { status_produksi: "batal" }));
          log(c, "batal_nota", "orders", str(o.id), `Membatalkan ${o.id} senilai ${Number(o.total).toLocaleString("id-ID")}`, str(p.alasan));
          return orderDetail(c, str(o.id));
        });
      }
    },
    // ----- produksi (Tahap 4) -----
    "production.list": {
      auth: true,
      fn: (c, p) => {
        var _a;
        need(c, "produksi");
        const doneDays = Math.max(0, Math.min(30, Number((_a = p.done_days) != null ? _a : 1)));
        const since = addDays(c.env.today(), -doneDays);
        const orders = Object.fromEntries(c.s.all("orders").filter((o) => !bool(o.batal)).map((o) => [o.id, o]));
        const cust = Object.fromEntries(c.s.all("customers").map((x) => [x.id, x.nama]));
        const users = Object.fromEntries(c.s.all("users").map((x) => [x.id, x.nama]));
        const jenis = Object.fromEntries(c.s.all("products").map((x) => [x.id, x.jenis_harga]));
        const ksProd = new Set(c.s.all("products").filter((x) => bool(x.kertas_sendiri)).map((x) => str(x.id)));
        const mesinNama = Object.fromEntries(c.s.all("machines").map((x) => [x.id, x.nama]));
        return c.s.all("order_items").filter((i) => {
          const o = orders[str(i.order_id)];
          if (!o || i.status_produksi === "batal") return false;
          if (i.status_produksi !== "selesai") return true;
          return o.status_ambil !== "diambil" && str(i.selesai_at).slice(0, 10) >= since;
        }).map((i) => {
          const o = orders[str(i.order_id)];
          return {
            id: i.id,
            order_id: i.order_id,
            nomor: o.nomor,
            tanggal: o.tanggal,
            order_created: o.created_at,
            customer: str(cust[str(o.customer_id)]),
            fo: str(users[str(o.cs_id)]),
            desain: o.desain,
            janji_selesai: o.janji_selesai,
            catatan: o.catatan,
            status_bayar: o.status_bayar,
            nama_produk: i.nama_produk,
            keterangan: i.keterangan,
            qty: i.qty,
            sisi: i.sisi,
            klik: i.klik,
            ukuran_cutting: i.ukuran_cutting,
            jenis_harga: str(jenis[str(i.product_id)]),
            kertas_sendiri: ksProd.has(str(i.product_id)),
            mesin_id: i.mesin_id,
            mesin_nama: str(mesinNama[str(i.mesin_id)]),
            status_produksi: i.status_produksi,
            operator: str(users[str(i.operator_id)]),
            selesai_at: i.selesai_at,
            updated_at: i.updated_at
          };
        });
      }
    },
    "production.move": {
      auth: true,
      fn: (c, p) => {
        need(c, "produksi", "ubah");
        const to = str(p.status);
        if (!["antrian", "proses", "selesai"].includes(to)) fail("VALIDATION", "Status tidak dikenal.");
        return c.s.withLock(() => {
          const ids = Array.isArray(p.item_ids) ? p.item_ids.map(str) : [str(p.item_id)];
          const items = c.s.all("order_items").filter((i) => ids.includes(str(i.id)));
          if (!items.length) fail("NOT_FOUND", "Item tidak ditemukan.");
          items.forEach((i) => {
            if (i.status_produksi === "batal") fail("VALIDATION", "Item dari nota yang dibatalkan.");
            c.s.update("order_items", "id", str(i.id), {
              status_produksi: to,
              operator_id: to === "antrian" ? "" : str(i.operator_id) || str(c.user.id),
              selesai_at: to === "selesai" ? iso(c.env) : "",
              ...stamp(c, false)
            });
          });
          if (to === "selesai") ext.hooks.onProductionDone(c, ids);
          log(c, "produksi", "order_items", ids.join(","), `${items.map((i) => i.nama_produk).join(", ")} \u2192 ${to}`);
          return { ok: true, count: items.length };
        });
      }
    },
    // ----- counter mesin (Tahap 4) -----
    "counter.list": {
      auth: true,
      fn: (c, p) => {
        need(c, "mesin");
        const from = str(p.from) || addDays(c.env.today(), -30), to = str(p.to) || c.env.today();
        const orders = Object.fromEntries(c.s.all("orders").filter((o) => !bool(o.batal)).map((o) => [o.id, o.tanggal]));
        const fo = {};
        c.s.all("order_items").forEach((i) => {
          const t = str(orders[str(i.order_id)]);
          if (!t || t < from || t > to) return;
          const k = `${t}|${i.mesin_id}`;
          fo[k] = (fo[k] || 0) + Number(i.klik || 0);
        });
        const machines = c.s.all("machines").filter((m) => bool(m.pakai_counter));
        const rows = c.s.all("machine_counters").filter((r) => str(r.tanggal) >= from && str(r.tanggal) <= to);
        Object.keys(fo).forEach((k) => {
          const [t, m] = k.split("|");
          if (machines.some((x) => x.id === m) && !rows.some((r) => r.tanggal === t && r.mesin_id === m)) rows.push({ id: "", tanggal: t, mesin_id: m });
        });
        const last = (mesin, before) => c.s.all("machine_counters").filter((r) => r.mesin_id === mesin && str(r.tanggal) < before && r.counter_akhir != null).sort((a, b) => str(b.tanggal).localeCompare(str(a.tanggal)))[0];
        return {
          machines: machines.map((m) => ({ id: m.id, nama: m.nama, aktif: bool(m.aktif) })),
          rows: rows.map((r) => {
            var _a, _b;
            const klikMesin = r.counter_akhir != null && r.counter_awal != null ? Number(r.counter_akhir) - Number(r.counter_awal) : null;
            const reject = Number(r.reject_trouble || 0) + Number(r.reject_operator || 0) + Number(r.reject_fo || 0);
            const klikFo = fo[`${r.tanggal}|${r.mesin_id}`] || 0;
            const batal = Number(r.batal || 0);
            return { ...r, klik_mesin: klikMesin, reject, klik_fo: klikFo, selisih: klikMesin == null ? null : klikMesin - reject - (klikFo - batal), awal_saran: (_b = (_a = last(str(r.mesin_id), str(r.tanggal))) == null ? void 0 : _a.counter_akhir) != null ? _b : null };
          }),
          last_akhir: Object.fromEntries(machines.map((m) => {
            var _a, _b;
            return [m.id, (_b = (_a = last(str(m.id), "9999")) == null ? void 0 : _a.counter_akhir) != null ? _b : null];
          }))
        };
      }
    },
    "counter.save": {
      auth: true,
      fn: (c, p) => {
        const r = p.row || {};
        if (!isYmd(str(r.tanggal))) fail("VALIDATION", "Tanggal tidak valid.");
        if (str(r.tanggal) > c.env.today()) fail("VALIDATION", "Tanggal tidak boleh setelah hari ini.");
        const m = c.s.all("machines").find((x) => x.id === r.mesin_id) || fail("VALIDATION", "Pilih mesin.");
        const n = (k) => {
          const v = numOrNull(r[k]);
          if (v != null && v < 0) fail("VALIDATION", `${k} tidak boleh negatif.`);
          return v;
        };
        const data = {
          tanggal: str(r.tanggal),
          mesin_id: m.id,
          counter_awal: n("counter_awal"),
          counter_akhir: n("counter_akhir"),
          reject_trouble: n("reject_trouble") || 0,
          reject_operator: n("reject_operator") || 0,
          reject_fo: n("reject_fo") || 0,
          batal: n("batal") || 0,
          keterangan: str(r.keterangan).slice(0, 300)
        };
        if (data.counter_awal != null && data.counter_akhir != null && Number(data.counter_akhir) < Number(data.counter_awal)) fail("VALIDATION", "Counter tutup lebih kecil dari counter masuk.");
        return c.s.withLock(() => {
          var _a, _b;
          const ex = c.s.all("machine_counters").find((x) => x.tanggal === data.tanggal && x.mesin_id === data.mesin_id);
          need(c, "mesin", ex ? "ubah" : "tambah");
          const row = ex ? c.s.update("machine_counters", "id", str(ex.id), { ...data, ...stamp(c, false) }) : c.s.insert("machine_counters", { id: newId(c.env, "cnt"), ...data, ...stamp(c, true) });
          log(c, ex ? "ubah" : "tambah", "machine_counters", str(row.id), `Counter ${m.nama} ${data.tanggal}: ${(_a = data.counter_awal) != null ? _a : "-"} \u2192 ${(_b = data.counter_akhir) != null ? _b : "-"}`);
          return row;
        });
      }
    },
    // ----- kas (Tahap 4) -----
    "kas.rekap": {
      auth: true,
      fn: (c, p) => {
        need(c, "kas");
        const t = isYmd(str(p.tanggal)) ? str(p.tanggal) : c.env.today();
        const users = Object.fromEntries(c.s.all("users").map((x) => [x.id, x.nama]));
        const methods = c.s.all("payment_methods");
        const pays = c.s.all("payments").filter((x) => x.tanggal === t);
        const sys = {};
        const cnt = {};
        pays.forEach((x) => {
          const k = `${x.kasir_id}|${x.method_id}`;
          sys[k] = (sys[k] || 0) + Number(x.nominal || 0);
          cnt[k] = (cnt[k] || 0) + 1;
        });
        const deps = c.s.all("cash_deposits").filter((d) => d.tanggal === t);
        const keys = /* @__PURE__ */ new Set([...Object.keys(sys), ...deps.map((d) => `${d.kasir_id}|${d.method_id}`)]);
        const pcOut = c.s.all("petty_cash").filter((x) => x.tanggal === t && !bool(x.deleted)).reduce((a, x) => a + Number(x.keluar || 0), 0);
        return {
          tanggal: t,
          kas_kecil_keluar: pcOut,
          rows: Array.from(keys).map((k) => {
            const [kasir, method] = k.split("|");
            const d = deps.find((x) => x.kasir_id === kasir && x.method_id === method);
            const m = methods.find((x) => x.id === method);
            return {
              kasir_id: kasir,
              kasir_nama: str(users[kasir]) || "(tanpa kasir)",
              method_id: method,
              method_nama: str(m == null ? void 0 : m.nama),
              jenis: str(m == null ? void 0 : m.jenis),
              sistem: sys[k] || 0,
              transaksi: cnt[k] || 0,
              aktual: d ? d.aktual : null,
              selisih: d ? Number(d.aktual) - (sys[k] || 0) : null,
              keterangan: d ? d.keterangan : "",
              dicatat_oleh: d ? str(users[str(d.updated_by)]) : "",
              dicatat_at: d ? d.updated_at : ""
            };
          }).sort((a, b) => a.kasir_nama.localeCompare(b.kasir_nama) || a.method_nama.localeCompare(b.method_nama))
        };
      }
    },
    "kas.setor": {
      auth: true,
      fn: (c, p) => {
        need(c, "kas", "ubah");
        const t = str(p.tanggal);
        if (!isYmd(t)) fail("VALIDATION", "Tanggal tidak valid.");
        const rows = Array.isArray(p.rows) ? p.rows : [];
        return c.s.withLock(() => {
          rows.forEach((r) => {
            if (r.aktual === "" || r.aktual == null) return;
            const aktual = Math.round(Number(r.aktual));
            if (isNaN(aktual) || aktual < 0) fail("VALIDATION", "Nominal aktual tidak valid.");
            const sistem = c.s.all("payments").filter((x) => x.tanggal === t && x.kasir_id === r.kasir_id && x.method_id === r.method_id).reduce((a, x) => a + Number(x.nominal || 0), 0);
            const ex = c.s.all("cash_deposits").find((d) => d.tanggal === t && d.kasir_id === r.kasir_id && d.method_id === r.method_id);
            const data = { tanggal: t, kasir_id: str(r.kasir_id), method_id: str(r.method_id), sistem, aktual, selisih: aktual - sistem, keterangan: str(r.keterangan).slice(0, 300) };
            if (aktual !== sistem && !data.keterangan) fail("VALIDATION", "Ada selisih. Isi keterangan untuk baris yang tidak cocok.");
            if (ex) c.s.update("cash_deposits", "id", str(ex.id), { ...data, ...stamp(c, false) });
            else c.s.insert("cash_deposits", { id: newId(c.env, "dep"), ...data, ...stamp(c, true) });
          });
          log(c, "tutup_kasir", "cash_deposits", t, `Tutup kasir ${t}: ${rows.filter((r) => r.aktual !== "" && r.aktual != null).length} baris`);
          return { ok: true };
        });
      }
    },
    "pettycash.list": {
      auth: true,
      fn: (c, p) => {
        need(c, "kas");
        const all2 = c.s.all("petty_cash").filter((x) => !bool(x.deleted)).sort((a, b) => (str(a.tanggal) + str(a.created_at)).localeCompare(str(b.tanggal) + str(b.created_at)));
        let saldo = 0;
        const users = Object.fromEntries(c.s.all("users").map((x) => [x.id, x.nama]));
        const rows = all2.map((x) => {
          saldo += Number(x.masuk || 0) - Number(x.keluar || 0);
          return { ...x, saldo, oleh: str(users[str(x.created_by)]) };
        });
        const from = str(p.from), to = str(p.to);
        return { saldo, rows: rows.filter((x) => (!from || str(x.tanggal) >= from) && (!to || str(x.tanggal) <= to)) };
      }
    },
    "pettycash.save": {
      auth: true,
      fn: (c, p) => {
        need(c, "kas", "tambah");
        const r = p.row || {};
        if (!isYmd(str(r.tanggal)) || str(r.tanggal) > c.env.today()) fail("VALIDATION", "Tanggal tidak valid.");
        if (!str(r.item)) fail("VALIDATION", "Isi keterangan transaksi.");
        const masuk = Math.round(Number(r.masuk) || 0), keluar = Math.round(Number(r.keluar) || 0);
        if (masuk > 0 === keluar > 0) fail("VALIDATION", "Isi salah satu: uang masuk atau uang keluar.");
        if (masuk < 0 || keluar < 0) fail("VALIDATION", "Nominal tidak boleh negatif.");
        return c.s.withLock(() => {
          const row = c.s.insert("petty_cash", { id: newId(c.env, "kk"), tanggal: str(r.tanggal), item: str(r.item).slice(0, 200), masuk, keluar, keterangan: str(r.keterangan).slice(0, 300), deleted: false, ...stamp(c, true) });
          log(c, "kas_kecil", "petty_cash", str(row.id), `${masuk ? "Masuk" : "Keluar"} ${(masuk || keluar).toLocaleString("id-ID")}: ${r.item}`);
          return row;
        });
      }
    },
    "pettycash.delete": {
      auth: true,
      fn: (c, p) => {
        need(c, "kas", "hapus");
        if (!str(p.alasan)) fail("VALIDATION", "Isi alasan penghapusan.");
        return c.s.withLock(() => {
          const x = c.s.all("petty_cash").find((r) => r.id === p.id) || fail("NOT_FOUND", "Data tidak ditemukan.");
          c.s.update("petty_cash", "id", str(x.id), { deleted: true, ...stamp(c, false) });
          log(c, "hapus", "petty_cash", str(x.id), `Hapus kas kecil ${x.item} (${Number(x.masuk || x.keluar).toLocaleString("id-ID")})`, str(p.alasan));
          return { ok: true };
        });
      }
    },
    // ----- pengeluaran (Tahap 5) -----
    "expense.meta": {
      auth: true,
      fn: (c) => {
        var _a, _b, _c, _d;
        if (!((_b = (_a = c.perms) == null ? void 0 : _a.pengeluaran) == null ? void 0 : _b.lihat) && !((_d = (_c = c.perms) == null ? void 0 : _c.hutang) == null ? void 0 : _d.lihat)) fail("FORBIDDEN", "Anda tidak punya akses untuk tindakan ini.");
        return {
          categories: c.s.all("expense_categories"),
          suppliers: c.s.all("suppliers").filter((x) => bool(x.aktif)).map((x) => ({ id: x.id, nama: x.nama, bahan: x.bahan })),
          products: c.s.all("products").filter((x) => bool(x.aktif)).map((x) => ({ id: x.id, kode: x.kode, nama: x.nama, satuan: x.satuan })),
          machines: c.s.all("machines").filter((x) => bool(x.aktif)).map((x) => ({ id: x.id, nama: x.nama })),
          payment_methods: c.s.all("payment_methods").filter((x) => bool(x.aktif)).map((x) => ({ id: x.id, nama: x.nama, jenis: x.jenis }))
        };
      }
    },
    "expense.category.save": {
      auth: true,
      fn: (c, p) => {
        need(c, "pengeluaran", "ubah");
        const r = p.category || {};
        if (!str(r.nama)) fail("VALIDATION", "Nama kategori wajib diisi.");
        const jenis = ["bahan", "operasional", "gaji", "aset", "klik", "lain"].includes(r.jenis) ? r.jenis : "operasional";
        return c.s.withLock(() => {
          if (c.s.all("expense_categories").some((x) => str(x.nama).toLowerCase() === str(r.nama).toLowerCase() && x.id !== r.id)) fail("VALIDATION", "Kategori sudah ada.");
          const data = { nama: str(r.nama), jenis, aktif: r.aktif !== false };
          const row = r.id ? c.s.update("expense_categories", "id", r.id, { ...data, ...stamp(c, false) }) : c.s.insert("expense_categories", { id: newId(c.env, "cat"), ...data, ...stamp(c, true) });
          log(c, r.id ? "ubah" : "tambah", "expense_categories", str(row.id), `Kategori pengeluaran ${data.nama}`);
          return row;
        });
      }
    },
    "expense.list": {
      auth: true,
      fn: (c, p) => {
        need(c, "pengeluaran");
        const from = str(p.from), to = str(p.to);
        const cats = Object.fromEntries(c.s.all("expense_categories").map((x) => [x.id, x]));
        const sup = Object.fromEntries(c.s.all("suppliers").map((x) => [x.id, x.nama]));
        const met = Object.fromEntries(c.s.all("payment_methods").map((x) => [x.id, x.nama]));
        const users = Object.fromEntries(c.s.all("users").map((x) => [x.id, x.nama]));
        const bills = Object.fromEntries(c.s.all("supplier_bills").map((x) => [x.id, x]));
        return c.s.all("expenses").filter((x) => !bool(x.deleted) && (!from || str(x.tanggal) >= from) && (!to || str(x.tanggal) <= to)).map((x) => {
          var _a, _b, _c;
          return {
            ...x,
            kategori: str((_a = cats[str(x.kategori_id)]) == null ? void 0 : _a.nama),
            kategori_jenis: str((_b = cats[str(x.kategori_id)]) == null ? void 0 : _b.jenis),
            supplier: str(sup[str(x.supplier_id)]),
            metode: str(met[str(x.method_id)]),
            oleh: str(users[str(x.created_by)]),
            sisa_hutang: x.bill_id ? Number(((_c = bills[str(x.bill_id)]) == null ? void 0 : _c.sisa) || 0) : 0
          };
        });
      }
    },
    "expense.save": {
      auth: true,
      fn: (c, p) => {
        need(c, "pengeluaran", "tambah");
        const r = p.expense || {};
        const t = str(r.tanggal);
        if (!isYmd(t) || t > c.env.today()) fail("VALIDATION", "Tanggal tidak valid.");
        const cat = c.s.all("expense_categories").find((x) => x.id === r.kategori_id) || fail("VALIDATION", "Pilih kategori.");
        if (!str(r.item)) fail("VALIDATION", "Isi nama barang / keperluan.");
        const qty = Number(r.qty) || 0, harga = Math.round(Number(r.harga) || 0);
        if (!(qty > 0) || !(harga > 0)) fail("VALIDATION", "Isi jumlah dan harga.");
        const total = Math.round(qty * harga);
        const cara = r.cara_bayar === "hutang" ? "hutang" : "lunas";
        if (cara === "hutang" && !r.supplier_id) fail("VALIDATION", "Pembelian hutang harus memilih supplier.");
        if (cara === "lunas" && !c.s.all("payment_methods").some((m) => m.id === r.method_id)) fail("VALIDATION", "Pilih metode pembayaran.");
        const isi = Number(r.isi_per_satuan) || 0;
        return c.s.withLock(() => {
          const id = newId(c.env, "exp");
          let billId = "";
          if (cara === "hutang") {
            billId = newId(c.env, "bil");
            const jt = isYmd(str(r.jatuh_tempo)) ? str(r.jatuh_tempo) : addDays(t, 30);
            c.s.insert("supplier_bills", { id: billId, tanggal: t, nota: str(r.nota), supplier_id: str(r.supplier_id), expense_id: id, total, terbayar: 0, sisa: total, jatuh_tempo: jt, keterangan: str(r.item), ...stamp(c, true) });
          }
          const row = c.s.insert("expenses", {
            id,
            tanggal: t,
            nota: str(r.nota).slice(0, 80),
            supplier_id: str(r.supplier_id),
            kategori_id: cat.id,
            product_id: str(r.product_id),
            item: str(r.item).slice(0, 200),
            qty,
            satuan: str(r.satuan) || "pcs",
            harga,
            total,
            isi_per_satuan: isi || null,
            mesin_id: str(r.mesin_id),
            cara_bayar: cara,
            method_id: cara === "lunas" ? str(r.method_id) : "",
            bill_id: billId,
            keterangan: str(r.keterangan).slice(0, 300),
            deleted: false,
            ...stamp(c, true)
          });
          let hargaBeli = null;
          if (str(r.product_id) && isi > 0) {
            hargaBeli = Math.round(harga / isi * 100) / 100;
            c.s.insert("cost_history", { id: newId(c.env, "cst"), product_id: str(r.product_id), berlaku_mulai: t, harga_beli: hargaBeli, supplier_id: str(r.supplier_id), sumber: `pembelian ${id}`, ...stamp(c, true) });
          }
          log(c, "pengeluaran", "expenses", id, `${cat.nama}: ${r.item} ${total.toLocaleString("id-ID")} (${cara})${hargaBeli != null ? `, harga beli ${hargaBeli}/satuan` : ""}`);
          return { ...row, harga_beli_baru: hargaBeli };
        });
      }
    },
    "expense.delete": {
      auth: true,
      fn: (c, p) => {
        need(c, "pengeluaran", "hapus");
        if (!str(p.alasan)) fail("VALIDATION", "Isi alasan penghapusan.");
        return c.s.withLock(() => {
          const x = c.s.all("expenses").find((r) => r.id === p.id) || fail("NOT_FOUND", "Data tidak ditemukan.");
          if (str(x.purchase_id)) fail("VALIDATION", "Pengeluaran ini berasal dari Pembelian Bahan. Hapus lewat menu Pembelian Bahan supaya stoknya ikut dikoreksi.");
          if (x.bill_id) {
            const b = c.s.all("supplier_bills").find((r) => r.id === x.bill_id);
            if (b && Number(b.terbayar) > 0) fail("VALIDATION", "Hutang dari pembelian ini sudah dicicil. Hapus tidak diizinkan.");
            if (b) c.s.update("supplier_bills", "id", str(b.id), { sisa: 0, total: 0, keterangan: `DIHAPUS: ${b.keterangan}`, ...stamp(c, false) });
          }
          c.s.update("expenses", "id", str(x.id), { deleted: true, ...stamp(c, false) });
          log(c, "hapus", "expenses", str(x.id), `Hapus pengeluaran ${x.item} ${Number(x.total).toLocaleString("id-ID")}`, str(p.alasan));
          return { ok: true };
        });
      }
    },
    // ----- hutang supplier (Tahap 5) -----
    "bills.list": {
      auth: true,
      fn: (c, p) => {
        need(c, "hutang");
        const sup = Object.fromEntries(c.s.all("suppliers").map((x) => [x.id, x.nama]));
        const met = Object.fromEntries(c.s.all("payment_methods").map((x) => [x.id, x.nama]));
        const users = Object.fromEntries(c.s.all("users").map((x) => [x.id, x.nama]));
        const pays = c.s.all("bill_payments");
        return c.s.all("supplier_bills").filter((b) => Number(b.total) > 0 && (p.semua || Number(b.sisa) > 0 || str(b.updated_at).slice(0, 10) >= addDays(c.env.today(), -60))).map((b) => ({
          ...b,
          supplier: str(sup[str(b.supplier_id)]),
          pembayaran: pays.filter((x) => x.bill_id === b.id).map((x) => ({ ...x, metode: str(met[str(x.method_id)]), oleh: str(users[str(x.created_by)]) }))
        }));
      }
    },
    "bills.save": {
      auth: true,
      fn: (c, p) => {
        need(c, "hutang", "tambah");
        const r = p.bill || {};
        if (!isYmd(str(r.tanggal))) fail("VALIDATION", "Tanggal tidak valid.");
        if (!c.s.all("suppliers").some((x) => x.id === r.supplier_id)) fail("VALIDATION", "Pilih supplier.");
        const total = Math.round(Number(r.total) || 0);
        if (total <= 0) fail("VALIDATION", "Isi total tagihan.");
        return c.s.withLock(() => {
          const row = c.s.insert("supplier_bills", {
            id: newId(c.env, "bil"),
            tanggal: str(r.tanggal),
            nota: str(r.nota),
            supplier_id: str(r.supplier_id),
            expense_id: "",
            total,
            terbayar: 0,
            sisa: total,
            jatuh_tempo: isYmd(str(r.jatuh_tempo)) ? str(r.jatuh_tempo) : addDays(str(r.tanggal), 30),
            keterangan: str(r.keterangan),
            ...stamp(c, true)
          });
          log(c, "hutang_baru", "supplier_bills", str(row.id), `Hutang ${total.toLocaleString("id-ID")} ke ${r.supplier_id}: ${r.keterangan}`);
          return row;
        });
      }
    },
    "bills.pay": {
      auth: true,
      fn: (c, p) => {
        need(c, "hutang", "ubah");
        return c.s.withLock(() => {
          const b = c.s.all("supplier_bills").find((x) => x.id === p.bill_id) || fail("NOT_FOUND", "Tagihan tidak ditemukan.");
          const nominal = Math.round(Number(p.nominal) || 0);
          if (nominal <= 0) fail("VALIDATION", "Isi nominal.");
          if (nominal > Number(b.sisa)) fail("VALIDATION", `Nominal melebihi sisa hutang (${Number(b.sisa).toLocaleString("id-ID")}).`);
          if (!c.s.all("payment_methods").some((m) => m.id === p.method_id)) fail("VALIDATION", "Pilih metode pembayaran.");
          const t = isYmd(str(p.tanggal)) && str(p.tanggal) <= c.env.today() ? str(p.tanggal) : c.env.today();
          c.s.insert("bill_payments", { id: newId(c.env, "bpy"), bill_id: b.id, tanggal: t, nominal, method_id: str(p.method_id), keterangan: str(p.keterangan), ...stamp(c, true) });
          const terbayar = c.s.all("bill_payments").filter((x) => x.bill_id === b.id).reduce((a, x) => a + Number(x.nominal || 0), 0);
          const row = c.s.update("supplier_bills", "id", str(b.id), { terbayar, sisa: Number(b.total) - terbayar, ...stamp(c, false) });
          log(c, "bayar_hutang", "supplier_bills", str(b.id), `Bayar hutang ${nominal.toLocaleString("id-ID")} (${b.nota || b.keterangan})`);
          return row;
        });
      }
    },
    // ----- laporan (Tahap 5) -----
    "report.summary": {
      auth: true,
      fn: (c, p) => {
        var _a, _b;
        need(c, "laporan");
        const today = c.env.today();
        const from = isYmd(str(p.from)) ? str(p.from) : today.slice(0, 8) + "01";
        const to = isYmd(str(p.to)) ? str(p.to) : today;
        const inR = (t) => str(t) >= from && str(t) <= to;
        const canLaba = !!((_b = (_a = c.perms) == null ? void 0 : _a["laporan.laba"]) == null ? void 0 : _b.lihat);
        const users = Object.fromEntries(c.s.all("users").map((x) => [x.id, x.nama]));
        const cust = Object.fromEntries(c.s.all("customers").map((x) => [x.id, x]));
        const machines = Object.fromEntries(c.s.all("machines").map((x) => [x.id, x.nama]));
        const methods = Object.fromEntries(c.s.all("payment_methods").map((x) => [x.id, x]));
        const cats = Object.fromEntries(c.s.all("expense_categories").map((x) => [x.id, x]));
        const orders = c.s.all("orders").filter((o) => !bool(o.batal) && inR(o.tanggal));
        const oIds = new Set(orders.map((o) => o.id));
        const items = c.s.all("order_items").filter((i) => oIds.has(i.order_id));
        const pays = c.s.all("payments").filter((x) => inR(x.tanggal));
        const exps = c.s.all("expenses").filter((x) => !bool(x.deleted) && inR(x.tanggal));
        const billPays = c.s.all("bill_payments").filter((x) => inR(x.tanggal));
        const pc = c.s.all("petty_cash").filter((x) => !bool(x.deleted) && inR(x.tanggal));
        const costs = c.s.all("cost_history");
        const oDate = Object.fromEntries(orders.map((o) => [o.id, o.tanggal]));
        const costOf = (i) => {
          if (str(i.stok_at)) return Number(i.hpp_bahan || 0) + Number(i.hpp_klik || 0);
          const u = unitCost(i);
          return u == null ? null : u * Number(i.qty);
        };
        const unitCost = (i) => {
          if (i.harga_beli != null && i.harga_beli !== "") return Number(i.harga_beli);
          const t = str(oDate[str(i.order_id)]);
          const r = costs.filter((x) => x.product_id === i.product_id && str(x.berlaku_mulai) <= t).sort((a, b) => str(b.berlaku_mulai).localeCompare(str(a.berlaku_mulai)))[0];
          return r ? Number(r.harga_beli) : null;
        };
        const omzet = orders.reduce((a, o) => a + Number(o.total || 0), 0);
        let hpp = 0, omzetBerHpp = 0;
        const perProduk = {};
        items.forEach((i) => {
          const cst = costOf(i);
          const k = str(i.product_id);
          const r = perProduk[k] || (perProduk[k] = { product_id: k, nama: i.nama_produk, qty: 0, klik: 0, omzet: 0, hpp: 0, hpp_lengkap: true, nota: /* @__PURE__ */ new Set() });
          r.qty = Number(r.qty) + Number(i.qty);
          r.klik = Number(r.klik) + Number(i.klik || 0);
          r.omzet = Number(r.omzet) + Number(i.subtotal);
          r.nota.add(str(i.order_id));
          if (cst != null) {
            const h = cst;
            r.hpp = Number(r.hpp) + h;
            hpp += h;
            omzetBerHpp += Number(i.subtotal);
          } else r.hpp_lengkap = false;
        });
        const groupSum = (rows, key, val) => {
          const m = {};
          rows.forEach((r) => {
            const k = key(r);
            m[k] = (m[k] || 0) + val(r);
          });
          return m;
        };
        const perCs = Object.entries(groupSum(orders, (o) => str(o.cs_id), (o) => Number(o.total))).map(([id, v]) => ({
          id,
          nama: str(users[id]) || "\u2013",
          omzet: v,
          nota: orders.filter((o) => o.cs_id === id).length,
          klik: items.filter((i) => {
            var _a2;
            return ((_a2 = orders.find((o) => o.id === i.order_id)) == null ? void 0 : _a2.cs_id) === id;
          }).reduce((a, i) => a + Number(i.klik || 0), 0)
        }));
        const perMesin = Object.entries(groupSum(items, (i) => str(i.mesin_id), (i) => Number(i.subtotal))).map(([id, v]) => ({
          id,
          nama: str(machines[id]) || "\u2013",
          omzet: v,
          item: items.filter((i) => i.mesin_id === id).length,
          klik: items.filter((i) => i.mesin_id === id).reduce((a, i) => a + Number(i.klik || 0), 0)
        }));
        const perMetode = Object.entries(groupSum(pays, (x) => str(x.method_id), (x) => Number(x.nominal))).map(([id, v]) => {
          var _a2, _b2;
          return { id, nama: str((_a2 = methods[id]) == null ? void 0 : _a2.nama) || "\u2013", jenis: str((_b2 = methods[id]) == null ? void 0 : _b2.jenis), masuk: v, transaksi: pays.filter((x) => x.method_id === id).length };
        });
        const perKonsumen = Object.entries(groupSum(orders, (o) => str(o.customer_id), (o) => Number(o.total))).map(([id, v]) => {
          var _a2, _b2;
          return {
            id,
            nama: str((_a2 = cust[id]) == null ? void 0 : _a2.nama) || "\u2013",
            tipe: str((_b2 = cust[id]) == null ? void 0 : _b2.tipe),
            omzet: v,
            nota: orders.filter((o) => o.customer_id === id).length,
            sisa: orders.filter((o) => o.customer_id === id).reduce((a, o) => a + Math.max(0, Number(o.sisa || 0)), 0)
          };
        });
        const perKategori = Object.entries(groupSum(exps, (x) => str(x.kategori_id), (x) => Number(x.total))).map(([id, v]) => {
          var _a2, _b2;
          return { id, nama: str((_a2 = cats[id]) == null ? void 0 : _a2.nama) || "\u2013", jenis: str((_b2 = cats[id]) == null ? void 0 : _b2.jenis), total: v, transaksi: exps.filter((x) => x.kategori_id === id).length };
        });
        const days = [];
        for (let d = from; d <= to && days.length < 400; d = addDays(d, 1)) days.push(d);
        const harian = days.map((d) => ({
          tanggal: d,
          omzet: orders.filter((o) => o.tanggal === d).reduce((a, o) => a + Number(o.total || 0), 0),
          masuk: pays.filter((x) => x.tanggal === d).reduce((a, x) => a + Number(x.nominal || 0), 0),
          nota: orders.filter((o) => o.tanggal === d).length
        }));
        const masuk = pays.reduce((a, x) => a + Number(x.nominal || 0), 0);
        const keluarLunas = exps.filter((x) => x.cara_bayar === "lunas").reduce((a, x) => a + Number(x.total || 0), 0);
        const keluarHutang = billPays.reduce((a, x) => a + Number(x.nominal || 0), 0);
        const kasKecil = pc.reduce((a, x) => a + Number(x.keluar || 0), 0);
        const opsNonBahan = exps.filter((x) => {
          var _a2, _b2;
          return str((_a2 = cats[str(x.kategori_id)]) == null ? void 0 : _a2.jenis) !== "bahan" && str((_b2 = cats[str(x.kategori_id)]) == null ? void 0 : _b2.jenis) !== "aset";
        }).reduce((a, x) => a + Number(x.total || 0), 0);
        return {
          from,
          to,
          can_laba: canLaba,
          ringkas: {
            omzet,
            nota: orders.length,
            rata_nota: orders.length ? Math.round(omzet / orders.length) : 0,
            klik: items.reduce((a, i) => a + Number(i.klik || 0), 0),
            piutang_periode: orders.reduce((a, o) => a + Math.max(0, Number(o.sisa || 0)), 0),
            masuk,
            keluar_lunas: keluarLunas,
            keluar_hutang: keluarHutang,
            kas_kecil: kasKecil,
            arus_kas: masuk - keluarLunas - keluarHutang - kasKecil,
            pengeluaran_total: exps.reduce((a, x) => a + Number(x.total || 0), 0),
            ...canLaba ? { hpp: Math.round(hpp), laba_kotor: Math.round(omzetBerHpp - hpp), omzet_ber_hpp: omzetBerHpp, cakupan_hpp: omzet ? Math.round(omzetBerHpp / omzet * 1e3) / 10 : 0, biaya_operasional: opsNonBahan + kasKecil } : {}
          },
          harian,
          per_cs: perCs,
          per_mesin: perMesin,
          per_metode: perMetode,
          per_konsumen: perKonsumen,
          per_kategori: perKategori,
          per_produk: Object.values(perProduk).map((r) => ({ ...r, nota: r.nota.size, ...canLaba ? { laba: Number(r.omzet) - Number(r.hpp) } : { hpp: void 0, hpp_lengkap: void 0 } }))
        };
      }
    },
    // ----- dashboard -----
    "dashboard.summary": {
      auth: true,
      fn: (c) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r;
        need(c, "dashboard");
        const today = c.env.today();
        const from = addDays(today, -30);
        const products = c.s.all("products");
        const prices = c.s.all("price_history");
        const customers = c.s.all("customers").filter((x) => bool(x.aktif));
        const changes = [];
        products.forEach((p) => {
          const rows = prices.filter((r) => r.product_id === p.id).sort((a, b) => str(a.berlaku_mulai).localeCompare(str(b.berlaku_mulai)));
          rows.forEach((r, i) => {
            if (i === 0 || str(r.berlaku_mulai) < from) return;
            const prev = rows[i - 1], cur = r;
            const base = Number(prev.rb), now = Number(cur.rb);
            changes.push({
              product_id: p.id,
              kode: p.kode,
              nama: p.nama,
              berlaku_mulai: r.berlaku_mulai,
              sebelum: base || null,
              sesudah: now || null,
              persen: base && now ? Math.round((now - base) / base * 1e3) / 10 : null,
              terjadwal: str(r.berlaku_mulai) > today,
              catatan: r.catatan
            });
          });
        });
        changes.sort((a, b) => str(b.berlaku_mulai).localeCompare(str(a.berlaku_mulai)));
        const tanpaHarga = products.filter((p) => bool(p.aktif) && p.jenis_harga !== "manual" && !hargaBerlaku(prices.filter((r) => r.product_id === p.id), today)).length;
        const canDev = !!((_b = (_a = c.perms) == null ? void 0 : _a["pengaturan.perangkat"]) == null ? void 0 : _b.lihat);
        const orders = c.s.all("orders").filter((o) => !bool(o.batal));
        const pays = c.s.all("payments");
        const days = [];
        for (let i = 13; i >= 0; i--) days.push(addDays(today, -i));
        const yest = addDays(today, -1);
        const sumOrders = (d) => orders.filter((o) => o.tanggal === d).reduce((a, o) => a + Number(o.total || 0), 0);
        const sumPays = (d) => pays.filter((x) => x.tanggal === d).reduce((a, x) => a + Number(x.nominal || 0), 0);
        const canMoney = !!(((_d = (_c = c.perms) == null ? void 0 : _c.order) == null ? void 0 : _d.lihat) || ((_f = (_e = c.perms) == null ? void 0 : _e.kasir) == null ? void 0 : _f.lihat) || ((_h = (_g = c.perms) == null ? void 0 : _g.piutang) == null ? void 0 : _h.lihat));
        const trx = canMoney ? {
          omzet_hari_ini: sumOrders(today),
          omzet_kemarin: sumOrders(yest),
          masuk_hari_ini: sumPays(today),
          masuk_kemarin: sumPays(yest),
          nota_hari_ini: orders.filter((o) => o.tanggal === today).length,
          nota_kemarin: orders.filter((o) => o.tanggal === yest).length,
          piutang_total: orders.reduce((a, o) => a + Math.max(0, Number(o.sisa || 0)), 0),
          piutang_nota: orders.filter((o) => Number(o.sisa) > 0).length,
          tren: days.map((d) => ({ tanggal: d, omzet: sumOrders(d), masuk: sumPays(d) }))
        } : null;
        let produksi = null;
        if ((_j = (_i = c.perms) == null ? void 0 : _i.produksi) == null ? void 0 : _j.lihat) {
          const live = new Set(c.s.all("orders").filter((o) => !bool(o.batal)).map((o) => o.id));
          const ms = c.s.all("machines");
          const agg = {};
          c.s.all("order_items").forEach((i) => {
            var _a2;
            if (!live.has(i.order_id) || i.status_produksi !== "antrian" && i.status_produksi !== "proses") return;
            const a = agg[_a2 = str(i.mesin_id)] || (agg[_a2] = { antrian: 0, proses: 0 });
            a[i.status_produksi]++;
          });
          produksi = Object.entries(agg).map(([id, v]) => {
            var _a2;
            return { mesin_id: id, mesin: str((_a2 = ms.find((m) => m.id === id)) == null ? void 0 : _a2.nama) || "\u2013", ...v };
          }).sort((a, b) => b.antrian + b.proses - (a.antrian + a.proses));
        }
        let hutang = null;
        if ((_l = (_k = c.perms) == null ? void 0 : _k.hutang) == null ? void 0 : _l.lihat) {
          const open = c.s.all("supplier_bills").filter((b) => Number(b.sisa) > 0);
          const week = addDays(today, 7);
          hutang = {
            total: open.reduce((a, b) => a + Number(b.sisa), 0),
            tagihan: open.length,
            jatuh_tempo: open.filter((b) => str(b.jatuh_tempo) <= week).sort((a, b) => str(a.jatuh_tempo).localeCompare(str(b.jatuh_tempo))).slice(0, 6).map((b) => {
              var _a2;
              return { id: b.id, supplier: str((_a2 = c.s.all("suppliers").find((x) => x.id === b.supplier_id)) == null ? void 0 : _a2.nama), sisa: b.sisa, jatuh_tempo: b.jatuh_tempo, nota: b.nota };
            })
          };
        }
        let bulan = null;
        if ((_n = (_m = c.perms) == null ? void 0 : _m.laporan) == null ? void 0 : _n.lihat) {
          const m0 = today.slice(0, 8) + "01";
          const prevEnd = addDays(m0, -1), prev0 = prevEnd.slice(0, 8) + "01";
          const dayN = Number(today.slice(8, 10));
          const prevSame = addDays(prev0, Math.min(dayN, Number(prevEnd.slice(8, 10))) - 1);
          const sumO = (a, b) => orders.filter((o) => str(o.tanggal) >= a && str(o.tanggal) <= b).reduce((x, o) => x + Number(o.total || 0), 0);
          const items = c.s.all("order_items");
          const top = {};
          const cur = new Set(orders.filter((o) => str(o.tanggal) >= m0).map((o) => o.id));
          items.forEach((i) => {
            var _a2;
            if (!cur.has(i.order_id)) return;
            const t = top[_a2 = str(i.product_id)] || (top[_a2] = { nama: str(i.nama_produk), omzet: 0, qty: 0 });
            t.omzet += Number(i.subtotal);
            t.qty += Number(i.qty);
          });
          const omzetBulan = sumO(m0, today);
          const nDays = Number(addDays(addDays(m0, 32).slice(0, 8) + "01", -1).slice(8, 10));
          const target = Number(settingsMap(c.s)["target_" + today.slice(0, 7).replace("-", "")]) || 0;
          bulan = {
            omzet: omzetBulan,
            omzet_bulan_lalu_sd: sumO(prev0, prevSame),
            omzet_bulan_lalu: sumO(prev0, prevEnd),
            top_produk: Object.values(top).sort((a, b) => b.omzet - a.omzet).slice(0, 5),
            target,
            hari_ke: dayN,
            jumlah_hari: nDays,
            proyeksi: Math.round(omzetBulan / dayN * nDays),
            perlu_per_hari: target && dayN < nDays ? Math.max(0, Math.round((target - omzetBulan) / (nDays - dayN))) : 0,
            bisa_atur_target: !!((_p = (_o = c.perms) == null ? void 0 : _o["pengaturan.umum"]) == null ? void 0 : _p.ubah)
          };
        }
        const stok = ((_r = (_q = c.perms) == null ? void 0 : _q.stok) == null ? void 0 : _r.lihat) ? { menipis: ext.lowStock(c).slice(0, 8), jumlah: ext.lowStock(c).length } : null;
        return {
          trx,
          produksi,
          hutang,
          bulan,
          stok,
          produk_aktif: products.filter((p) => bool(p.aktif)).length,
          produk_tanpa_harga: tanpaHarga,
          konsumen: customers.length,
          reseller: customers.filter((x) => x.tipe === "reseller").length,
          perangkat_menunggu: canDev ? c.s.all("devices").filter((d) => d.status === "menunggu").length : null,
          perubahan_harga: changes.slice(0, 20)
        };
      }
    },
    // ----- pengaturan & log -----
    "settings.get": { auth: true, fn: (c) => settingsMap(c.s) },
    "settings.save": {
      auth: true,
      fn: (c, p) => {
        need(c, "pengaturan.umum", "ubah");
        const s = p.settings || {};
        if (s.min_qty_banyak !== void 0 && !(Number(s.min_qty_banyak) >= 2)) fail("VALIDATION", "Minimal qty harga banyak harus angka \u2265 2.");
        if (s.stok_kurang_saat !== void 0 && !["selesai", "bayar"].includes(str(s.stok_kurang_saat))) fail("VALIDATION", "Pilihan potong stok tidak dikenal.");
        if (s.margin_min !== void 0 && !(Number(s.margin_min) >= 0 && Number(s.margin_min) <= 90)) fail("VALIDATION", "Margin minimum 0\u201390%.");
        Object.keys(s).filter((k) => /^target_\d{6}$/.test(k)).forEach((k) => {
          if (str(s[k]) !== "" && !(Number(s[k]) >= 0)) fail("VALIDATION", "Target omzet harus angka.");
        });
        if (s.sesi_jam !== void 0 && !(Number(s.sesi_jam) >= 1 && Number(s.sesi_jam) <= 72)) fail("VALIDATION", "Lama sesi 1\u201372 jam.");
        if (s.maks_perangkat !== void 0 && str(s.maks_perangkat) !== "" && !(Number.isInteger(Number(s.maks_perangkat)) && Number(s.maks_perangkat) >= 1 && Number(s.maks_perangkat) <= 99)) fail("VALIDATION", "Batas perangkat 1\u201399, atau kosongkan untuk tanpa batas.");
        c.s.withLock(() => {
          const cur = settingsMap(c.s);
          Object.keys(s).forEach((k) => {
            if (!/^[a-z0-9_]{2,40}$/.test(k)) return;
            const v = str(s[k]);
            if (k in cur) {
              if (cur[k] !== v) c.s.update("settings", "key", k, { value: v });
            } else c.s.insert("settings", { key: k, value: v });
          });
        });
        log(c, "ubah_pengaturan", "settings", "", "Mengubah: " + Object.keys(s).join(", "));
        return settingsMap(c.s);
      }
    },
    "log.list": {
      auth: true,
      fn: (c, p) => {
        need(c, "pengaturan.log");
        const from = str(p.from), to = str(p.to);
        return c.s.all("activity_log").filter((r) => (!from || str(r.waktu).slice(0, 10) >= from) && (!to || str(r.waktu).slice(0, 10) <= to)).sort((a, b) => str(b.waktu).localeCompare(str(a.waktu))).slice(0, 5e3);
      }
    }
  };
  var ext = makeExt({ fail, str, bool, newId, iso, addDays, isYmd, settingsMap, need, stamp, log });
  Object.keys(ext.handlers).forEach((k) => {
    if (handlers[k]) throw new Error("Handler ganda: " + k);
    handlers[k] = ext.handlers[k];
  });
  function handle(s, env, req) {
    try {
      const h = handlers[req.action];
      if (!h) fail("NOT_FOUND", `Aksi "${req.action}" tidak dikenal.`);
      const c = { s, env, req };
      if (h.auth) authenticate(c);
      return { ok: true, data: h.fn(c, req.payload || {}), version: API_VERSION };
    } catch (e) {
      if (e instanceof ApiError) return { ok: false, error: { code: e.code, message: e.message }, version: API_VERSION };
      return { ok: false, error: { code: "SERVER_ERROR", message: (e == null ? void 0 : e.message) || String(e) }, version: API_VERSION };
    }
  }
  var BASE_MACHINES = ["versant", "Mahogani", "Dopo", "graphtech", "laminating", "DTF", "Seng", "nomorator", "Scan", "desain", "potong"];
  var BASE_METHODS = [
    ["Tunai", "tunai"],
    ["Mandiri Transfer", "transfer"],
    ["BNI Transfer", "transfer"],
    ["BCA Transfer", "transfer"],
    ["EDC Mandiri", "edc"],
    ["BSI Transfer", "transfer"]
  ];
  var BASE_CATEGORIES = [
    ["Bahan baku (kertas, stiker, film)", "bahan"],
    ["Bahan finishing (laminating, plastik)", "bahan"],
    ["Operasional", "operasional"],
    ["Listrik, air & internet", "operasional"],
    ["Tagihan biaya klik mesin", "klik"],
    ["Perawatan & sparepart mesin", "operasional"],
    ["Gaji, upah & cashbon", "gaji"],
    ["Sewa tempat", "operasional"],
    ["Pengembalian uang konsumen", "lain"],
    ["Aset & peralatan", "aset"],
    ["Lain-lain", "lain"]
  ];
  var BASE_SETTINGS = {
    nama_usaha: "Fortuner Digital Printing",
    alamat: "",
    telp: "",
    min_qty_banyak: "26",
    sesi_jam: "12",
    prefix_nota: "FT",
    maks_perangkat: "",
    stok_kurang_saat: "selesai",
    margin_min: "20",
    catatan_struk: "Terima kasih. Barang yang tidak diambil lebih dari 30 hari di luar tanggung jawab kami."
  };
  function seedBase(s, env, owner) {
    const now = env.now().toISOString();
    const st = { created_at: now, created_by: "setup", updated_at: now, updated_by: "setup" };
    const cur = settingsMap(s);
    Object.entries(BASE_SETTINGS).forEach(([k, v]) => {
      if (!(k in cur)) s.insert("settings", { key: k, value: v });
    });
    if (!s.all("machines").length) BASE_MACHINES.forEach((n) => s.insert("machines", { id: newId(env, "mes"), nama: n, pakai_counter: ["versant", "Mahogani", "Dopo"].includes(n), aktif: true, ...st }));
    if (!s.all("expense_categories").length) BASE_CATEGORIES.forEach(([n, j]) => s.insert("expense_categories", { id: newId(env, "cat"), nama: n, jenis: j, aktif: true, ...st }));
    if (!s.all("expense_categories").some((x) => x.jenis === "klik")) s.insert("expense_categories", { id: newId(env, "cat"), nama: "Tagihan biaya klik mesin", jenis: "klik", aktif: true, ...st });
    if (!s.all("payment_methods").length) BASE_METHODS.forEach(([n, j]) => s.insert("payment_methods", { id: newId(env, "pay"), nama: n, jenis: j, rekening: "", aktif: true, ...st }));
    if (!s.all("users").some((u) => u.role === "owner")) {
      const salt = env.uuid();
      s.insert("users", {
        id: newId(env, "usr"),
        username: owner.username,
        nama: owner.nama,
        role: "owner",
        salt,
        password_hash: hashPassword(owner.password, salt),
        khusus_kantor: false,
        jam_login_dari: "",
        jam_login_sampai: "",
        aktif: true,
        harus_ganti_password: true,
        ...st
      });
    }
  }

  // src/server/schema.ts
  var audit = { created_at: "s", created_by: "s", updated_at: "s", updated_by: "s" };
  var SCHEMA = {
    // ---------- Sistem ----------
    users: {
      id: "s",
      username: "s",
      nama: "s",
      role: "s",
      password_hash: "s",
      salt: "s",
      khusus_kantor: "b",
      jam_login_dari: "s",
      jam_login_sampai: "s",
      aktif: "b",
      harus_ganti_password: "b",
      ...audit
    },
    role_permissions: { role: "s", permissions: "j", updated_at: "s", updated_by: "s" },
    devices: {
      id: "s",
      kode_pc: "s",
      nama: "s",
      jenis: "s",
      device_hash: "s",
      status: "s",
      printer_koneksi: "s",
      printer_alamat: "s",
      lebar_kertas: "s",
      laci_otomatis: "b",
      disetujui_oleh: "s",
      last_seen: "s",
      role_izin: "s",
      lokasi: "s",
      nama_komputer: "s",
      versi_app: "s",
      ...audit
    },
    sessions: { token_hash: "s", user_id: "s", device_id: "s", expired_at: "s", created_at: "s" },
    activity_log: { id: "s", waktu: "s", user_id: "s", user_nama: "s", aksi: "s", tabel: "s", record_id: "s", ringkasan: "s", alasan: "s" },
    settings: { key: "s", value: "s" },
    counters: { key: "s", value: "n" },
    // ---------- Master ----------
    products: { id: "s", kode: "s", nama: "s", kategori: "s", mesin_id: "s", jenis_harga: "s", satuan: "s", aktif: "b", kertas_sendiri: "b", ...audit },
    price_history: {
      id: "s",
      product_id: "s",
      berlaku_mulai: "s",
      berlaku_sampai: "s",
      rb: "n",
      rb_bb: "n",
      rs: "n",
      rs_bb: "n",
      eb: "n",
      eb_bb: "n",
      es: "n",
      es_bb: "n",
      catatan: "s",
      ...audit
    },
    cost_history: { id: "s", product_id: "s", berlaku_mulai: "s", harga_beli: "n", supplier_id: "s", sumber: "s", ...audit },
    customers: { id: "s", kode: "s", nama: "s", telp: "s", tipe: "s", alamat: "s", catatan: "s", aktif: "b", ...audit },
    suppliers: { id: "s", nama: "s", telp: "s", bahan: "s", aktif: "b", ...audit },
    machines: { id: "s", nama: "s", pakai_counter: "b", aktif: "b", biaya_klik: "n", ...audit },
    payment_methods: { id: "s", nama: "s", jenis: "s", rekening: "s", aktif: "b", ...audit },
    // ---------- Transaksi (dipakai mulai Tahap 2, sheet sudah disiapkan) ----------
    orders: {
      id: "s",
      nomor: "s",
      tanggal: "s",
      kode_pc: "s",
      no_urut: "n",
      customer_id: "s",
      cs_id: "s",
      total: "n",
      terbayar: "n",
      sisa: "n",
      status_bayar: "s",
      status_ambil: "s",
      tgl_ambil: "s",
      batal: "b",
      alasan_batal: "s",
      dibuat_offline: "b",
      catatan: "s",
      desain: "s",
      janji_selesai: "s",
      ...audit
    },
    order_items: {
      id: "s",
      order_id: "s",
      product_id: "s",
      nama_produk: "s",
      keterangan: "s",
      qty: "n",
      sisi: "n",
      ukuran_cutting: "n",
      klik: "n",
      tier: "s",
      harga_satuan: "n",
      harga_beli: "n",
      harga_manual: "b",
      subtotal: "n",
      mesin_id: "s",
      status_produksi: "s",
      operator_id: "s",
      selesai_at: "s",
      price_version_id: "s",
      ...audit,
      hpp_bahan: "n",
      hpp_klik: "n",
      stok_at: "s"
    },
    payments: { id: "s", order_id: "s", tanggal: "s", nominal: "n", method_id: "s", kasir_id: "s", catatan: "s", ...audit },
    // ---------- Operasional (Tahap 4) ----------
    machine_counters: {
      id: "s",
      tanggal: "s",
      mesin_id: "s",
      counter_awal: "n",
      counter_akhir: "n",
      reject_trouble: "n",
      reject_operator: "n",
      reject_fo: "n",
      batal: "n",
      keterangan: "s",
      ...audit
    },
    petty_cash: { id: "s", tanggal: "s", item: "s", masuk: "n", keluar: "n", keterangan: "s", deleted: "b", ...audit },
    cash_deposits: { id: "s", tanggal: "s", kasir_id: "s", method_id: "s", sistem: "n", aktual: "n", selisih: "n", keterangan: "s", ...audit },
    // ---------- Keuangan (Tahap 5) ----------
    expense_categories: { id: "s", nama: "s", jenis: "s", aktif: "b", ...audit },
    expenses: {
      id: "s",
      tanggal: "s",
      nota: "s",
      supplier_id: "s",
      kategori_id: "s",
      product_id: "s",
      item: "s",
      qty: "n",
      satuan: "s",
      harga: "n",
      total: "n",
      isi_per_satuan: "n",
      mesin_id: "s",
      cara_bayar: "s",
      method_id: "s",
      bill_id: "s",
      keterangan: "s",
      deleted: "b",
      ...audit,
      purchase_id: "s"
    },
    supplier_bills: { id: "s", tanggal: "s", nota: "s", supplier_id: "s", expense_id: "s", total: "n", terbayar: "n", sisa: "n", jatuh_tempo: "s", keterangan: "s", ...audit },
    bill_payments: { id: "s", bill_id: "s", tanggal: "s", nominal: "n", method_id: "s", keterangan: "s", ...audit },
    // ---------- Stok bahan & akuntansi (v1.1) ----------
    materials: { id: "s", kode: "s", nama: "s", satuan: "s", kategori: "s", stok: "n", stok_min: "n", harga_rata: "n", harga_terakhir: "n", aktif: "b", catatan: "s", ...audit },
    recipes: { id: "s", product_id: "s", material_id: "s", qty: "n", per: "s", ...audit },
    stock_moves: { id: "s", tanggal: "s", material_id: "s", jenis: "s", qty: "n", harga: "n", nilai: "n", saldo: "n", ref_tabel: "s", ref_id: "s", keterangan: "s", ...audit },
    purchases: { id: "s", tanggal: "s", nota: "s", supplier_id: "s", total: "n", cara_bayar: "s", method_id: "s", bill_id: "s", expense_id: "s", jatuh_tempo: "s", keterangan: "s", deleted: "b", ...audit },
    purchase_items: { id: "s", purchase_id: "s", material_id: "s", qty_beli: "n", satuan_beli: "s", isi: "n", harga_beli: "n", subtotal: "n", qty_stok: "n", harga_stok: "n" },
    opnames: { id: "s", tanggal: "s", keterangan: "s", jumlah_item: "n", nilai_selisih: "n", ...audit },
    opname_items: { id: "s", opname_id: "s", material_id: "s", stok_sistem: "n", stok_fisik: "n", selisih: "n", harga: "n", nilai: "n", keterangan: "s" },
    journals: { id: "s", tanggal: "s", keterangan: "s", lines: "j", deleted: "b", ...audit }
  };

  // src/server/gasStore.ts
  var TZ = "Asia/Jakarta";
  function spreadsheet() {
    const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
    return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  }
  function ensureSheets() {
    const ss = spreadsheet();
    Object.keys(SCHEMA).forEach((name) => {
      const cols = Object.keys(SCHEMA[name]);
      let sh = ss.getSheetByName(name);
      if (!sh) sh = ss.insertSheet(name);
      const lastCol = Math.max(sh.getLastColumn(), 1);
      const existing = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String).filter((x) => x);
      const missing = cols.filter((c) => existing.indexOf(c) < 0);
      if (missing.length) sh.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
      const headers = existing.concat(missing);
      headers.forEach((h, i) => {
        const t = SCHEMA[name][h];
        if (t === "s" || t === "j") sh.getRange(1, i + 1, sh.getMaxRows(), 1).setNumberFormat("@");
      });
      sh.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#111111").setFontColor("#ffffff");
      sh.setFrozenRows(1);
    });
    const def = ss.getSheetByName("Sheet1") || ss.getSheetByName("Lembar1");
    if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
  }
  var GasStore = class {
    constructor() {
      __publicField(this, "cache", {});
      __publicField(this, "lockDepth", 0);
      __publicField(this, "ss", spreadsheet());
    }
    load(table) {
      if (this.cache[table]) return this.cache[table];
      const sheet = this.ss.getSheetByName(table);
      if (!sheet) throw new Error(`Sheet "${table}" belum ada. Jalankan setup() di Apps Script.`);
      const values = sheet.getDataRange().getValues();
      const headers = (values[0] || []).map(String);
      const types = SCHEMA[table] || {};
      const rows = [];
      for (let i = 1; i < values.length; i++) {
        const r = {};
        let empty = true;
        headers.forEach((h, j) => {
          const v = values[i][j];
          if (v !== "" && v != null) empty = false;
          r[h] = this.fromCell(v, types[h]);
        });
        if (!empty) rows.push(r);
        else rows.push({ __empty: true });
      }
      return this.cache[table] = { headers, rows, sheet };
    }
    fromCell(v, t) {
      if (v instanceof Date) {
        const hm = Utilities.formatDate(v, TZ, "HH:mm:ss");
        return hm === "00:00:00" ? Utilities.formatDate(v, TZ, "yyyy-MM-dd") : v.toISOString();
      }
      switch (t) {
        case "n":
          return v === "" || v == null ? null : Number(v);
        case "b":
          return v === true || v === "TRUE" || v === "true";
        case "j":
          if (!v) return null;
          try {
            return JSON.parse(String(v));
          } catch {
            return null;
          }
        default:
          return v == null ? "" : String(v);
      }
    }
    toCell(v, t) {
      switch (t) {
        case "n":
          return v == null || v === "" ? "" : Number(v);
        case "b":
          return !!v;
        case "j":
          return v == null ? "" : JSON.stringify(v);
        default:
          return v == null ? "" : String(v);
      }
    }
    all(table) {
      return this.load(table).rows.filter((r) => !r.__empty).map((r) => ({ ...r }));
    }
    insert(table, row) {
      const c = this.load(table);
      const types = SCHEMA[table] || {};
      const arr = c.headers.map((h) => this.toCell(row[h], types[h]));
      c.sheet.getRange(c.rows.length + 2, 1, 1, c.headers.length).setValues([arr]);
      const stored = {};
      c.headers.forEach((h) => {
        var _a;
        return stored[h] = (_a = row[h]) != null ? _a : types[h] === "n" ? null : types[h] === "b" ? false : "";
      });
      c.rows.push(stored);
      return { ...stored };
    }
    update(table, keyCol, keyVal, patch) {
      const c = this.load(table);
      const idx = c.rows.findIndex((r) => !r.__empty && String(r[keyCol]) === String(keyVal));
      if (idx < 0) return null;
      const merged = { ...c.rows[idx], ...patch };
      const types = SCHEMA[table] || {};
      c.sheet.getRange(idx + 2, 1, 1, c.headers.length).setValues([c.headers.map((h) => this.toCell(merged[h], types[h]))]);
      c.rows[idx] = merged;
      return { ...merged };
    }
    remove(table, keyCol, keyVal) {
      const c = this.load(table);
      const idx = c.rows.findIndex((r) => !r.__empty && String(r[keyCol]) === String(keyVal));
      if (idx < 0) return;
      c.sheet.deleteRow(idx + 2);
      c.rows.splice(idx, 1);
    }
    withLock(fn) {
      if (this.lockDepth > 0) return fn();
      const lock = LockService.getScriptLock();
      lock.waitLock(2e4);
      this.lockDepth++;
      this.cache = {};
      try {
        return fn();
      } finally {
        this.lockDepth--;
        lock.releaseLock();
      }
    }
  };
  var gasEnv = {
    uuid: () => Utilities.getUuid(),
    now: () => /* @__PURE__ */ new Date(),
    today: () => Utilities.formatDate(/* @__PURE__ */ new Date(), TZ, "yyyy-MM-dd"),
    timeHM: () => Utilities.formatDate(/* @__PURE__ */ new Date(), TZ, "HH:mm")
  };

  // src/server/gasEntry.ts
  var json = (obj) => ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  function doPost(e) {
    var _a;
    let req;
    try {
      req = JSON.parse(((_a = e == null ? void 0 : e.postData) == null ? void 0 : _a.contents) || "{}");
    } catch {
      return json({ ok: false, error: { code: "BAD_REQUEST", message: "Body bukan JSON." }, version: API_VERSION });
    }
    return json(handle(new GasStore(), gasEnv, req));
  }
  function doGet() {
    return json({ ok: true, data: { app: "Fortuner POS", version: API_VERSION, time: (/* @__PURE__ */ new Date()).toISOString() }, version: API_VERSION });
  }
  function setup() {
    ensureSheets();
    const props = PropertiesService.getScriptProperties();
    const pass = props.getProperty("OWNER_PASSWORD") || "fortuner123";
    const store = new GasStore();
    store.withLock(() => seedBase(store, gasEnv, { username: "owner", password: pass, nama: "Owner" }));
    const msg = `Setup selesai. Login: owner / ${props.getProperty("OWNER_PASSWORD") ? "(OWNER_PASSWORD)" : "fortuner123"} \u2014 wajib ganti password saat login pertama.`;
    Logger.log(msg);
    try {
      SpreadsheetApp.getActiveSpreadsheet().toast(msg, "Fortuner POS", 10);
    } catch {
    }
    return msg;
  }
  function backupSekarang() {
    const props = PropertiesService.getScriptProperties();
    const id = props.getProperty("SPREADSHEET_ID") || SpreadsheetApp.getActiveSpreadsheet().getId();
    const file = DriveApp.getFileById(id);
    const it = DriveApp.getFoldersByName("Fortuner POS Backup");
    const folder = it.hasNext() ? it.next() : DriveApp.createFolder("Fortuner POS Backup");
    const name = `Backup ${file.getName()} ${Utilities.formatDate(/* @__PURE__ */ new Date(), "Asia/Jakarta", "yyyy-MM-dd HHmm")}`;
    file.makeCopy(name, folder);
    const files = [];
    const fi = folder.getFiles();
    while (fi.hasNext()) files.push(fi.next());
    files.sort((a, b) => b.getDateCreated() - a.getDateCreated()).slice(30).forEach((f) => f.setTrashed(true));
    return name;
  }
  function pasangTriggerBackup() {
    ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === "backupSekarang").forEach((t) => ScriptApp.deleteTrigger(t));
    ScriptApp.newTrigger("backupSekarang").timeBased().everyDays(1).atHour(23).inTimezone("Asia/Jakarta").create();
    return "Backup harian terpasang (sekitar 23.00 WIB).";
  }
  function onOpen() {
    try {
      SpreadsheetApp.getUi().createMenu("Fortuner POS").addItem("Setup / perbarui sheet", "setup").addItem("Backup sekarang", "backupSekarang").addItem("Pasang backup harian", "pasangTriggerBackup").addToUi();
    } catch {
    }
  }
  return __toCommonJS(gasEntry_exports);
})();

function doPost(e) { return FortunerServer.doPost(e); }
function doGet(e) { return FortunerServer.doGet(e); }
function setup(e) { return FortunerServer.setup(e); }
function backupSekarang(e) { return FortunerServer.backupSekarang(e); }
function pasangTriggerBackup(e) { return FortunerServer.pasangTriggerBackup(e); }
function onOpen(e) { return FortunerServer.onOpen(e); }


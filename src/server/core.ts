/**
 * Logika server Fortuner POS. Satu sumber untuk:
 *  - Apps Script (di-bundle ke apps-script/Code.gs lewat `npm run build:gas`)
 *  - mode demo di browser (src/lib/mockServer.ts)
 * Jangan memanggil API browser atau Apps Script langsung di file ini; pakai Store dan Env.
 */
import { sha256 } from './sha256';
import type { Row } from './schema';
import type { Env, Store } from './store';
import { MODULES, defaultPermissions } from '../lib/modules';
import { TIERS, hargaBerlaku, hitungHarga } from '../lib/pricing';
import type { PermissionMap, Role } from '../types';
import { makeExt } from './ext';

export const API_VERSION = 1;

export class ApiError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
const fail = (code: string, msg: string): never => { throw new ApiError(code, msg); };

export interface Request { action: string; token?: string; deviceId?: string; payload?: any }
export interface Response { ok: boolean; data?: unknown; error?: { code: string; message: string }; version: number }

interface Ctx { s: Store; env: Env; req: Request; user?: Row; perms?: PermissionMap }

// ---------------- util ----------------
const str = (v: unknown) => (v == null ? '' : String(v).trim());
const numOrNull = (v: unknown): number | null => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? null : n;
};
const bool = (v: unknown) => v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1' || v === 'ya';
const newId = (env: Env, prefix: string) => `${prefix}_${env.uuid().replace(/-/g, '').slice(0, 12)}`;
const iso = (env: Env) => env.now().toISOString();
const addDays = (ymd: string, n: number) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
};
const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

function hashPassword(password: string, salt: string) {
  let h = salt + ':' + password;
  for (let i = 0; i < 300; i++) h = sha256(h + salt);
  return h;
}
const publicUser = (u: Row) => {
  const { password_hash: _h, salt: _s, ...rest } = u;
  return rest;
};

function settingsMap(s: Store): Record<string, string> {
  const m: Record<string, string> = {};
  s.all('settings').forEach((r) => (m[str(r.key)] = str(r.value)));
  return m;
}

function permsFor(s: Store, role: string): PermissionMap {
  const row = s.all('role_permissions').find((r) => r.role === role);
  const base = defaultPermissions(role as Role);
  if (role === 'owner') return base; // owner selalu akses penuh
  if (!row || !row.permissions) return base;
  const saved = row.permissions as PermissionMap;
  // modul baru yang belum ada di data tersimpan memakai nilai default
  MODULES.forEach((m) => { if (saved[m.key]) base[m.key] = saved[m.key]; });
  return base;
}

function log(c: Ctx, aksi: string, tabel: string, recordId: string, ringkasan: string, alasan = '') {
  c.s.insert('activity_log', {
    id: newId(c.env, 'log'), waktu: iso(c.env), user_id: str(c.user?.id), user_nama: str(c.user?.nama || c.user?.username),
    aksi, tabel, record_id: recordId, ringkasan: ringkasan.slice(0, 500), alasan,
  });
}

function need(c: Ctx, key: string, op: 'lihat' | 'tambah' | 'ubah' | 'hapus' | 'ekspor' = 'lihat') {
  if (!c.perms?.[key]?.[op]) fail('FORBIDDEN', 'Anda tidak punya akses untuk tindakan ini.');
}

const stamp = (c: Ctx, isNew: boolean): Row => (isNew
  ? { created_at: iso(c.env), created_by: str(c.user?.id), updated_at: iso(c.env), updated_by: str(c.user?.id) }
  : { updated_at: iso(c.env), updated_by: str(c.user?.id) });

// ---------------- perangkat ----------------
function deviceRow(c: Ctx): Row | undefined {
  if (!c.req.deviceId) return undefined;
  const h = sha256('dev:' + c.req.deviceId);
  return c.s.all('devices').find((d) => d.device_hash === h);
}

/** Info perangkat yang dikirim aplikasi saat login (nama komputer, kode usulan, lokasi, versi aplikasi desktop). */
interface DeviceInfo { nama?: string; jenis?: string; versi?: string; kode?: string; lokasi?: string }
const cleanInfo = (i: any): DeviceInfo => (i && typeof i === 'object' ? {
  nama: str(i.nama).slice(0, 60), jenis: i.jenis === 'desktop' ? 'desktop' : 'web', versi: str(i.versi).slice(0, 20),
  kode: str(i.kode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4), lokasi: str(i.lokasi).slice(0, 60),
} : {});
const ROLE_LABEL: Record<string, string> = { owner: 'owner', admin: 'admin', cs: 'CS', kasir: 'kasir', operator: 'operator', keuangan: 'keuangan' };
export const parseRoles = (v: unknown) => str(v).split(',').map((x) => x.trim()).filter(Boolean);
const cleanRoles = (v: unknown) => (Array.isArray(v) ? v.map(String) : parseRoles(v)).filter((r) => r in ROLE_LABEL).join(',');

function checkDevice(c: Ctx, user: Row, onLogin: boolean, info: DeviceInfo = {}) {
  const dev = deviceRow(c);
  // Role per PC: perangkat yang disetujui boleh dibatasi hanya untuk role tertentu. Owner selalu boleh supaya tidak terkunci.
  if (dev && dev.status === 'disetujui' && user.role !== 'owner') {
    const izin = parseRoles(dev.role_izin);
    if (izin.length && !izin.includes(str(user.role))) {
      fail('ROLE_NOT_ALLOWED', `PC ${str(dev.kode_pc)} hanya untuk ${izin.map((r) => ROLE_LABEL[r] || r).join(', ')}. Akun ${ROLE_LABEL[str(user.role)] || user.role} tidak bisa login di sini.`);
    }
  }
  if (onLogin && dev) {
    const patch: Row = { last_seen: iso(c.env) };
    if (info.versi) patch.versi_app = info.versi;
    if (info.nama) patch.nama_komputer = info.nama;
    if (info.jenis === 'desktop' && dev.jenis !== 'desktop') patch.jenis = 'desktop';
    if (dev.status === 'menunggu') { if (info.kode && !dev.kode_pc) patch.kode_pc = info.kode; if (info.lokasi && !dev.lokasi) patch.lokasi = info.lokasi; }
    c.s.update('devices', 'id', str(dev.id), patch);
  }
  if (!bool(user.khusus_kantor)) return;
  if (dev && dev.status === 'disetujui') return;
  if (onLogin && c.req.deviceId && !dev) {
    // catat sebagai permintaan supaya admin bisa menyetujui
    c.s.insert('devices', {
      id: newId(c.env, 'dev'), kode_pc: info.kode || '', nama: info.nama || 'Perangkat baru (' + str(user.username) + ')', jenis: info.jenis || 'web',
      device_hash: sha256('dev:' + c.req.deviceId), status: 'menunggu', printer_koneksi: '', printer_alamat: '', lebar_kertas: '',
      laci_otomatis: false, disetujui_oleh: '', last_seen: iso(c.env), role_izin: '', lokasi: info.lokasi || '', nama_komputer: info.nama || '', versi_app: info.versi || '',
      created_at: iso(c.env), created_by: str(user.id),
    });
  }
  fail('DEVICE_NOT_ALLOWED', dev?.status === 'dicabut'
    ? 'Akses perangkat ini sudah dicabut admin.'
    : 'Akun ini hanya bisa dipakai di perangkat kantor yang sudah disetujui. Minta admin menyetujui perangkat ini di Pengaturan → Perangkat.');
}

/** Batas jumlah perangkat yang disetujui (setting maks_perangkat; kosong/0 = tanpa batas). */
function checkDeviceLimit(c: Ctx, exceptId?: string) {
  const max = Number(settingsMap(c.s).maks_perangkat || 0);
  if (!max) return;
  const aktif = c.s.all('devices').filter((d) => d.status === 'disetujui' && d.id !== exceptId).length;
  if (aktif >= max) fail('DEVICE_LIMIT', `Sudah ada ${aktif} perangkat aktif (batas ${max}). Cabut perangkat yang tidak dipakai, atau naikkan batas di Pengaturan → Umum.`);
}

function checkHours(c: Ctx, user: Row) {
  const dari = str(user.jam_login_dari), sampai = str(user.jam_login_sampai);
  if (!dari || !sampai || user.role === 'owner') return;
  const now = c.env.timeHM();
  if (now < dari || now > sampai) fail('OUTSIDE_HOURS', `Akun ini hanya bisa login pukul ${dari}–${sampai}.`);
}

// ---------------- sesi ----------------
function makeSession(c: Ctx, user: Row) {
  const token = (c.env.uuid() + c.env.uuid()).replace(/-/g, '');
  const jam = Number(settingsMap(c.s).sesi_jam || 12);
  const exp = new Date(c.env.now().getTime() + jam * 3600 * 1000).toISOString();
  const nowIso = iso(c.env);
  // bersihkan sesi kedaluwarsa
  c.s.all('sessions').filter((r) => str(r.expired_at) < nowIso).forEach((r) => c.s.remove('sessions', 'token_hash', str(r.token_hash)));
  c.s.insert('sessions', { token_hash: sha256('tok:' + token), user_id: user.id, device_id: str(deviceRow(c)?.id), expired_at: exp, created_at: nowIso });
  return { token, user: publicUser(user), permissions: permsFor(c.s, str(user.role)), expired_at: exp };
}

function authenticate(c: Ctx) {
  if (!c.req.token) fail('AUTH_REQUIRED', 'Silakan login dulu.');
  const h = sha256('tok:' + c.req.token);
  const ses = c.s.all('sessions').find((r) => r.token_hash === h);
  if (!ses || str(ses.expired_at) < iso(c.env)) fail('AUTH_REQUIRED', 'Sesi berakhir. Silakan login lagi.');
  const user = c.s.all('users').find((u) => u.id === ses!.user_id);
  if (!user || !bool(user.aktif)) fail('AUTH_REQUIRED', 'Akun tidak aktif.');
  checkDevice(c, user!, false);
  c.user = user;
  c.perms = permsFor(c.s, str(user!.role));
}

// ---------------- order ----------------
const pad = (n: number, l = 2) => String(n).padStart(l, '0');
/** Kunci counter nomor nota: per kode PC per bulan. */
export const counterKey = (kode: string, ymd: string) => `nota-${kode}-${ymd.slice(0, 7)}`;
/** FT-K1-1026-0001 */
export const formatNota = (prefix: string, kode: string, ymd: string, n: number) => `${prefix || 'FT'}-${kode}-${ymd.slice(5, 7)}${ymd.slice(2, 4)}-${pad(n, 4)}`;

function bumpCounter(c: Ctx, key: string, value: number) {
  const row = c.s.all('counters').find((r) => r.key === key);
  if (!row) c.s.insert('counters', { key, value });
  else if (Number(row.value) < value) c.s.update('counters', 'key', key, { value });
}

function statusBayar(total: number, terbayar: number) {
  if (terbayar >= total && total > 0) return 'lunas';
  if (terbayar > 0) return 'dp';
  return total === 0 ? 'lunas' : 'belum';
}

function recalcOrder(c: Ctx, orderId: string) {
  const o = c.s.all('orders').find((x) => x.id === orderId)!;
  const terbayar = c.s.all('payments').filter((x) => x.order_id === orderId).reduce((a, x) => a + Number(x.nominal || 0), 0);
  const total = Number(o.total);
  c.s.update('orders', 'id', orderId, { terbayar, sisa: total - terbayar, status_bayar: bool(o.batal) ? 'batal' : statusBayar(total, terbayar), ...stamp(c, false) });
}

function orderDetail(c: Ctx, id: string) {
  const o = c.s.all('orders').find((x) => x.id === id) || fail('NOT_FOUND', 'Nota tidak ditemukan.');
  const cu = c.s.all('customers').find((x) => x.id === (o as Row).customer_id) || {};
  const users = Object.fromEntries(c.s.all('users').map((x) => [x.id, x.nama]));
  const methods = Object.fromEntries(c.s.all('payment_methods').map((x) => [x.id, x.nama]));
  const machines = Object.fromEntries(c.s.all('machines').map((x) => [x.id, x.nama]));
  const canCost = !!c.perms?.['master.harga_beli']?.lihat;
  const jenis = Object.fromEntries(c.s.all('products').map((x) => [x.id, x.jenis_harga]));
  return {
    order: { ...(o as Row), customer_nama: str((cu as Row).nama), customer_telp: str((cu as Row).telp), customer_tipe: str((cu as Row).tipe), customer_kode: str((cu as Row).kode), cs_nama: str(users[str((o as Row).cs_id)]) },
    items: c.s.all('order_items').filter((i) => i.order_id === id).map((i) => ({ ...i, harga_beli: canCost ? i.harga_beli : null, hpp_bahan: canCost ? i.hpp_bahan : null, hpp_klik: canCost ? i.hpp_klik : null, mesin_nama: str(machines[str(i.mesin_id)]), jenis_harga: str(jenis[str(i.product_id)]) })),
    payments: c.s.all('payments').filter((x) => x.order_id === id).sort((a, b) => str(a.created_at).localeCompare(str(b.created_at)))
      .map((x) => ({ ...x, method_nama: str(methods[str(x.method_id)]), kasir_nama: str(users[str(x.kasir_id)]) })),
    payment_methods: c.s.all('payment_methods').filter((m) => bool(m.aktif)).map((m) => ({ id: m.id, nama: m.nama, jenis: m.jenis })),
  };
}

/**
 * Buat nota. Idempotent: id dari klien (uuid), kirim ulang = hasil sama.
 * Nomor: PC terdaftar membuat nomornya sendiri (bisa offline); server memastikan unik dan menggeser counter.
 * Perangkat tanpa kode PC (HP/laptop owner) dinomori server dengan kode dari pengaturan `kode_pc_web` (default W), hanya online.
 */
function createOrder(c: Ctx, p: any) {
  const id = str(p.id);
  if (!/^ord_[a-z0-9]{8,40}$/.test(id)) fail('VALIDATION', 'ID nota tidak valid.');
  const existing = c.s.all('orders').find((x) => x.id === id);
  if (existing) return { ...orderDetail(c, id), duplikat: true };

  const st = settingsMap(c.s);
  const today = c.env.today();
  const offline = bool(p.dibuat_offline);
  let tanggal = today;
  if (offline && isYmd(str(p.tanggal))) {
    if (str(p.tanggal) > today) fail('VALIDATION', 'Tanggal nota offline lebih dari hari ini. Periksa jam komputer.');
    if (str(p.tanggal) < addDays(today, -14)) fail('VALIDATION', 'Nota offline lebih dari 14 hari. Hubungi admin.');
    tanggal = str(p.tanggal);
  }

  const cust = c.s.all('customers').find((x) => x.id === p.customer_id) || fail('VALIDATION', 'Pilih konsumen.');
  const tipe = (cust as Row).tipe === 'reseller' ? 'reseller' : 'enduser';
  const rawItems: any[] = Array.isArray(p.items) ? p.items : [];
  if (!rawItems.length) fail('VALIDATION', 'Nota belum berisi item.');
  if (rawItems.length > 60) fail('VALIDATION', 'Maksimal 60 item per nota.');

  const products = Object.fromEntries(c.s.all('products').map((x) => [x.id, x]));
  const prices = c.s.all('price_history');
  const costs = c.s.all('cost_history');
  const minQty = Number(st.min_qty_banyak || 26);
  const canManual = !!c.perms?.['kasir.harga_manual']?.ubah;

  const items = rawItems.map((r, idx) => {
    const prod = products[str(r.product_id)] as Row | undefined;
    if (!prod) fail('VALIDATION', `Item ${idx + 1}: produk tidak ditemukan.`);
    if (!bool(prod!.aktif) && !offline) fail('VALIDATION', `Item ${idx + 1}: ${prod!.nama} sudah nonaktif.`);
    const qty = Math.round(Number(r.qty));
    if (!(qty >= 1 && qty <= 1000000)) fail('VALIDATION', `Item ${idx + 1}: jumlah tidak valid.`);
    const jenis = str(prod!.jenis_harga);
    const sisi = jenis === 'matriks' && Number(r.sisi) === 2 ? 2 : 1;
    const ukuran = jenis === 'cutting' ? Math.max(0, Math.min(3, Math.round(Number(r.ukuran) || 0))) : 0;
    const prow = hargaBerlaku(prices.filter((x) => x.product_id === prod!.id) as any, tanggal) as any;
    const calc = hitungHarga({ jenis: jenis as any, harga: prow, tipe, qty, sisi: sisi as 1 | 2, ukuran, minQtyBanyak: minQty });
    const clientPrice = Math.round(Number(r.harga_satuan));
    let harga = calc.harga;
    let manual = false;
    if (jenis === 'manual' || bool(r.harga_manual)) {
      if (jenis !== 'manual' && !canManual) fail('FORBIDDEN', `Item ${idx + 1}: Anda tidak punya izin mengubah harga.`);
      if (!(clientPrice >= 0)) fail('VALIDATION', `Item ${idx + 1}: isi harga.`);
      harga = clientPrice; manual = true;
    } else if (offline && clientPrice >= 0 && clientPrice !== calc.harga) {
      // nota offline memakai harga yang tersimpan di perangkat saat itu; dicatat apa adanya
      harga = clientPrice;
    }
    if (harga == null) fail('VALIDATION', `Item ${idx + 1}: ${prod!.nama} belum punya harga yang berlaku.`);
    const cost = costs.filter((x) => x.product_id === prod!.id && str(x.berlaku_mulai) <= tanggal).sort((a, b) => str(b.berlaku_mulai).localeCompare(str(a.berlaku_mulai)))[0];
    return {
      id: `${id}-i${idx + 1}`, order_id: id, product_id: prod!.id, nama_produk: prod!.nama, keterangan: str(r.keterangan).slice(0, 200), qty, sisi, ukuran_cutting: ukuran,
      klik: jenis === 'matriks' ? qty * sisi : qty, tier: manual ? 'manual' : str(calc.tier), harga_satuan: harga, harga_beli: cost ? Number(cost.harga_beli) : null,
      harga_manual: manual, subtotal: (harga as number) * qty, mesin_id: str(prod!.mesin_id), status_produksi: 'antrian', operator_id: '', selesai_at: '',
      price_version_id: str(prow?.id),
    };
  });
  const total = items.reduce((a, i) => a + i.subtotal, 0);

  // ---- nomor nota ----
  const dev = deviceRow(c);
  const kodeDev = dev && dev.status === 'disetujui' ? str(dev.kode_pc) : '';
  const prefix = st.prefix_nota || 'FT';
  const used = new Set(c.s.all('orders').map((o) => str(o.nomor)));
  let kode = kodeDev, no = 0, nomor = '', renomor = false;
  if (kodeDev && str(p.kode_pc) === kodeDev && Number(p.no_urut) > 0) {
    no = Math.round(Number(p.no_urut));
    nomor = formatNota(prefix, kode, tanggal, no);
    if (used.has(nomor)) renomor = true;
  } else if (offline) {
    fail('VALIDATION', 'Perangkat ini tidak terdaftar, jadi tidak bisa membuat nota offline.');
  }
  if (!nomor || renomor) {
    if (!kode) kode = (st.kode_pc_web || 'W').toUpperCase();
    const key = counterKey(kode, tanggal);
    let n = Number(c.s.all('counters').find((r) => r.key === key)?.value || 0);
    do { n++; nomor = formatNota(prefix, kode, tanggal, n); } while (used.has(nomor));
    no = n;
  }
  bumpCounter(c, counterKey(kode, tanggal), no);

  const now = iso(c.env);
  const order: Row = {
    id, nomor, tanggal, kode_pc: kode, no_urut: no, customer_id: (cust as Row).id, cs_id: str(c.user!.id), total, terbayar: 0, sisa: total,
    status_bayar: statusBayar(total, 0), status_ambil: 'belum', tgl_ambil: '', batal: false, alasan_batal: '', dibuat_offline: offline,
    catatan: str(p.catatan).slice(0, 300), desain: str(p.desain).slice(0, 200), janji_selesai: str(p.janji_selesai).slice(0, 20), created_at: offline && str(p.created_at) ? str(p.created_at) : now, created_by: str(c.user!.id), updated_at: now, updated_by: str(c.user!.id),
  };
  c.s.insert('orders', order);
  items.forEach((i) => c.s.insert('order_items', { ...i, created_at: now, created_by: str(c.user!.id), updated_at: now, updated_by: str(c.user!.id) }));

  const pay = p.payment;
  // pembayaran saat order hanya untuk user yang juga punya akses Kasir (FO normalnya tidak menerima uang)
  if (pay && Number(pay.nominal) > 0 && c.perms?.kasir?.tambah) {
    const method = c.s.all('payment_methods').find((m) => m.id === pay.method_id) || fail('VALIDATION', 'Pilih metode pembayaran.');
    const nominal = Math.min(Math.round(Number(pay.nominal)), total);
    c.s.insert('payments', { id: `${id}-p1`, order_id: id, tanggal, nominal, method_id: (method as Row).id, kasir_id: str(c.user!.id), catatan: 'Bayar saat order', ...stamp(c, true) });
    recalcOrder(c, id);
    ext.hooks.onPayment(c, id);
  }
  log(c, 'nota_baru', 'orders', id, `Nota ${nomor} ${(cust as Row).nama}: ${items.length} item, total ${total.toLocaleString('id-ID')}${offline ? ' — dibuat offline' : ''}${renomor ? ` — nomor diganti dari ${formatNota(prefix, kodeDev, tanggal, Math.round(Number(p.no_urut)))}` : ''}`);
  return { ...orderDetail(c, id), renomor, nomor_awal: renomor ? formatNota(prefix, kodeDev, tanggal, Math.round(Number(p.no_urut))) : '' };
}

// ---------------- handler ----------------
type Handler = (c: Ctx, p: any) => unknown;
const MASTER: Record<string, { perm: string; label: string; prefix: string; required: string[] }> = {
  customers: { perm: 'master.konsumen', label: 'konsumen', prefix: 'cus', required: ['nama'] },
  suppliers: { perm: 'master.supplier', label: 'supplier', prefix: 'sup', required: ['nama'] },
  machines: { perm: 'master.mesin', label: 'mesin', prefix: 'mes', required: ['nama'] },
  payment_methods: { perm: 'master.metode', label: 'metode bayar', prefix: 'pay', required: ['nama'] },
};

function productWithPrice(s: Store, p: Row, today: string, prices?: Row[]) {
  const rows = (prices || s.all('price_history')).filter((r) => r.product_id === p.id) as any[];
  const harga = hargaBerlaku(rows, today);
  const next = rows.filter((r) => r.berlaku_mulai > today).sort((a, b) => a.berlaku_mulai.localeCompare(b.berlaku_mulai))[0] || null;
  return { ...p, harga, harga_berikutnya: next };
}

function tiersFrom(p: any): Row {
  const o: Row = {};
  TIERS.forEach((t) => (o[t.key] = numOrNull(p[t.key])));
  return o;
}

/** Tambah harga baru untuk produk. Harga lama diberi tanggal akhir, tidak pernah dihapus. */
function addPrice(c: Ctx, productId: string, mulai: string, tiers: Row, catatan: string) {
  if (!isYmd(mulai)) fail('VALIDATION', 'Tanggal berlaku tidak valid.');
  const rows = c.s.all('price_history').filter((r) => r.product_id === productId).sort((a, b) => str(b.berlaku_mulai).localeCompare(str(a.berlaku_mulai)));
  const latest = rows[0];
  if (latest && mulai < str(latest.berlaku_mulai)) fail('VALIDATION', `Tanggal berlaku harus sama atau setelah harga terakhir (${latest.berlaku_mulai}).`);
  if (Object.values(tiers).every((v) => v == null)) fail('VALIDATION', 'Isi minimal satu harga.');
  if (latest && mulai === str(latest.berlaku_mulai)) {
    // koreksi harga di tanggal yang sama: perbarui baris itu
    return { row: c.s.update('price_history', 'id', str(latest.id), { ...tiers, catatan: catatan || str(latest.catatan), ...stamp(c, false) }), koreksi: true, sebelum: latest };
  }
  if (latest && !str(latest.berlaku_sampai)) c.s.update('price_history', 'id', str(latest.id), { berlaku_sampai: addDays(mulai, -1), ...stamp(c, false) });
  const row = c.s.insert('price_history', { id: newId(c.env, 'prc'), product_id: productId, berlaku_mulai: mulai, berlaku_sampai: '', ...tiers, catatan, ...stamp(c, true) });
  return { row, koreksi: false, sebelum: latest };
}

function pctLabel(before: any, after: any) {
  const a = Number(before?.rb), b = Number(after?.rb);
  if (!a || !b) return '';
  const pct = ((b - a) / a) * 100;
  return ` (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`;
}

const handlers: Record<string, { auth: boolean; fn: Handler }> = {
  ping: { auth: false, fn: (c) => ({ ok: true, version: API_VERSION, time: iso(c.env), nama_usaha: str(settingsMap(c.s).nama_usaha) }) },
  /** Status perangkat ini sebelum login (dipakai layar pendaftaran aplikasi desktop). Hanya untuk perangkat pemanggil sendiri. */
  'device.check': {
    auth: false,
    fn: (c) => {
      const d = deviceRow(c);
      return d ? { terdaftar: true, status: d.status, kode_pc: d.kode_pc, nama: d.nama, lokasi: d.lokasi, role_izin: parseRoles(d.role_izin) } : { terdaftar: false };
    },
  },

  'auth.login': {
    auth: false,
    fn: (c, p) => {
      const username = str(p.username).toLowerCase();
      const user = c.s.all('users').find((u) => str(u.username).toLowerCase() === username);
      if (!user || !bool(user.aktif) || hashPassword(str(p.password), str(user.salt)) !== user.password_hash) {
        fail('LOGIN_FAILED', 'Username atau password salah.');
      }
      checkHours(c, user!);
      c.s.withLock(() => checkDevice(c, user!, true, cleanInfo(p.device)));
      c.user = user;
      const ses = c.s.withLock(() => makeSession(c, user!));
      log(c, 'login', 'users', str(user!.id), 'Login berhasil');
      return ses;
    },
  },
  'auth.me': { auth: true, fn: (c) => ({ user: publicUser(c.user!), permissions: c.perms }) },
  'auth.logout': {
    auth: true,
    fn: (c) => { c.s.remove('sessions', 'token_hash', sha256('tok:' + c.req.token)); return { ok: true }; },
  },
  'auth.changePassword': {
    auth: true,
    fn: (c, p) => {
      if (hashPassword(str(p.lama), str(c.user!.salt)) !== c.user!.password_hash) fail('VALIDATION', 'Password lama salah.');
      if (str(p.baru).length < 6) fail('VALIDATION', 'Password baru minimal 6 karakter.');
      const salt = c.env.uuid();
      c.s.update('users', 'id', str(c.user!.id), { salt, password_hash: hashPassword(str(p.baru), salt), harus_ganti_password: false, ...stamp(c, false) });
      log(c, 'ganti_password', 'users', str(c.user!.id), 'Mengganti password sendiri');
      return { ok: true };
    },
  },

  // ----- perangkat -----
  'device.list': {
    auth: true,
    fn: (c) => {
      need(c, 'pengaturan.perangkat');
      const mine = deviceRow(c);
      return c.s.all('devices').map(({ device_hash: _h, ...d }) => ({ ...d, is_this_device: !!mine && d.id === mine.id }));
    },
  },
  'device.status': {
    auth: true,
    fn: (c) => {
      const d = deviceRow(c);
      return d ? { terdaftar: true, status: d.status, kode_pc: d.kode_pc, nama: d.nama, lokasi: d.lokasi, role_izin: parseRoles(d.role_izin), printer_koneksi: d.printer_koneksi, printer_alamat: d.printer_alamat, lebar_kertas: d.lebar_kertas, laci_otomatis: d.laci_otomatis } : { terdaftar: false };
    },
  },
  'device.registerThis': {
    auth: true,
    fn: (c, p) => {
      need(c, 'pengaturan.perangkat', 'tambah');
      if (!c.req.deviceId) fail('VALIDATION', 'ID perangkat tidak terbaca.');
      const kode = str(p.kode_pc).toUpperCase();
      if (!/^[A-Z0-9]{1,4}$/.test(kode)) fail('VALIDATION', 'Kode PC 1–4 huruf/angka, misalnya K1.');
      if (!str(p.nama)) fail('VALIDATION', 'Nama perangkat wajib diisi.');
      return c.s.withLock(() => {
        const mine = deviceRow(c);
        const dup = c.s.all('devices').find((d) => str(d.kode_pc).toUpperCase() === kode && d.id !== mine?.id && d.status !== 'dicabut');
        if (dup) fail('VALIDATION', `Kode PC ${kode} sudah dipakai "${dup.nama}".`);
        if (mine?.status !== 'disetujui') checkDeviceLimit(c, str(mine?.id || ''));
        const info = cleanInfo(p.info);
        const data: Row = { kode_pc: kode, nama: str(p.nama), jenis: p.jenis === 'desktop' ? 'desktop' : 'web', status: 'disetujui', disetujui_oleh: str(c.user!.nama), last_seen: iso(c.env),
          lokasi: str(p.lokasi), role_izin: cleanRoles(p.role_izin), ...(info.nama ? { nama_komputer: info.nama } : {}), ...(info.versi ? { versi_app: info.versi } : {}) };
        let row: Row | null;
        if (mine) row = c.s.update('devices', 'id', str(mine.id), { ...data, ...stamp(c, false) });
        else row = c.s.insert('devices', { id: newId(c.env, 'dev'), device_hash: sha256('dev:' + c.req.deviceId), printer_koneksi: '', printer_alamat: '', lebar_kertas: '80', laci_otomatis: false, ...data, ...stamp(c, true) });
        log(c, 'daftar_perangkat', 'devices', str(row!.id), `Mendaftarkan ${str(data.nama)} (${kode})`);
        const { device_hash: _h, ...rest } = row!;
        return rest;
      });
    },
  },
  /** Catat buka laci manual dari halaman kasir (aplikasi desktop). */
  'drawer.open': {
    auth: true,
    fn: (c, p) => {
      need(c, 'kasir', 'tambah');
      const d = deviceRow(c);
      log(c, 'buka_laci', 'devices', str(d?.id), `Buka laci manual di ${str(d?.kode_pc) || 'perangkat tak terdaftar'}`, str(p.alasan).slice(0, 120));
      return { ok: true };
    },
  },
  'device.save': {
    auth: true,
    fn: (c, p) => {
      need(c, 'pengaturan.perangkat', 'ubah');
      const d = p.device || {};
      const cur = c.s.all('devices').find((x) => x.id === d.id) || fail('NOT_FOUND', 'Perangkat tidak ditemukan.');
      const kode = str(d.kode_pc).toUpperCase();
      if (d.status === 'disetujui' && !/^[A-Z0-9]{1,4}$/.test(kode)) fail('VALIDATION', 'Isi kode PC (misalnya K2) sebelum menyetujui perangkat.');
      if (kode && c.s.all('devices').some((x) => str(x.kode_pc).toUpperCase() === kode && x.id !== d.id && x.status !== 'dicabut')) fail('VALIDATION', `Kode PC ${kode} sudah dipakai.`);
      const patch: Row = {
        kode_pc: kode, nama: str(d.nama), jenis: d.jenis === 'desktop' ? 'desktop' : 'web', status: ['menunggu', 'disetujui', 'dicabut'].includes(d.status) ? d.status : 'menunggu',
        printer_koneksi: ['usb', 'lan'].includes(d.printer_koneksi) ? d.printer_koneksi : '', printer_alamat: str(d.printer_alamat),
        lebar_kertas: ['58', '80'].includes(String(d.lebar_kertas)) ? String(d.lebar_kertas) : '', laci_otomatis: bool(d.laci_otomatis),
        lokasi: str(d.lokasi), role_izin: cleanRoles(d.role_izin), ...stamp(c, false),
      };
      if (patch.status === 'disetujui' && (cur as Row).status !== 'disetujui') { checkDeviceLimit(c, str(d.id)); patch.disetujui_oleh = str(c.user!.nama); }
      // jangan sampai admin mengunci dirinya sendiri dari PC yang sedang dipakai
      const izin = parseRoles(patch.role_izin);
      if (izin.length && deviceRow(c)?.id === d.id && c.user!.role !== 'owner' && !izin.includes(str(c.user!.role))) fail('VALIDATION', 'Role Anda tidak termasuk di daftar role PC ini, jadi Anda akan terkunci. Tambahkan role Anda atau minta owner yang mengubah.');
      const row = c.s.update('devices', 'id', str(d.id), patch)!;
      if (patch.status === 'dicabut') c.s.all('sessions').filter((x) => x.device_id === d.id).forEach((x) => c.s.remove('sessions', 'token_hash', str(x.token_hash)));
      log(c, 'ubah_perangkat', 'devices', str(d.id), `${patch.nama} (${kode || '-'}): ${patch.status}`);
      const { device_hash: _h, ...rest } = row;
      return rest;
    },
  },

  // ----- master umum -----
  'master.list': {
    auth: true,
    fn: (c, p) => {
      const m = MASTER[p.table] || fail('VALIDATION', 'Tabel tidak dikenal.');
      need(c, m!.perm);
      return c.s.all(p.table);
    },
  },
  'master.save': {
    auth: true,
    fn: (c, p) => {
      const m = MASTER[p.table] || fail('VALIDATION', 'Tabel tidak dikenal.');
      const r = { ...(p.record || {}) };
      const isNew = !r.id;
      need(c, m!.perm, isNew ? 'tambah' : 'ubah');
      m!.required.forEach((k) => { if (!str(r[k])) fail('VALIDATION', `Kolom ${k} wajib diisi.`); });
      return c.s.withLock(() => {
        const rows = c.s.all(p.table);
        if (rows.some((x) => str(x.nama).toLowerCase() === str(r.nama).toLowerCase() && x.id !== r.id && p.table !== 'customers')) fail('VALIDATION', `Nama ${m!.label} "${r.nama}" sudah ada.`);
        if (p.table === 'customers') {
          if (!str(r.kode)) {
            const max = rows.reduce((a, x) => Math.max(a, Number(x.kode) || 0), 1000);
            r.kode = String(max + 1);
          }
          if (rows.some((x) => str(x.kode) === str(r.kode) && x.id !== r.id)) fail('VALIDATION', `Kode konsumen ${r.kode} sudah dipakai.`);
          r.tipe = r.tipe === 'reseller' ? 'reseller' : 'enduser';
        }
        if (p.table === 'machines' && r.biaya_klik !== undefined) r.biaya_klik = Math.max(0, Number(String(r.biaya_klik).replace(',', '.')) || 0);
        delete r.created_at; delete r.created_by;
        Object.keys(r).forEach((k) => { if (typeof r[k] === 'string') r[k] = r[k].trim(); });
        let row: Row | null;
        if (isNew) row = c.s.insert(p.table, { aktif: true, ...r, id: newId(c.env, m!.prefix), ...stamp(c, true) });
        else row = c.s.update(p.table, 'id', r.id, { ...r, ...stamp(c, false) }) || fail('NOT_FOUND', 'Data tidak ditemukan.');
        log(c, isNew ? 'tambah' : 'ubah', p.table, str(row!.id), `${isNew ? 'Menambah' : 'Mengubah'} ${m!.label} ${r.nama}`);
        return row;
      });
    },
  },

  // ----- produk & harga -----
  'products.list': {
    auth: true,
    fn: (c) => {
      need(c, 'master.produk');
      const today = c.env.today();
      const prices = c.s.all('price_history');
      return c.s.all('products').map((p) => productWithPrice(c.s, p, today, prices));
    },
  },
  'products.save': {
    auth: true,
    fn: (c, p) => {
      const r = { ...(p.product || {}) };
      const isNew = !r.id;
      need(c, 'master.produk', isNew ? 'tambah' : 'ubah');
      if (!str(r.kode)) fail('VALIDATION', 'Kode produk wajib diisi.');
      if (!str(r.nama)) fail('VALIDATION', 'Nama produk wajib diisi.');
      if (!['matriks', 'cutting', 'tetap', 'manual'].includes(r.jenis_harga)) fail('VALIDATION', 'Pilih jenis harga.');
      return c.s.withLock(() => {
        if (c.s.all('products').some((x) => str(x.kode).toLowerCase() === str(r.kode).toLowerCase() && x.id !== r.id)) fail('VALIDATION', `Kode produk ${r.kode} sudah dipakai.`);
        const data = { kode: str(r.kode), nama: str(r.nama), kategori: str(r.kategori), mesin_id: str(r.mesin_id), jenis_harga: r.jenis_harga, satuan: str(r.satuan) || 'lembar', aktif: r.aktif !== false };
        let row: Row;
        if (isNew) row = c.s.insert('products', { id: newId(c.env, 'prd'), ...data, ...stamp(c, true) });
        else row = c.s.update('products', 'id', r.id, { ...data, ...stamp(c, false) }) || fail('NOT_FOUND', 'Produk tidak ditemukan.');
        if (isNew && p.harga && data.jenis_harga !== 'manual') {
          const t = tiersFrom(p.harga);
          if (Object.values(t).some((v) => v != null)) addPrice(c, str(row.id), str(p.harga.berlaku_mulai) || c.env.today(), t, 'Harga awal');
        }
        log(c, isNew ? 'tambah' : 'ubah', 'products', str(row.id), `${isNew ? 'Menambah' : 'Mengubah'} produk ${data.kode} ${data.nama}`);
        return productWithPrice(c.s, row, c.env.today());
      });
    },
  },
  'price.history': {
    auth: true,
    fn: (c, p) => {
      need(c, 'master.produk');
      return c.s.all('price_history').filter((r) => r.product_id === p.product_id).sort((a, b) => str(b.berlaku_mulai).localeCompare(str(a.berlaku_mulai)));
    },
  },
  'price.add': {
    auth: true,
    fn: (c, p) => {
      need(c, 'master.produk', 'ubah');
      const prod = c.s.all('products').find((x) => x.id === p.product_id) || fail('NOT_FOUND', 'Produk tidak ditemukan.');
      return c.s.withLock(() => {
        const mulai = str(p.berlaku_mulai) || c.env.today();
        const res = addPrice(c, str(p.product_id), mulai, tiersFrom(p), str(p.catatan));
        log(c, res.koreksi ? 'koreksi_harga' : 'harga_baru', 'price_history', str(res.row!.id),
          `${res.koreksi ? 'Koreksi' : 'Harga baru'} ${(prod as Row).nama} berlaku ${mulai}${pctLabel(res.sebelum, res.row)}`, str(p.catatan));
        return res.row;
      });
    },
  },
  'products.import': {
    auth: true,
    fn: (c, p) => {
      need(c, 'master.produk', 'tambah');
      need(c, 'master.produk', 'ubah');
      const mulai = str(p.berlaku_mulai) || c.env.today();
      const rows: any[] = Array.isArray(p.rows) ? p.rows : [];
      if (!rows.length) fail('VALIDATION', 'File tidak berisi baris produk.');
      const machines = c.s.all('machines');
      const res = { dibuat: 0, diperbarui: 0, harga: 0, dilewati: [] as string[] };
      c.s.withLock(() => {
        rows.forEach((r, i) => {
          const kode = str(r.kode), nama = str(r.nama);
          if (!kode || !nama) { res.dilewati.push(`Baris ${i + 2}: kode/nama kosong`); return; }
          const jenis = ['matriks', 'cutting', 'tetap', 'manual'].includes(str(r.jenis_harga)) ? str(r.jenis_harga) : 'matriks';
          let mesinId = '';
          const mesinNama = str(r.mesin);
          if (mesinNama) {
            let m = machines.find((x) => str(x.nama).toLowerCase() === mesinNama.toLowerCase());
            if (!m) { m = c.s.insert('machines', { id: newId(c.env, 'mes'), nama: mesinNama, pakai_counter: false, aktif: true, ...stamp(c, true) }); machines.push(m); }
            mesinId = str(m.id);
          }
          const data = { kode, nama, kategori: str(r.kategori), mesin_id: mesinId, jenis_harga: jenis, satuan: str(r.satuan) || 'lembar', aktif: r.aktif === undefined || r.aktif === '' ? true : bool(r.aktif) };
          let prod = c.s.all('products').find((x) => str(x.kode).toLowerCase() === kode.toLowerCase());
          if (prod) { c.s.update('products', 'id', str(prod.id), { ...data, ...stamp(c, false) }); res.diperbarui++; }
          else { prod = c.s.insert('products', { id: newId(c.env, 'prd'), ...data, ...stamp(c, true) }); res.dibuat++; }
          const t = tiersFrom(r);
          if (jenis !== 'manual' && Object.values(t).some((v) => v != null)) {
            const cur = hargaBerlaku(c.s.all('price_history').filter((x) => x.product_id === prod!.id) as any, mulai) as any;
            const same = cur && TIERS.every((tt) => (cur[tt.key] ?? null) === (t[tt.key] ?? null));
            if (!same) {
              try { addPrice(c, str(prod.id), mulai, t, 'Import Excel'); res.harga++; }
              catch (e) { res.dilewati.push(`Baris ${i + 2} (${kode}): ${(e as Error).message}`); }
            }
          }
        });
      });
      log(c, 'import', 'products', '', `Import produk: ${res.dibuat} baru, ${res.diperbarui} diperbarui, ${res.harga} harga baru (berlaku ${mulai})`);
      return res;
    },
  },

  // ----- user & role -----
  'users.list': { auth: true, fn: (c) => { need(c, 'pengaturan.user'); return c.s.all('users').map(publicUser); } },
  'users.save': {
    auth: true,
    fn: (c, p) => {
      const u = { ...(p.user || {}) };
      const isNew = !u.id;
      need(c, 'pengaturan.user', isNew ? 'tambah' : 'ubah');
      const username = str(u.username).toLowerCase();
      if (!/^[a-z0-9._-]{3,30}$/.test(username)) fail('VALIDATION', 'Username 3–30 karakter: huruf kecil, angka, titik, minus.');
      if (!str(u.nama)) fail('VALIDATION', 'Nama wajib diisi.');
      if (!['owner', 'admin', 'cs', 'kasir', 'operator', 'keuangan'].includes(u.role)) fail('VALIDATION', 'Role tidak dikenal.');
      if (u.role === 'owner' && c.user!.role !== 'owner') fail('FORBIDDEN', 'Hanya owner yang bisa membuat atau mengubah akun owner.');
      if (isNew && str(p.password).length < 6) fail('VALIDATION', 'Password minimal 6 karakter.');
      return c.s.withLock(() => {
        const users = c.s.all('users');
        if (users.some((x) => str(x.username).toLowerCase() === username && x.id !== u.id)) fail('VALIDATION', `Username ${username} sudah dipakai.`);
        const cur = users.find((x) => x.id === u.id);
        if (cur?.role === 'owner' && c.user!.role !== 'owner') fail('FORBIDDEN', 'Hanya owner yang bisa mengubah akun owner.');
        const aktif = u.aktif !== false;
        if (cur && cur.role === 'owner' && (u.role !== 'owner' || !aktif) && users.filter((x) => x.role === 'owner' && bool(x.aktif)).length <= 1) {
          fail('VALIDATION', 'Harus ada minimal satu owner aktif.');
        }
        const data: Row = {
          username, nama: str(u.nama), role: u.role, khusus_kantor: bool(u.khusus_kantor), aktif,
          jam_login_dari: str(u.jam_login_dari), jam_login_sampai: str(u.jam_login_sampai),
        };
        if (str(p.password)) {
          if (str(p.password).length < 6) fail('VALIDATION', 'Password minimal 6 karakter.');
          const salt = c.env.uuid();
          Object.assign(data, { salt, password_hash: hashPassword(str(p.password), salt), harus_ganti_password: true });
        }
        let row: Row;
        if (isNew) row = c.s.insert('users', { id: newId(c.env, 'usr'), ...data, ...stamp(c, true) });
        else row = c.s.update('users', 'id', u.id, { ...data, ...stamp(c, false) }) || fail('NOT_FOUND', 'User tidak ditemukan.');
        if (!aktif) c.s.all('sessions').filter((x) => x.user_id === row.id).forEach((x) => c.s.remove('sessions', 'token_hash', str(x.token_hash)));
        log(c, isNew ? 'tambah' : 'ubah', 'users', str(row.id), `${isNew ? 'Menambah' : 'Mengubah'} user ${username} (${u.role})${str(p.password) && !isNew ? ', reset password' : ''}`);
        return publicUser(row);
      });
    },
  },
  'roles.get': {
    auth: true,
    fn: (c) => {
      need(c, 'pengaturan.role');
      const out: Record<string, PermissionMap> = {};
      ['owner', 'admin', 'cs', 'kasir', 'operator', 'keuangan'].forEach((r) => (out[r] = permsFor(c.s, r)));
      return out;
    },
  },
  'roles.save': {
    auth: true,
    fn: (c, p) => {
      need(c, 'pengaturan.role', 'ubah');
      if (p.role === 'owner') fail('VALIDATION', 'Hak akses owner selalu penuh.');
      if (p.role === 'admin' && c.user!.role !== 'owner') fail('FORBIDDEN', 'Hanya owner yang bisa mengubah hak akses admin.');
      const clean: PermissionMap = {};
      MODULES.forEach((m) => {
        const v = (p.permissions || {})[m.key] || {};
        clean[m.key] = { lihat: !!v.lihat, tambah: !!v.tambah, ubah: !!v.ubah, hapus: !!v.hapus, ekspor: !!v.ekspor };
      });
      c.s.withLock(() => {
        const exists = c.s.all('role_permissions').some((r) => r.role === p.role);
        if (exists) c.s.update('role_permissions', 'role', p.role, { permissions: clean, updated_at: iso(c.env), updated_by: str(c.user!.id) });
        else c.s.insert('role_permissions', { role: p.role, permissions: clean, updated_at: iso(c.env), updated_by: str(c.user!.id) });
      });
      log(c, 'ubah_hak_akses', 'role_permissions', p.role, `Mengubah hak akses role ${p.role}`);
      return clean;
    },
  },

  // ----- kasir & order (Tahap 2) -----
  'pos.bootstrap': {
    auth: true,
    fn: (c) => {
      if (!c.perms?.fo?.lihat && !c.perms?.kasir?.lihat) fail('FORBIDDEN', 'Anda tidak punya akses untuk tindakan ini.');
      const today = c.env.today();
      const prices = c.s.all('price_history');
      const st = settingsMap(c.s);
      const dev = deviceRow(c);
      const kode = dev && dev.status === 'disetujui' ? str(dev.kode_pc) : '';
      const counter = kode ? Number(c.s.all('counters').find((r) => r.key === counterKey(kode, today))?.value || 0) : 0;
      return {
        today,
        settings: st,
        device: dev ? { kode_pc: kode, nama: dev.nama, status: dev.status, printer_koneksi: dev.printer_koneksi, printer_alamat: dev.printer_alamat, lebar_kertas: dev.lebar_kertas, laci_otomatis: bool(dev.laci_otomatis) } : null,
        counter: { key: kode ? counterKey(kode, today) : '', value: counter },
        products: c.s.all('products').filter((p) => bool(p.aktif)).map((p) => productWithPrice(c.s, p, today, prices)),
        // harga terjadwal ikut dikirim supaya saat offline lewat tengah malam harga tetap benar
        price_rows: prices.filter((r) => !str(r.berlaku_sampai) || str(r.berlaku_sampai) >= addDays(today, -1)),
        customers: c.s.all('customers').filter((x) => bool(x.aktif)).map((x) => ({ id: x.id, kode: x.kode, nama: x.nama, telp: x.telp, tipe: x.tipe })),
        payment_methods: c.s.all('payment_methods').filter((x) => bool(x.aktif)),
        machines: c.s.all('machines'),
        can_manual: !!c.perms?.['kasir.harga_manual']?.ubah,
      };
    },
  },
  'orders.create': {
    auth: true,
    fn: (c, p) => {
      need(c, 'fo', 'tambah');
      return c.s.withLock(() => createOrder(c, p));
    },
  },
  'orders.list': {
    auth: true,
    fn: (c, p) => {
      if (!c.perms?.order?.lihat && !c.perms?.piutang?.lihat && !c.perms?.kasir?.lihat && !c.perms?.fo?.lihat) fail('FORBIDDEN', 'Anda tidak punya akses untuk tindakan ini.');
      const from = str(p.from), to = str(p.to), piutang = !!p.piutang;
      const cust = Object.fromEntries(c.s.all('customers').map((x) => [x.id, x]));
      const users = Object.fromEntries(c.s.all('users').map((x) => [x.id, x.nama]));
      const orders = c.s.all('orders').filter((o) => piutang ? !bool(o.batal) && Number(o.sisa) > 0 : (!from || str(o.tanggal) >= from) && (!to || str(o.tanggal) <= to));
      const ids = new Set(orders.map((o) => o.id));
      const itemsBy: Record<string, Row[]> = {};
      c.s.all('order_items').forEach((it) => { if (ids.has(it.order_id)) (itemsBy[str(it.order_id)] ||= []).push(it); });
      return orders.map((o) => {
        const its = itemsBy[str(o.id)] || [];
        const cu = cust[str(o.customer_id)] || {};
        return {
          ...o, customer_nama: str((cu as Row).nama), customer_telp: str((cu as Row).telp), customer_tipe: str((cu as Row).tipe), cs_nama: str(users[str(o.cs_id)]),
          item_count: its.length, ringkas: its.map((i) => i.nama_produk).filter((v, i, a) => a.indexOf(v) === i).join(', ').slice(0, 120),
          produksi_selesai: its.length > 0 && its.every((i) => i.status_produksi === 'selesai'),
        };
      });
    },
  },
  'orders.get': {
    auth: true,
    fn: (c, p) => {
      if (!c.perms?.order?.lihat && !c.perms?.piutang?.lihat && !c.perms?.kasir?.lihat && !c.perms?.fo?.lihat) fail('FORBIDDEN', 'Anda tidak punya akses untuk tindakan ini.');
      return orderDetail(c, str(p.order_id));
    },
  },
  'orders.pay': {
    auth: true,
    fn: (c, p) => {
      if (!c.perms?.kasir?.tambah && !c.perms?.order?.ubah && !c.perms?.piutang?.ubah) fail('FORBIDDEN', 'Anda tidak punya akses untuk mencatat pembayaran.');
      return c.s.withLock(() => {
        const pid = str(p.payment_id) || newId(c.env, 'pmt');
        const exist = c.s.all('payments').find((x) => x.id === pid);
        if (exist) return { ...orderDetail(c, str(exist.order_id)), duplikat: true };
        const o = c.s.all('orders').find((x) => x.id === p.order_id) || fail('NOT_FOUND', 'Nota tidak ditemukan. Bila nota dibuat saat offline, tunggu sampai nota itu terkirim.');
        if (bool((o as Row).batal)) fail('VALIDATION', 'Nota ini sudah dibatalkan.');
        const nominal = Math.round(Number(p.nominal) || 0);
        if (nominal <= 0) fail('VALIDATION', 'Nominal pembayaran harus lebih dari 0.');
        const offline = bool(p.dibuat_offline);
        if (!offline && nominal > Number((o as Row).sisa)) fail('VALIDATION', `Nominal melebihi sisa tagihan (${Number((o as Row).sisa).toLocaleString('id-ID')}).`);
        const method = c.s.all('payment_methods').find((m) => m.id === p.method_id) || fail('VALIDATION', 'Pilih metode pembayaran.');
        const tanggal = offline && isYmd(str(p.tanggal)) && str(p.tanggal) <= c.env.today() ? str(p.tanggal) : c.env.today();
        c.s.insert('payments', { id: pid, order_id: (o as Row).id, tanggal, nominal, method_id: (method as Row).id, kasir_id: str(c.user!.id), catatan: str(p.catatan), ...stamp(c, true) });
        recalcOrder(c, str((o as Row).id));
        ext.hooks.onPayment(c, str((o as Row).id));
        log(c, 'bayar', 'orders', str((o as Row).id), `Pembayaran ${nominal.toLocaleString('id-ID')} (${(method as Row).nama}) untuk ${(o as Row).id}${offline ? ' — dibuat offline' : ''}`);
        return orderDetail(c, str((o as Row).id));
      });
    },
  },
  'orders.ambil': {
    auth: true,
    fn: (c, p) => {
      need(c, 'order', 'ubah');
      return c.s.withLock(() => {
        const o = c.s.all('orders').find((x) => x.id === p.order_id) || fail('NOT_FOUND', 'Nota tidak ditemukan.');
        const ambil = p.diambil !== false;
        if (ambil && Number((o as Row).sisa) > 0 && !str(p.alasan)) fail('NEED_REASON', 'Nota masih ada sisa tagihan. Isi alasan bila tetap diserahkan.');
        c.s.update('orders', 'id', str((o as Row).id), { status_ambil: ambil ? 'diambil' : 'belum', tgl_ambil: ambil ? iso(c.env) : '', ...stamp(c, false) });
        if (ambil) ext.hooks.onPickup(c, str((o as Row).id));
        log(c, ambil ? 'ambil' : 'batal_ambil', 'orders', str((o as Row).id), `${ambil ? 'Diambil' : 'Batal diambil'}: ${(o as Row).id}`, str(p.alasan));
        return orderDetail(c, str((o as Row).id));
      });
    },
  },
  'orders.cancel': {
    auth: true,
    fn: (c, p) => {
      need(c, 'order', 'hapus');
      if (!str(p.alasan)) fail('VALIDATION', 'Isi alasan pembatalan.');
      return c.s.withLock(() => {
        const o = c.s.all('orders').find((x) => x.id === p.order_id) || fail('NOT_FOUND', 'Nota tidak ditemukan.');
        if (Number((o as Row).terbayar) > 0) fail('VALIDATION', 'Nota sudah ada pembayaran. Pengembalian uang dicatat di modul Pengeluaran (Tahap 5), baru nota bisa dibatalkan.');
        c.s.update('orders', 'id', str((o as Row).id), { batal: true, alasan_batal: str(p.alasan), sisa: 0, status_bayar: 'batal', ...stamp(c, false) });
        c.s.all('order_items').filter((i) => i.order_id === (o as Row).id).forEach((i) => c.s.update('order_items', 'id', str(i.id), { status_produksi: 'batal' }));
        log(c, 'batal_nota', 'orders', str((o as Row).id), `Membatalkan ${(o as Row).id} senilai ${Number((o as Row).total).toLocaleString('id-ID')}`, str(p.alasan));
        return orderDetail(c, str((o as Row).id));
      });
    },
  },

  // ----- produksi (Tahap 4) -----
  'production.list': {
    auth: true,
    fn: (c, p) => {
      need(c, 'produksi');
      const doneDays = Math.max(0, Math.min(30, Number(p.done_days ?? 1)));
      const since = addDays(c.env.today(), -doneDays);
      const orders = Object.fromEntries(c.s.all('orders').filter((o) => !bool(o.batal)).map((o) => [o.id, o]));
      const cust = Object.fromEntries(c.s.all('customers').map((x) => [x.id, x.nama]));
      const users = Object.fromEntries(c.s.all('users').map((x) => [x.id, x.nama]));
      const jenis = Object.fromEntries(c.s.all('products').map((x) => [x.id, x.jenis_harga]));
      const mesinNama = Object.fromEntries(c.s.all('machines').map((x) => [x.id, x.nama]));
      return c.s.all('order_items').filter((i) => {
        const o = orders[str(i.order_id)];
        if (!o || i.status_produksi === 'batal') return false;
        if (i.status_produksi !== 'selesai') return true;
        return o.status_ambil !== 'diambil' && str(i.selesai_at).slice(0, 10) >= since;
      }).map((i) => {
        const o = orders[str(i.order_id)] as Row;
        return {
          id: i.id, order_id: i.order_id, nomor: o.nomor, tanggal: o.tanggal, order_created: o.created_at, customer: str(cust[str(o.customer_id)]), fo: str(users[str(o.cs_id)]),
          desain: o.desain, janji_selesai: o.janji_selesai, catatan: o.catatan, status_bayar: o.status_bayar,
          nama_produk: i.nama_produk, keterangan: i.keterangan, qty: i.qty, sisi: i.sisi, klik: i.klik, ukuran_cutting: i.ukuran_cutting, jenis_harga: str(jenis[str(i.product_id)]),
          mesin_id: i.mesin_id, mesin_nama: str(mesinNama[str(i.mesin_id)]), status_produksi: i.status_produksi, operator: str(users[str(i.operator_id)]), selesai_at: i.selesai_at, updated_at: i.updated_at,
        };
      });
    },
  },
  'production.move': {
    auth: true,
    fn: (c, p) => {
      need(c, 'produksi', 'ubah');
      const to = str(p.status);
      if (!['antrian', 'proses', 'selesai'].includes(to)) fail('VALIDATION', 'Status tidak dikenal.');
      return c.s.withLock(() => {
        const ids: string[] = Array.isArray(p.item_ids) ? p.item_ids.map(str) : [str(p.item_id)];
        const items = c.s.all('order_items').filter((i) => ids.includes(str(i.id)));
        if (!items.length) fail('NOT_FOUND', 'Item tidak ditemukan.');
        items.forEach((i) => {
          if (i.status_produksi === 'batal') fail('VALIDATION', 'Item dari nota yang dibatalkan.');
          c.s.update('order_items', 'id', str(i.id), {
            status_produksi: to, operator_id: to === 'antrian' ? '' : str(i.operator_id) || str(c.user!.id), selesai_at: to === 'selesai' ? iso(c.env) : '', ...stamp(c, false),
          });
        });
        if (to === 'selesai') ext.hooks.onProductionDone(c, ids);
        log(c, 'produksi', 'order_items', ids.join(','), `${items.map((i) => i.nama_produk).join(', ')} → ${to}`);
        return { ok: true, count: items.length };
      });
    },
  },

  // ----- counter mesin (Tahap 4) -----
  'counter.list': {
    auth: true,
    fn: (c, p) => {
      need(c, 'mesin');
      const from = str(p.from) || addDays(c.env.today(), -30), to = str(p.to) || c.env.today();
      const orders = Object.fromEntries(c.s.all('orders').filter((o) => !bool(o.batal)).map((o) => [o.id, o.tanggal]));
      // klik dari FO per tanggal+mesin (dari isi nota)
      const fo: Record<string, number> = {};
      c.s.all('order_items').forEach((i) => {
        const t = str(orders[str(i.order_id)]);
        if (!t || t < from || t > to) return;
        const k = `${t}|${i.mesin_id}`; fo[k] = (fo[k] || 0) + Number(i.klik || 0);
      });
      const machines = c.s.all('machines').filter((m) => bool(m.pakai_counter));
      const rows = c.s.all('machine_counters').filter((r) => str(r.tanggal) >= from && str(r.tanggal) <= to);
      // baris yang belum diisi tetap muncul bila ada klik FO, supaya kelihatan
      Object.keys(fo).forEach((k) => {
        const [t, m] = k.split('|');
        if (machines.some((x) => x.id === m) && !rows.some((r) => r.tanggal === t && r.mesin_id === m)) rows.push({ id: '', tanggal: t, mesin_id: m });
      });
      const last = (mesin: string, before: string) => c.s.all('machine_counters').filter((r) => r.mesin_id === mesin && str(r.tanggal) < before && r.counter_akhir != null)
        .sort((a, b) => str(b.tanggal).localeCompare(str(a.tanggal)))[0];
      return {
        machines: machines.map((m) => ({ id: m.id, nama: m.nama, aktif: bool(m.aktif) })),
        rows: rows.map((r) => {
          const klikMesin = r.counter_akhir != null && r.counter_awal != null ? Number(r.counter_akhir) - Number(r.counter_awal) : null;
          const reject = Number(r.reject_trouble || 0) + Number(r.reject_operator || 0) + Number(r.reject_fo || 0);
          const klikFo = fo[`${r.tanggal}|${r.mesin_id}`] || 0;
          const batal = Number(r.batal || 0);
          return { ...r, klik_mesin: klikMesin, reject, klik_fo: klikFo, selisih: klikMesin == null ? null : klikMesin - reject - (klikFo - batal), awal_saran: last(str(r.mesin_id), str(r.tanggal))?.counter_akhir ?? null };
        }),
        last_akhir: Object.fromEntries(machines.map((m) => [m.id, last(str(m.id), '9999')?.counter_akhir ?? null])),
      };
    },
  },
  'counter.save': {
    auth: true,
    fn: (c, p) => {
      const r = p.row || {};
      if (!isYmd(str(r.tanggal))) fail('VALIDATION', 'Tanggal tidak valid.');
      if (str(r.tanggal) > c.env.today()) fail('VALIDATION', 'Tanggal tidak boleh setelah hari ini.');
      const m = c.s.all('machines').find((x) => x.id === r.mesin_id) || fail('VALIDATION', 'Pilih mesin.');
      const n = (k: string) => { const v = numOrNull(r[k]); if (v != null && v < 0) fail('VALIDATION', `${k} tidak boleh negatif.`); return v; };
      const data: Row = {
        tanggal: str(r.tanggal), mesin_id: (m as Row).id, counter_awal: n('counter_awal'), counter_akhir: n('counter_akhir'), reject_trouble: n('reject_trouble') || 0,
        reject_operator: n('reject_operator') || 0, reject_fo: n('reject_fo') || 0, batal: n('batal') || 0, keterangan: str(r.keterangan).slice(0, 300),
      };
      if (data.counter_awal != null && data.counter_akhir != null && Number(data.counter_akhir) < Number(data.counter_awal)) fail('VALIDATION', 'Counter tutup lebih kecil dari counter masuk.');
      return c.s.withLock(() => {
        const ex = c.s.all('machine_counters').find((x) => x.tanggal === data.tanggal && x.mesin_id === data.mesin_id);
        need(c, 'mesin', ex ? 'ubah' : 'tambah');
        const row = ex ? c.s.update('machine_counters', 'id', str(ex.id), { ...data, ...stamp(c, false) }) : c.s.insert('machine_counters', { id: newId(c.env, 'cnt'), ...data, ...stamp(c, true) });
        log(c, ex ? 'ubah' : 'tambah', 'machine_counters', str(row!.id), `Counter ${(m as Row).nama} ${data.tanggal}: ${data.counter_awal ?? '-'} → ${data.counter_akhir ?? '-'}`);
        return row;
      });
    },
  },

  // ----- kas (Tahap 4) -----
  'kas.rekap': {
    auth: true,
    fn: (c, p) => {
      need(c, 'kas');
      const t = isYmd(str(p.tanggal)) ? str(p.tanggal) : c.env.today();
      const users = Object.fromEntries(c.s.all('users').map((x) => [x.id, x.nama]));
      const methods = c.s.all('payment_methods');
      const pays = c.s.all('payments').filter((x) => x.tanggal === t);
      const sys: Record<string, number> = {}; const cnt: Record<string, number> = {};
      pays.forEach((x) => { const k = `${x.kasir_id}|${x.method_id}`; sys[k] = (sys[k] || 0) + Number(x.nominal || 0); cnt[k] = (cnt[k] || 0) + 1; });
      const deps = c.s.all('cash_deposits').filter((d) => d.tanggal === t);
      const keys = new Set([...Object.keys(sys), ...deps.map((d) => `${d.kasir_id}|${d.method_id}`)]);
      const pcOut = c.s.all('petty_cash').filter((x) => x.tanggal === t && !bool(x.deleted)).reduce((a, x) => a + Number(x.keluar || 0), 0);
      return {
        tanggal: t,
        kas_kecil_keluar: pcOut,
        rows: Array.from(keys).map((k) => {
          const [kasir, method] = k.split('|');
          const d = deps.find((x) => x.kasir_id === kasir && x.method_id === method);
          const m = methods.find((x) => x.id === method);
          return { kasir_id: kasir, kasir_nama: str(users[kasir]) || '(tanpa kasir)', method_id: method, method_nama: str(m?.nama), jenis: str(m?.jenis), sistem: sys[k] || 0, transaksi: cnt[k] || 0,
            aktual: d ? d.aktual : null, selisih: d ? Number(d.aktual) - (sys[k] || 0) : null, keterangan: d ? d.keterangan : '', dicatat_oleh: d ? str(users[str(d.updated_by)]) : '', dicatat_at: d ? d.updated_at : '' };
        }).sort((a, b) => a.kasir_nama.localeCompare(b.kasir_nama) || a.method_nama.localeCompare(b.method_nama)),
      };
    },
  },
  'kas.setor': {
    auth: true,
    fn: (c, p) => {
      need(c, 'kas', 'ubah');
      const t = str(p.tanggal);
      if (!isYmd(t)) fail('VALIDATION', 'Tanggal tidak valid.');
      const rows: any[] = Array.isArray(p.rows) ? p.rows : [];
      return c.s.withLock(() => {
        rows.forEach((r) => {
          if (r.aktual === '' || r.aktual == null) return;
          const aktual = Math.round(Number(r.aktual));
          if (isNaN(aktual) || aktual < 0) fail('VALIDATION', 'Nominal aktual tidak valid.');
          const sistem = c.s.all('payments').filter((x) => x.tanggal === t && x.kasir_id === r.kasir_id && x.method_id === r.method_id).reduce((a, x) => a + Number(x.nominal || 0), 0);
          const ex = c.s.all('cash_deposits').find((d) => d.tanggal === t && d.kasir_id === r.kasir_id && d.method_id === r.method_id);
          const data = { tanggal: t, kasir_id: str(r.kasir_id), method_id: str(r.method_id), sistem, aktual, selisih: aktual - sistem, keterangan: str(r.keterangan).slice(0, 300) };
          if (aktual !== sistem && !data.keterangan) fail('VALIDATION', 'Ada selisih. Isi keterangan untuk baris yang tidak cocok.');
          if (ex) c.s.update('cash_deposits', 'id', str(ex.id), { ...data, ...stamp(c, false) });
          else c.s.insert('cash_deposits', { id: newId(c.env, 'dep'), ...data, ...stamp(c, true) });
        });
        log(c, 'tutup_kasir', 'cash_deposits', t, `Tutup kasir ${t}: ${rows.filter((r) => r.aktual !== '' && r.aktual != null).length} baris`);
        return { ok: true };
      });
    },
  },
  'pettycash.list': {
    auth: true,
    fn: (c, p) => {
      need(c, 'kas');
      const all = c.s.all('petty_cash').filter((x) => !bool(x.deleted)).sort((a, b) => (str(a.tanggal) + str(a.created_at)).localeCompare(str(b.tanggal) + str(b.created_at)));
      let saldo = 0;
      const users = Object.fromEntries(c.s.all('users').map((x) => [x.id, x.nama]));
      const rows: Row[] = all.map((x) => { saldo += Number(x.masuk || 0) - Number(x.keluar || 0); return { ...x, saldo, oleh: str(users[str(x.created_by)]) }; });
      const from = str(p.from), to = str(p.to);
      return { saldo, rows: rows.filter((x) => (!from || str(x.tanggal) >= from) && (!to || str(x.tanggal) <= to)) };
    },
  },
  'pettycash.save': {
    auth: true,
    fn: (c, p) => {
      need(c, 'kas', 'tambah');
      const r = p.row || {};
      if (!isYmd(str(r.tanggal)) || str(r.tanggal) > c.env.today()) fail('VALIDATION', 'Tanggal tidak valid.');
      if (!str(r.item)) fail('VALIDATION', 'Isi keterangan transaksi.');
      const masuk = Math.round(Number(r.masuk) || 0), keluar = Math.round(Number(r.keluar) || 0);
      if ((masuk > 0) === (keluar > 0)) fail('VALIDATION', 'Isi salah satu: uang masuk atau uang keluar.');
      if (masuk < 0 || keluar < 0) fail('VALIDATION', 'Nominal tidak boleh negatif.');
      return c.s.withLock(() => {
        const row = c.s.insert('petty_cash', { id: newId(c.env, 'kk'), tanggal: str(r.tanggal), item: str(r.item).slice(0, 200), masuk, keluar, keterangan: str(r.keterangan).slice(0, 300), deleted: false, ...stamp(c, true) });
        log(c, 'kas_kecil', 'petty_cash', str(row.id), `${masuk ? 'Masuk' : 'Keluar'} ${(masuk || keluar).toLocaleString('id-ID')}: ${r.item}`);
        return row;
      });
    },
  },
  'pettycash.delete': {
    auth: true,
    fn: (c, p) => {
      need(c, 'kas', 'hapus');
      if (!str(p.alasan)) fail('VALIDATION', 'Isi alasan penghapusan.');
      return c.s.withLock(() => {
        const x = c.s.all('petty_cash').find((r) => r.id === p.id) || fail('NOT_FOUND', 'Data tidak ditemukan.');
        c.s.update('petty_cash', 'id', str((x as Row).id), { deleted: true, ...stamp(c, false) });
        log(c, 'hapus', 'petty_cash', str((x as Row).id), `Hapus kas kecil ${(x as Row).item} (${Number((x as Row).masuk || (x as Row).keluar).toLocaleString('id-ID')})`, str(p.alasan));
        return { ok: true };
      });
    },
  },

  // ----- pengeluaran (Tahap 5) -----
  'expense.meta': {
    auth: true,
    fn: (c) => {
      if (!c.perms?.pengeluaran?.lihat && !c.perms?.hutang?.lihat) fail('FORBIDDEN', 'Anda tidak punya akses untuk tindakan ini.');
      return {
        categories: c.s.all('expense_categories'),
        suppliers: c.s.all('suppliers').filter((x) => bool(x.aktif)).map((x) => ({ id: x.id, nama: x.nama, bahan: x.bahan })),
        products: c.s.all('products').filter((x) => bool(x.aktif)).map((x) => ({ id: x.id, kode: x.kode, nama: x.nama, satuan: x.satuan })),
        machines: c.s.all('machines').filter((x) => bool(x.aktif)).map((x) => ({ id: x.id, nama: x.nama })),
        payment_methods: c.s.all('payment_methods').filter((x) => bool(x.aktif)).map((x) => ({ id: x.id, nama: x.nama, jenis: x.jenis })),
      };
    },
  },
  'expense.category.save': {
    auth: true,
    fn: (c, p) => {
      need(c, 'pengeluaran', 'ubah');
      const r = p.category || {};
      if (!str(r.nama)) fail('VALIDATION', 'Nama kategori wajib diisi.');
      const jenis = ['bahan', 'operasional', 'gaji', 'aset', 'klik', 'lain'].includes(r.jenis) ? r.jenis : 'operasional';
      return c.s.withLock(() => {
        if (c.s.all('expense_categories').some((x) => str(x.nama).toLowerCase() === str(r.nama).toLowerCase() && x.id !== r.id)) fail('VALIDATION', 'Kategori sudah ada.');
        const data = { nama: str(r.nama), jenis, aktif: r.aktif !== false };
        const row = r.id ? c.s.update('expense_categories', 'id', r.id, { ...data, ...stamp(c, false) }) : c.s.insert('expense_categories', { id: newId(c.env, 'cat'), ...data, ...stamp(c, true) });
        log(c, r.id ? 'ubah' : 'tambah', 'expense_categories', str(row!.id), `Kategori pengeluaran ${data.nama}`);
        return row;
      });
    },
  },
  'expense.list': {
    auth: true,
    fn: (c, p) => {
      need(c, 'pengeluaran');
      const from = str(p.from), to = str(p.to);
      const cats = Object.fromEntries(c.s.all('expense_categories').map((x) => [x.id, x]));
      const sup = Object.fromEntries(c.s.all('suppliers').map((x) => [x.id, x.nama]));
      const met = Object.fromEntries(c.s.all('payment_methods').map((x) => [x.id, x.nama]));
      const users = Object.fromEntries(c.s.all('users').map((x) => [x.id, x.nama]));
      const bills = Object.fromEntries(c.s.all('supplier_bills').map((x) => [x.id, x]));
      return c.s.all('expenses').filter((x) => !bool(x.deleted) && (!from || str(x.tanggal) >= from) && (!to || str(x.tanggal) <= to)).map((x) => ({
        ...x, kategori: str((cats[str(x.kategori_id)] as Row)?.nama), kategori_jenis: str((cats[str(x.kategori_id)] as Row)?.jenis), supplier: str(sup[str(x.supplier_id)]),
        metode: str(met[str(x.method_id)]), oleh: str(users[str(x.created_by)]), sisa_hutang: x.bill_id ? Number((bills[str(x.bill_id)] as Row)?.sisa || 0) : 0,
      }));
    },
  },
  'expense.save': {
    auth: true,
    fn: (c, p) => {
      need(c, 'pengeluaran', 'tambah');
      const r = p.expense || {};
      const t = str(r.tanggal);
      if (!isYmd(t) || t > c.env.today()) fail('VALIDATION', 'Tanggal tidak valid.');
      const cat = c.s.all('expense_categories').find((x) => x.id === r.kategori_id) || fail('VALIDATION', 'Pilih kategori.');
      if (!str(r.item)) fail('VALIDATION', 'Isi nama barang / keperluan.');
      const qty = Number(r.qty) || 0, harga = Math.round(Number(r.harga) || 0);
      if (!(qty > 0) || !(harga > 0)) fail('VALIDATION', 'Isi jumlah dan harga.');
      const total = Math.round(qty * harga);
      const cara = r.cara_bayar === 'hutang' ? 'hutang' : 'lunas';
      if (cara === 'hutang' && !r.supplier_id) fail('VALIDATION', 'Pembelian hutang harus memilih supplier.');
      if (cara === 'lunas' && !c.s.all('payment_methods').some((m) => m.id === r.method_id)) fail('VALIDATION', 'Pilih metode pembayaran.');
      const isi = Number(r.isi_per_satuan) || 0;
      return c.s.withLock(() => {
        const id = newId(c.env, 'exp');
        let billId = '';
        if (cara === 'hutang') {
          billId = newId(c.env, 'bil');
          const jt = isYmd(str(r.jatuh_tempo)) ? str(r.jatuh_tempo) : addDays(t, 30);
          c.s.insert('supplier_bills', { id: billId, tanggal: t, nota: str(r.nota), supplier_id: str(r.supplier_id), expense_id: id, total, terbayar: 0, sisa: total, jatuh_tempo: jt, keterangan: str(r.item), ...stamp(c, true) });
        }
        const row = c.s.insert('expenses', {
          id, tanggal: t, nota: str(r.nota).slice(0, 80), supplier_id: str(r.supplier_id), kategori_id: (cat as Row).id, product_id: str(r.product_id), item: str(r.item).slice(0, 200),
          qty, satuan: str(r.satuan) || 'pcs', harga, total, isi_per_satuan: isi || null, mesin_id: str(r.mesin_id), cara_bayar: cara, method_id: cara === 'lunas' ? str(r.method_id) : '',
          bill_id: billId, keterangan: str(r.keterangan).slice(0, 300), deleted: false, ...stamp(c, true),
        });
        // harga beli otomatis: pembelian bahan yang dihubungkan ke produk + isi per satuan jual
        let hargaBeli: number | null = null;
        if (str(r.product_id) && isi > 0) {
          hargaBeli = Math.round((harga / isi) * 100) / 100;
          c.s.insert('cost_history', { id: newId(c.env, 'cst'), product_id: str(r.product_id), berlaku_mulai: t, harga_beli: hargaBeli, supplier_id: str(r.supplier_id), sumber: `pembelian ${id}`, ...stamp(c, true) });
        }
        log(c, 'pengeluaran', 'expenses', id, `${(cat as Row).nama}: ${r.item} ${total.toLocaleString('id-ID')} (${cara})${hargaBeli != null ? `, harga beli ${hargaBeli}/satuan` : ''}`);
        return { ...row, harga_beli_baru: hargaBeli };
      });
    },
  },
  'expense.delete': {
    auth: true,
    fn: (c, p) => {
      need(c, 'pengeluaran', 'hapus');
      if (!str(p.alasan)) fail('VALIDATION', 'Isi alasan penghapusan.');
      return c.s.withLock(() => {
        const x = c.s.all('expenses').find((r) => r.id === p.id) || fail('NOT_FOUND', 'Data tidak ditemukan.');
        if (str((x as Row).purchase_id)) fail('VALIDATION', 'Pengeluaran ini berasal dari Pembelian Bahan. Hapus lewat menu Pembelian Bahan supaya stoknya ikut dikoreksi.');
        if ((x as Row).bill_id) {
          const b = c.s.all('supplier_bills').find((r) => r.id === (x as Row).bill_id);
          if (b && Number(b.terbayar) > 0) fail('VALIDATION', 'Hutang dari pembelian ini sudah dicicil. Hapus tidak diizinkan.');
          if (b) c.s.update('supplier_bills', 'id', str(b.id), { sisa: 0, total: 0, keterangan: `DIHAPUS: ${b.keterangan}`, ...stamp(c, false) });
        }
        c.s.update('expenses', 'id', str((x as Row).id), { deleted: true, ...stamp(c, false) });
        log(c, 'hapus', 'expenses', str((x as Row).id), `Hapus pengeluaran ${(x as Row).item} ${Number((x as Row).total).toLocaleString('id-ID')}`, str(p.alasan));
        return { ok: true };
      });
    },
  },

  // ----- hutang supplier (Tahap 5) -----
  'bills.list': {
    auth: true,
    fn: (c, p) => {
      need(c, 'hutang');
      const sup = Object.fromEntries(c.s.all('suppliers').map((x) => [x.id, x.nama]));
      const met = Object.fromEntries(c.s.all('payment_methods').map((x) => [x.id, x.nama]));
      const users = Object.fromEntries(c.s.all('users').map((x) => [x.id, x.nama]));
      const pays = c.s.all('bill_payments');
      return c.s.all('supplier_bills').filter((b) => Number(b.total) > 0 && (p.semua || Number(b.sisa) > 0 || str(b.updated_at).slice(0, 10) >= addDays(c.env.today(), -60))).map((b) => ({
        ...b, supplier: str(sup[str(b.supplier_id)]),
        pembayaran: pays.filter((x) => x.bill_id === b.id).map((x) => ({ ...x, metode: str(met[str(x.method_id)]), oleh: str(users[str(x.created_by)]) })),
      }));
    },
  },
  'bills.save': {
    auth: true,
    fn: (c, p) => {
      need(c, 'hutang', 'tambah');
      const r = p.bill || {};
      if (!isYmd(str(r.tanggal))) fail('VALIDATION', 'Tanggal tidak valid.');
      if (!c.s.all('suppliers').some((x) => x.id === r.supplier_id)) fail('VALIDATION', 'Pilih supplier.');
      const total = Math.round(Number(r.total) || 0);
      if (total <= 0) fail('VALIDATION', 'Isi total tagihan.');
      return c.s.withLock(() => {
        const row = c.s.insert('supplier_bills', { id: newId(c.env, 'bil'), tanggal: str(r.tanggal), nota: str(r.nota), supplier_id: str(r.supplier_id), expense_id: '', total, terbayar: 0, sisa: total,
          jatuh_tempo: isYmd(str(r.jatuh_tempo)) ? str(r.jatuh_tempo) : addDays(str(r.tanggal), 30), keterangan: str(r.keterangan), ...stamp(c, true) });
        log(c, 'hutang_baru', 'supplier_bills', str(row.id), `Hutang ${total.toLocaleString('id-ID')} ke ${r.supplier_id}: ${r.keterangan}`);
        return row;
      });
    },
  },
  'bills.pay': {
    auth: true,
    fn: (c, p) => {
      need(c, 'hutang', 'ubah');
      return c.s.withLock(() => {
        const b = c.s.all('supplier_bills').find((x) => x.id === p.bill_id) || fail('NOT_FOUND', 'Tagihan tidak ditemukan.');
        const nominal = Math.round(Number(p.nominal) || 0);
        if (nominal <= 0) fail('VALIDATION', 'Isi nominal.');
        if (nominal > Number((b as Row).sisa)) fail('VALIDATION', `Nominal melebihi sisa hutang (${Number((b as Row).sisa).toLocaleString('id-ID')}).`);
        if (!c.s.all('payment_methods').some((m) => m.id === p.method_id)) fail('VALIDATION', 'Pilih metode pembayaran.');
        const t = isYmd(str(p.tanggal)) && str(p.tanggal) <= c.env.today() ? str(p.tanggal) : c.env.today();
        c.s.insert('bill_payments', { id: newId(c.env, 'bpy'), bill_id: (b as Row).id, tanggal: t, nominal, method_id: str(p.method_id), keterangan: str(p.keterangan), ...stamp(c, true) });
        const terbayar = c.s.all('bill_payments').filter((x) => x.bill_id === (b as Row).id).reduce((a, x) => a + Number(x.nominal || 0), 0);
        const row = c.s.update('supplier_bills', 'id', str((b as Row).id), { terbayar, sisa: Number((b as Row).total) - terbayar, ...stamp(c, false) });
        log(c, 'bayar_hutang', 'supplier_bills', str((b as Row).id), `Bayar hutang ${nominal.toLocaleString('id-ID')} (${(b as Row).nota || (b as Row).keterangan})`);
        return row;
      });
    },
  },

  // ----- laporan (Tahap 5) -----
  'report.summary': {
    auth: true,
    fn: (c, p) => {
      need(c, 'laporan');
      const today = c.env.today();
      const from = isYmd(str(p.from)) ? str(p.from) : today.slice(0, 8) + '01';
      const to = isYmd(str(p.to)) ? str(p.to) : today;
      const inR = (t: unknown) => str(t) >= from && str(t) <= to;
      const canLaba = !!c.perms?.['laporan.laba']?.lihat;
      const users = Object.fromEntries(c.s.all('users').map((x) => [x.id, x.nama]));
      const cust = Object.fromEntries(c.s.all('customers').map((x) => [x.id, x]));
      const machines = Object.fromEntries(c.s.all('machines').map((x) => [x.id, x.nama]));
      const methods = Object.fromEntries(c.s.all('payment_methods').map((x) => [x.id, x]));
      const cats = Object.fromEntries(c.s.all('expense_categories').map((x) => [x.id, x]));
      const orders = c.s.all('orders').filter((o) => !bool(o.batal) && inR(o.tanggal));
      const oIds = new Set(orders.map((o) => o.id));
      const items = c.s.all('order_items').filter((i) => oIds.has(i.order_id));
      const pays = c.s.all('payments').filter((x) => inR(x.tanggal));
      const exps = c.s.all('expenses').filter((x) => !bool(x.deleted) && inR(x.tanggal));
      const billPays = c.s.all('bill_payments').filter((x) => inR(x.tanggal));
      const pc = c.s.all('petty_cash').filter((x) => !bool(x.deleted) && inR(x.tanggal));
      const costs = c.s.all('cost_history');
      // harga beli per item: snapshot di item, atau harga beli yang berlaku saat tanggal nota (kalau belum ada saat nota dibuat)
      const oDate = Object.fromEntries(orders.map((o) => [o.id, o.tanggal]));
      // total HPP item: dari stok (bahan + klik) bila stok sudah dipotong, atau harga beli × qty (cara lama)
      const costOf = (i: Row) => {
        if (str(i.stok_at)) return Number(i.hpp_bahan || 0) + Number(i.hpp_klik || 0);
        const u = unitCost(i);
        return u == null ? null : u * Number(i.qty);
      };
      const unitCost = (i: Row) => {
        if (i.harga_beli != null && i.harga_beli !== '') return Number(i.harga_beli);
        const t = str(oDate[str(i.order_id)]);
        const r = costs.filter((x) => x.product_id === i.product_id && str(x.berlaku_mulai) <= t).sort((a, b) => str(b.berlaku_mulai).localeCompare(str(a.berlaku_mulai)))[0];
        return r ? Number(r.harga_beli) : null;
      };
      const omzet = orders.reduce((a, o) => a + Number(o.total || 0), 0);
      let hpp = 0, omzetBerHpp = 0;
      const perProduk: Record<string, Row> = {};
      items.forEach((i) => {
        const cst = costOf(i);
        const k = str(i.product_id);
        const r = (perProduk[k] ||= { product_id: k, nama: i.nama_produk, qty: 0, klik: 0, omzet: 0, hpp: 0, hpp_lengkap: true, nota: new Set<string>() });
        r.qty = Number(r.qty) + Number(i.qty); r.klik = Number(r.klik) + Number(i.klik || 0); r.omzet = Number(r.omzet) + Number(i.subtotal);
        (r.nota as Set<string>).add(str(i.order_id));
        if (cst != null) { const h = cst; r.hpp = Number(r.hpp) + h; hpp += h; omzetBerHpp += Number(i.subtotal); } else r.hpp_lengkap = false;
      });
      const groupSum = <T extends string>(rows: Row[], key: (r: Row) => T, val: (r: Row) => number) => {
        const m: Record<string, number> = {}; rows.forEach((r) => { const k = key(r); m[k] = (m[k] || 0) + val(r); }); return m;
      };
      const perCs = Object.entries(groupSum(orders, (o) => str(o.cs_id), (o) => Number(o.total))).map(([id, v]) => ({
        id, nama: str(users[id]) || '–', omzet: v, nota: orders.filter((o) => o.cs_id === id).length,
        klik: items.filter((i) => orders.find((o) => o.id === i.order_id)?.cs_id === id).reduce((a, i) => a + Number(i.klik || 0), 0),
      }));
      const perMesin = Object.entries(groupSum(items, (i) => str(i.mesin_id), (i) => Number(i.subtotal))).map(([id, v]) => ({
        id, nama: str(machines[id]) || '–', omzet: v, item: items.filter((i) => i.mesin_id === id).length, klik: items.filter((i) => i.mesin_id === id).reduce((a, i) => a + Number(i.klik || 0), 0),
      }));
      const perMetode = Object.entries(groupSum(pays, (x) => str(x.method_id), (x) => Number(x.nominal))).map(([id, v]) => ({ id, nama: str((methods[id] as Row)?.nama) || '–', jenis: str((methods[id] as Row)?.jenis), masuk: v, transaksi: pays.filter((x) => x.method_id === id).length }));
      const perKonsumen = Object.entries(groupSum(orders, (o) => str(o.customer_id), (o) => Number(o.total))).map(([id, v]) => ({
        id, nama: str((cust[id] as Row)?.nama) || '–', tipe: str((cust[id] as Row)?.tipe), omzet: v, nota: orders.filter((o) => o.customer_id === id).length,
        sisa: orders.filter((o) => o.customer_id === id).reduce((a, o) => a + Math.max(0, Number(o.sisa || 0)), 0),
      }));
      const perKategori = Object.entries(groupSum(exps, (x) => str(x.kategori_id), (x) => Number(x.total))).map(([id, v]) => ({ id, nama: str((cats[id] as Row)?.nama) || '–', jenis: str((cats[id] as Row)?.jenis), total: v, transaksi: exps.filter((x) => x.kategori_id === id).length }));
      const days: string[] = []; for (let d = from; d <= to && days.length < 400; d = addDays(d, 1)) days.push(d);
      const harian = days.map((d) => ({
        tanggal: d,
        omzet: orders.filter((o) => o.tanggal === d).reduce((a, o) => a + Number(o.total || 0), 0),
        masuk: pays.filter((x) => x.tanggal === d).reduce((a, x) => a + Number(x.nominal || 0), 0),
        nota: orders.filter((o) => o.tanggal === d).length,
      }));
      const masuk = pays.reduce((a, x) => a + Number(x.nominal || 0), 0);
      const keluarLunas = exps.filter((x) => x.cara_bayar === 'lunas').reduce((a, x) => a + Number(x.total || 0), 0);
      const keluarHutang = billPays.reduce((a, x) => a + Number(x.nominal || 0), 0);
      const kasKecil = pc.reduce((a, x) => a + Number(x.keluar || 0), 0);
      const opsNonBahan = exps.filter((x) => str((cats[str(x.kategori_id)] as Row)?.jenis) !== 'bahan' && str((cats[str(x.kategori_id)] as Row)?.jenis) !== 'aset').reduce((a, x) => a + Number(x.total || 0), 0);
      return {
        from, to, can_laba: canLaba,
        ringkas: {
          omzet, nota: orders.length, rata_nota: orders.length ? Math.round(omzet / orders.length) : 0, klik: items.reduce((a, i) => a + Number(i.klik || 0), 0),
          piutang_periode: orders.reduce((a, o) => a + Math.max(0, Number(o.sisa || 0)), 0),
          masuk, keluar_lunas: keluarLunas, keluar_hutang: keluarHutang, kas_kecil: kasKecil, arus_kas: masuk - keluarLunas - keluarHutang - kasKecil,
          pengeluaran_total: exps.reduce((a, x) => a + Number(x.total || 0), 0),
          ...(canLaba ? { hpp: Math.round(hpp), laba_kotor: Math.round(omzetBerHpp - hpp), omzet_ber_hpp: omzetBerHpp, cakupan_hpp: omzet ? Math.round((omzetBerHpp / omzet) * 1000) / 10 : 0, biaya_operasional: opsNonBahan + kasKecil } : {}),
        },
        harian, per_cs: perCs, per_mesin: perMesin, per_metode: perMetode, per_konsumen: perKonsumen, per_kategori: perKategori,
        per_produk: Object.values(perProduk).map((r) => ({ ...r, nota: (r.nota as Set<string>).size, ...(canLaba ? { laba: Number(r.omzet) - Number(r.hpp) } : { hpp: undefined, hpp_lengkap: undefined }) })),
      };
    },
  },

  // ----- dashboard -----
  'dashboard.summary': {
    auth: true,
    fn: (c) => {
      need(c, 'dashboard');
      const today = c.env.today();
      const from = addDays(today, -30);
      const products = c.s.all('products');
      const prices = c.s.all('price_history');
      const customers = c.s.all('customers').filter((x) => bool(x.aktif));
      const changes: Row[] = [];
      products.forEach((p) => {
        const rows = prices.filter((r) => r.product_id === p.id).sort((a, b) => str(a.berlaku_mulai).localeCompare(str(b.berlaku_mulai)));
        rows.forEach((r, i) => {
          if (i === 0 || str(r.berlaku_mulai) < from) return;
          const prev = rows[i - 1] as any, cur = r as any;
          const base = Number(prev.rb), now = Number(cur.rb);
          changes.push({ product_id: p.id, kode: p.kode, nama: p.nama, berlaku_mulai: r.berlaku_mulai, sebelum: base || null, sesudah: now || null,
            persen: base && now ? Math.round(((now - base) / base) * 1000) / 10 : null, terjadwal: str(r.berlaku_mulai) > today, catatan: r.catatan });
        });
      });
      changes.sort((a, b) => str(b.berlaku_mulai).localeCompare(str(a.berlaku_mulai)));
      const tanpaHarga = products.filter((p) => bool(p.aktif) && p.jenis_harga !== 'manual' && !hargaBerlaku(prices.filter((r) => r.product_id === p.id) as any, today)).length;
      const canDev = !!c.perms?.['pengaturan.perangkat']?.lihat;
      // angka transaksi (Tahap 2): hari ini, 14 hari terakhir, piutang
      const orders = c.s.all('orders').filter((o) => !bool(o.batal));
      const pays = c.s.all('payments');
      const days: string[] = []; for (let i = 13; i >= 0; i--) days.push(addDays(today, -i));
      const yest = addDays(today, -1);
      const sumOrders = (d: string) => orders.filter((o) => o.tanggal === d).reduce((a, o) => a + Number(o.total || 0), 0);
      const sumPays = (d: string) => pays.filter((x) => x.tanggal === d).reduce((a, x) => a + Number(x.nominal || 0), 0);
      const canMoney = !!(c.perms?.order?.lihat || c.perms?.kasir?.lihat || c.perms?.piutang?.lihat);
      const trx = canMoney ? {
        omzet_hari_ini: sumOrders(today), omzet_kemarin: sumOrders(yest),
        masuk_hari_ini: sumPays(today), masuk_kemarin: sumPays(yest),
        nota_hari_ini: orders.filter((o) => o.tanggal === today).length, nota_kemarin: orders.filter((o) => o.tanggal === yest).length,
        piutang_total: orders.reduce((a, o) => a + Math.max(0, Number(o.sisa || 0)), 0),
        piutang_nota: orders.filter((o) => Number(o.sisa) > 0).length,
        tren: days.map((d) => ({ tanggal: d, omzet: sumOrders(d), masuk: sumPays(d) })),
      } : null;
      let produksi: Row[] | null = null;
      if (c.perms?.produksi?.lihat) {
        const live = new Set(c.s.all('orders').filter((o) => !bool(o.batal)).map((o) => o.id));
        const ms = c.s.all('machines');
        const agg: Record<string, { antrian: number; proses: number }> = {};
        c.s.all('order_items').forEach((i) => {
          if (!live.has(i.order_id) || (i.status_produksi !== 'antrian' && i.status_produksi !== 'proses')) return;
          const a = (agg[str(i.mesin_id)] ||= { antrian: 0, proses: 0 });
          a[i.status_produksi as 'antrian' | 'proses']++;
        });
        produksi = Object.entries(agg).map(([id, v]) => ({ mesin_id: id, mesin: str(ms.find((m) => m.id === id)?.nama) || '–', ...v })).sort((a, b) => (b.antrian + b.proses) - (a.antrian + a.proses));
      }
      let hutang: Row | null = null;
      if (c.perms?.hutang?.lihat) {
        const open = c.s.all('supplier_bills').filter((b) => Number(b.sisa) > 0);
        const week = addDays(today, 7);
        hutang = { total: open.reduce((a, b) => a + Number(b.sisa), 0), tagihan: open.length,
          jatuh_tempo: open.filter((b) => str(b.jatuh_tempo) <= week).sort((a, b) => str(a.jatuh_tempo).localeCompare(str(b.jatuh_tempo))).slice(0, 6)
            .map((b) => ({ id: b.id, supplier: str(c.s.all('suppliers').find((x) => x.id === b.supplier_id)?.nama), sisa: b.sisa, jatuh_tempo: b.jatuh_tempo, nota: b.nota })) };
      }
      let bulan: Row | null = null;
      if (c.perms?.laporan?.lihat) {
        const m0 = today.slice(0, 8) + '01';
        const prevEnd = addDays(m0, -1), prev0 = prevEnd.slice(0, 8) + '01';
        const dayN = Number(today.slice(8, 10));
        const prevSame = addDays(prev0, Math.min(dayN, Number(prevEnd.slice(8, 10))) - 1);
        const sumO = (a: string, b: string) => orders.filter((o) => str(o.tanggal) >= a && str(o.tanggal) <= b).reduce((x, o) => x + Number(o.total || 0), 0);
        const items = c.s.all('order_items');
        const top: Record<string, { nama: string; omzet: number; qty: number }> = {};
        const cur = new Set(orders.filter((o) => str(o.tanggal) >= m0).map((o) => o.id));
        items.forEach((i) => { if (!cur.has(i.order_id)) return; const t = (top[str(i.product_id)] ||= { nama: str(i.nama_produk), omzet: 0, qty: 0 }); t.omzet += Number(i.subtotal); t.qty += Number(i.qty); });
        const omzetBulan = sumO(m0, today);
        const nDays = Number(addDays(addDays(m0, 32).slice(0, 8) + '01', -1).slice(8, 10));
        const target = Number(settingsMap(c.s)['target_' + today.slice(0, 7).replace('-', '')]) || 0;
        bulan = { omzet: omzetBulan, omzet_bulan_lalu_sd: sumO(prev0, prevSame), omzet_bulan_lalu: sumO(prev0, prevEnd),
          top_produk: Object.values(top).sort((a, b) => b.omzet - a.omzet).slice(0, 5),
          target, hari_ke: dayN, jumlah_hari: nDays, proyeksi: Math.round((omzetBulan / dayN) * nDays),
          perlu_per_hari: target && dayN < nDays ? Math.max(0, Math.round((target - omzetBulan) / (nDays - dayN))) : 0,
          bisa_atur_target: !!c.perms?.['pengaturan.umum']?.ubah };
      }
      const stok = c.perms?.stok?.lihat ? { menipis: ext.lowStock(c).slice(0, 8), jumlah: ext.lowStock(c).length } : null;
      return {
        trx, produksi, hutang, bulan, stok,
        produk_aktif: products.filter((p) => bool(p.aktif)).length,
        produk_tanpa_harga: tanpaHarga,
        konsumen: customers.length,
        reseller: customers.filter((x) => x.tipe === 'reseller').length,
        perangkat_menunggu: canDev ? c.s.all('devices').filter((d) => d.status === 'menunggu').length : null,
        perubahan_harga: changes.slice(0, 20),
      };
    },
  },

  // ----- pengaturan & log -----
  'settings.get': { auth: true, fn: (c) => settingsMap(c.s) },
  'settings.save': {
    auth: true,
    fn: (c, p) => {
      need(c, 'pengaturan.umum', 'ubah');
      const s = p.settings || {};
      if (s.min_qty_banyak !== undefined && !(Number(s.min_qty_banyak) >= 2)) fail('VALIDATION', 'Minimal qty harga banyak harus angka ≥ 2.');
      if (s.stok_kurang_saat !== undefined && !['selesai', 'bayar'].includes(str(s.stok_kurang_saat))) fail('VALIDATION', 'Pilihan potong stok tidak dikenal.');
      if (s.margin_min !== undefined && !(Number(s.margin_min) >= 0 && Number(s.margin_min) <= 90)) fail('VALIDATION', 'Margin minimum 0–90%.');
      Object.keys(s).filter((k) => /^target_\d{6}$/.test(k)).forEach((k) => { if (str(s[k]) !== '' && !(Number(s[k]) >= 0)) fail('VALIDATION', 'Target omzet harus angka.'); });
      if (s.sesi_jam !== undefined && !(Number(s.sesi_jam) >= 1 && Number(s.sesi_jam) <= 72)) fail('VALIDATION', 'Lama sesi 1–72 jam.');
      if (s.maks_perangkat !== undefined && str(s.maks_perangkat) !== '' && !(Number.isInteger(Number(s.maks_perangkat)) && Number(s.maks_perangkat) >= 1 && Number(s.maks_perangkat) <= 99)) fail('VALIDATION', 'Batas perangkat 1–99, atau kosongkan untuk tanpa batas.');
      c.s.withLock(() => {
        const cur = settingsMap(c.s);
        Object.keys(s).forEach((k) => {
          if (!/^[a-z0-9_]{2,40}$/.test(k)) return;
          const v = str(s[k]);
          if (k in cur) { if (cur[k] !== v) c.s.update('settings', 'key', k, { value: v }); }
          else c.s.insert('settings', { key: k, value: v });
        });
      });
      log(c, 'ubah_pengaturan', 'settings', '', 'Mengubah: ' + Object.keys(s).join(', '));
      return settingsMap(c.s);
    },
  },
  'log.list': {
    auth: true,
    fn: (c, p) => {
      need(c, 'pengaturan.log');
      const from = str(p.from), to = str(p.to);
      return c.s.all('activity_log')
        .filter((r) => (!from || str(r.waktu).slice(0, 10) >= from) && (!to || str(r.waktu).slice(0, 10) <= to))
        .sort((a, b) => str(b.waktu).localeCompare(str(a.waktu)))
        .slice(0, 5000);
    },
  },
};

/** Titik masuk semua request. */
// ----- v1.1: stok, pembelian, opname, HPP, buku besar, laba rugi, margin (src/server/ext.ts) -----
const ext = makeExt({ fail, str, bool, newId, iso, addDays, isYmd, settingsMap, need, stamp, log });
Object.keys(ext.handlers).forEach((k) => { if (handlers[k]) throw new Error('Handler ganda: ' + k); handlers[k] = ext.handlers[k]; });

export function handle(s: Store, env: Env, req: Request): Response {
  try {
    const h = handlers[req.action];
    if (!h) fail('NOT_FOUND', `Aksi "${req.action}" tidak dikenal.`);
    const c: Ctx = { s, env, req };
    if (h!.auth) authenticate(c);
    return { ok: true, data: h!.fn(c, req.payload || {}), version: API_VERSION };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: { code: e.code, message: e.message }, version: API_VERSION };
    return { ok: false, error: { code: 'SERVER_ERROR', message: (e as Error)?.message || String(e) }, version: API_VERSION };
  }
}

// ---------------- data awal ----------------
export const BASE_MACHINES = ['versant', 'Mahogani', 'Dopo', 'graphtech', 'laminating', 'DTF', 'Seng', 'nomorator', 'Scan', 'desain', 'potong'];
export const BASE_METHODS: [string, string][] = [
  ['Tunai', 'tunai'], ['Mandiri Transfer', 'transfer'], ['BNI Transfer', 'transfer'], ['BCA Transfer', 'transfer'], ['EDC Mandiri', 'edc'], ['BSI Transfer', 'transfer'],
];
export const BASE_CATEGORIES: [string, string][] = [
  ['Bahan baku (kertas, stiker, film)', 'bahan'], ['Bahan finishing (laminating, plastik)', 'bahan'], ['Operasional', 'operasional'], ['Listrik, air & internet', 'operasional'],
  ['Tagihan biaya klik mesin', 'klik'], ['Perawatan & sparepart mesin', 'operasional'], ['Gaji, upah & cashbon', 'gaji'], ['Sewa tempat', 'operasional'], ['Pengembalian uang konsumen', 'lain'], ['Aset & peralatan', 'aset'], ['Lain-lain', 'lain'],
];
export const BASE_SETTINGS: Record<string, string> = {
  nama_usaha: 'Fortuner Digital Printing', alamat: '', telp: '', min_qty_banyak: '26', sesi_jam: '12', prefix_nota: 'FT', maks_perangkat: '',
  stok_kurang_saat: 'selesai', margin_min: '20',
  catatan_struk: 'Terima kasih. Barang yang tidak diambil lebih dari 30 hari di luar tanggung jawab kami.',
};

/** Isi data dasar bila sheet masih kosong. Aman dijalankan berulang. */
export function seedBase(s: Store, env: Env, owner: { username: string; password: string; nama: string }) {
  const now = env.now().toISOString();
  const st = { created_at: now, created_by: 'setup', updated_at: now, updated_by: 'setup' };
  const cur = settingsMap(s);
  Object.entries(BASE_SETTINGS).forEach(([k, v]) => { if (!(k in cur)) s.insert('settings', { key: k, value: v }); });
  if (!s.all('machines').length) BASE_MACHINES.forEach((n) => s.insert('machines', { id: newId(env, 'mes'), nama: n, pakai_counter: ['versant', 'Mahogani', 'Dopo'].includes(n), aktif: true, ...st }));
  if (!s.all('expense_categories').length) BASE_CATEGORIES.forEach(([n, j]) => s.insert('expense_categories', { id: newId(env, 'cat'), nama: n, jenis: j, aktif: true, ...st }));
  if (!s.all('expense_categories').some((x) => x.jenis === 'klik')) s.insert('expense_categories', { id: newId(env, 'cat'), nama: 'Tagihan biaya klik mesin', jenis: 'klik', aktif: true, ...st });
  if (!s.all('payment_methods').length) BASE_METHODS.forEach(([n, j]) => s.insert('payment_methods', { id: newId(env, 'pay'), nama: n, jenis: j, rekening: '', aktif: true, ...st }));
  if (!s.all('users').some((u) => u.role === 'owner')) {
    const salt = env.uuid();
    s.insert('users', {
      id: newId(env, 'usr'), username: owner.username, nama: owner.nama, role: 'owner', salt, password_hash: hashPassword(owner.password, salt),
      khusus_kantor: false, jam_login_dari: '', jam_login_sampai: '', aktif: true, harus_ganti_password: true, ...st,
    });
  }
}

/** Dipakai seed demo. */
export function _hashPasswordForSeed(password: string, salt: string) { return hashPassword(password, salt); }
export { newId as _newId, ext as _ext, permsFor as _permsFor };

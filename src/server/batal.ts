/**
 * Pembatalan tercatat, refund dana, dan deposit konsumen (v1.3.5).
 *
 * Prinsip:
 *  - Nota tidak pernah dihapus. Pembatalan = dokumen BTL bertanggal hari disetujui; omzet di tanggal nota tetap,
 *    pembatalan masuk akun 4150 (pengurang pendapatan) di tanggal BTL.
 *  - Yang mengajukan, menyetujui, dan membayar refund dicatat terpisah.
 *  - Uang yang kembali ke konsumen selalu lewat refund (tunai dari laci sendiri / transfer + bukti) atau deposit.
 *  - Deposit = utang toko ke konsumen (akun 2150). Saldo per konsumen = jumlah mutasi.
 */
import type { Store, Env } from './store';
import type { Row } from './schema';
import type { PermissionMap } from '../types';

type Op = 'lihat' | 'tambah' | 'ubah' | 'hapus' | 'ekspor';
interface Ctx { s: Store; env: Env; req?: unknown; user?: Row; perms?: PermissionMap }
interface Deps {
  fail: (code: string, msg: string) => never;
  str: (v: unknown) => string;
  bool: (v: unknown) => boolean;
  newId: (env: Env, prefix: string) => string;
  iso: (env: Env) => string;
  addDays: (ymd: string, n: number) => string;
  isYmd: (s: string) => boolean;
  settingsMap: (s: Store) => Record<string, string>;
  stamp: (c: any, isNew: boolean) => Row;
  log: (c: any, aksi: string, tabel: string, recordId: string, ringkasan: string, alasan?: string) => void;
  checkPassword: (c: any, password: unknown) => void;
  recalcOrder: (c: any, orderId: string) => void;
  orderDetail: (c: any, id: string) => unknown;
  ext: { emit: (c: any, e: any) => void; trial: (c: any, from: string, to: string) => { rows: { kode: string; saldo_akhir: number }[] } };
}

export const DEPOSIT = 'deposit';
export const KATEGORI_BATAL = ['Konsumen batal / acara diundur', 'Ganti desain', 'Salah input FO', 'Hasil cetak tidak sesuai', 'Lainnya'];

export function makeBatal(d: Deps) {
  const { fail, str, bool, newId, iso, addDays, isYmd, settingsMap, stamp, log, checkPassword, recalcOrder, orderDetail, ext } = d;
  const num = (v: unknown) => Number(v) || 0;
  const fmt = (n: number) => Math.round(n).toLocaleString('id-ID');
  const can = (c: Ctx, key: string, op: Op = 'lihat') => !!c.perms?.[key]?.[op];
  const needAny = (c: Ctx, keys: [string, Op][]) => { if (!keys.some(([k, o]) => can(c, k, o))) fail('FORBIDDEN', 'Anda tidak punya akses untuk tindakan ini.'); };
  const today = (c: Ctx) => c.env.today();
  const byId = (rows: Row[]) => Object.fromEntries(rows.map((r) => [str(r.id), r])) as Record<string, Row>;
  const users = (c: Ctx) => Object.fromEntries(c.s.all('users').map((u) => [str(u.id), str(u.nama)])) as Record<string, string>;
  const me = (c: Ctx) => str(c.user?.id);
  const tunai = (c: Ctx) => c.s.all('payment_methods').find((m) => m.jenis === 'tunai');

  /** BTL-1026-0001 / RF-1026-0001 / DEP-1026-0001, urut per bulan. */
  function nomor(c: Ctx, prefix: string) {
    const t = today(c);
    const key = `${prefix.toLowerCase()}-${t.slice(0, 7)}`;
    const row = c.s.all('counters').find((r) => r.key === key);
    const n = num(row?.value) + 1;
    if (!row) c.s.insert('counters', { key, value: n }); else c.s.update('counters', 'key', key, { value: n });
    return `${prefix}-${t.slice(5, 7)}${t.slice(2, 4)}-${String(n).padStart(4, '0')}`;
  }
  const saveBukti = (c: Ctx, nama: string, dataUrl: string) => {
    if (!dataUrl) return '';
    if (!/^data:image\//.test(dataUrl)) fail('VALIDATION', 'Lampiran harus berupa gambar.');
    if (dataUrl.length > 1500000) fail('VALIDATION', 'Foto terlalu besar.');
    return c.env.saveFile ? c.env.saveFile(nama, dataUrl) : dataUrl;
  };

  // ---------------- deposit ----------------
  const moves = (c: Ctx, custId?: string) => c.s.all('deposit_moves').filter((m) => !custId || m.customer_id === custId);
  const saldoOf = (c: Ctx, custId: string) => moves(c, custId).reduce((a, m) => a + num(m.masuk) - num(m.keluar), 0);
  /** Pencairan yang sedang diajukan/disetujui tapi belum dibayar: saldo itu tidak boleh dipakai lagi. */
  const ditahan = (c: Ctx, custId: string) => c.s.all('refunds').filter((r) => r.sumber === 'deposit' && r.customer_id === custId && (r.status === 'menunggu' || r.status === 'siap')).reduce((a, r) => a + num(r.nominal), 0);
  const saldoBebas = (c: Ctx, custId: string) => saldoOf(c, custId) - ditahan(c, custId);
  function addDeposit(c: Ctx, m: { customer_id: string; jenis: string; masuk?: number; keluar?: number; method_id?: string; kasir_id?: string; bukti?: string; ref_tabel?: string; ref_id?: string; order_id?: string; keterangan?: string }) {
    const masuk = Math.round(num(m.masuk)), keluar = Math.round(num(m.keluar));
    const saldo = saldoOf(c, m.customer_id) + masuk - keluar;
    if (saldo < 0) fail('VALIDATION', 'Saldo deposit tidak cukup.');
    return c.s.insert('deposit_moves', {
      id: newId(c.env, 'dep'), nomor: nomor(c, 'DEP'), tanggal: today(c), customer_id: m.customer_id, jenis: m.jenis, masuk, keluar, saldo,
      method_id: str(m.method_id), kasir_id: str(m.kasir_id), bukti: str(m.bukti), ref_tabel: str(m.ref_tabel), ref_id: str(m.ref_id), order_id: str(m.order_id), keterangan: str(m.keterangan).slice(0, 200), ...stamp(c, true),
    });
  }
  const custName = (c: Ctx, id: string) => str(c.s.all('customers').find((x) => x.id === id)?.nama);

  /** Dipakai orders.pay: metode "deposit". Memotong saldo dan mencatat mutasi "pakai". */
  function payWithDeposit(c: Ctx, order: Row, nominal: number, paymentId: string) {
    const cust = str(order.customer_id);
    const bebas = saldoBebas(c, cust);
    if (nominal > bebas) fail('VALIDATION', `Saldo deposit konsumen hanya ${fmt(bebas)}.`);
    addDeposit(c, { customer_id: cust, jenis: 'pakai', keluar: nominal, ref_tabel: 'payments', ref_id: paymentId, order_id: str(order.id), keterangan: `Bayar ${str(order.nomor)}` });
  }
  /** Kelebihan bayar (sisa negatif yang belum direfund) disimpan sebagai deposit. */
  function overpayToDeposit(c: Ctx, orderId: string, ket = 'Kelebihan bayar') {
    const o = c.s.all('orders').find((x) => x.id === orderId)!;
    const refundJalan = c.s.all('refunds').filter((r) => r.order_id === orderId && r.sumber === 'pembatalan' && r.status === 'siap').reduce((a, r) => a + num(r.nominal), 0);
    const lebih = Math.max(0, -num(o.sisa) - refundJalan);
    if (!lebih) return 0;
    addDeposit(c, { customer_id: str(o.customer_id), jenis: 'lebih_bayar', masuk: lebih, ref_tabel: 'orders', ref_id: orderId, order_id: orderId, keterangan: `${ket} ${str(o.nomor)}` });
    c.s.update('orders', 'id', orderId, { dikembalikan: num(o.dikembalikan) + lebih });
    recalcOrder(c, orderId);
    return lebih;
  }

  // ---------------- analisa pembatalan ----------------
  const diproduksi = (i: Row) => !!str(i.stok_at) || i.status_produksi === 'proses' || i.status_produksi === 'selesai';
  interface Line { item: Row; qty: number; nilai: number; diproduksi: boolean; hpp_estimasi: number; hpp_bahan: number; hpp_klik: number }
  function analyze(c: Ctx, order: Row, jenis: string, req: { id: string; qty: number }[]) {
    const items = c.s.all('order_items').filter((i) => i.order_id === order.id);
    const want: Record<string, number> = {};
    if (jenis === 'penuh') items.forEach((i) => { want[str(i.id)] = num(i.qty) - num(i.qty_batal); });
    else (req || []).forEach((r) => { want[str(r.id)] = Math.round(num(r.qty)); });
    const lines: Line[] = [];
    items.forEach((i) => {
      const sisaQty = num(i.qty) - num(i.qty_batal);
      const q = Math.min(sisaQty, Math.max(0, want[str(i.id)] || 0));
      if (!(q > 0)) return;
      const ratio = q / Math.max(1, num(i.qty));
      const prod = diproduksi(i);
      const hb = str(i.stok_at) ? Math.round(num(i.hpp_bahan) * ratio) : 0, hk = str(i.stok_at) ? Math.round(num(i.hpp_klik) * ratio) : 0;
      const est = prod ? (str(i.stok_at) ? hb + hk : Math.round(num(i.harga_beli) * q)) : 0;
      lines.push({ item: i, qty: q, nilai: Math.round(num(i.subtotal) * ratio), diproduksi: prod, hpp_estimasi: est, hpp_bahan: hb, hpp_klik: hk });
    });
    if (!lines.length) fail('VALIDATION', 'Pilih item dan jumlah yang dibatalkan.');
    const nilai = lines.reduce((a, l) => a + l.nilai, 0);
    const nilaiProd = lines.filter((l) => l.diproduksi).reduce((a, l) => a + l.nilai, 0);
    const hpp = lines.reduce((a, l) => a + l.hpp_estimasi, 0);
    const terbayar = num(order.terbayar);
    const penuh = items.every((i) => num(i.qty) - num(i.qty_batal) - (lines.find((l) => l.item.id === i.id)?.qty || 0) <= 0);
    const bulanLalu = str(order.tanggal).slice(0, 7) < today(c).slice(0, 7);
    const milikSendiri = order.cs_id === me(c) || order.created_by === me(c);
    const level = terbayar > 0 || nilaiProd > 0 || bulanLalu ? 'owner' : milikSendiri && order.tanggal === today(c) ? 'cepat' : 'admin';
    const alasanLevel = level === 'owner'
      ? [terbayar > 0 ? 'konsumen sudah membayar' : '', nilaiProd > 0 ? 'ada item yang sudah diproduksi' : '', bulanLalu ? 'nota dari bulan yang sudah lewat' : ''].filter(Boolean).join(', ')
      : level === 'admin' ? 'belum diproduksi dan belum ada pembayaran' : 'nota Anda sendiri hari ini, belum dibayar & belum diproduksi';
    return { lines, nilai, nilai_produksi: nilaiProd, hpp_estimasi: hpp, terbayar, jenis: penuh ? 'penuh' : 'sebagian', level, alasan_level: alasanLevel };
  }
  const settingDitahan = (c: Ctx) => { const s = settingsMap(c.s); return { mode: ['hpp', 'persen', 'manual'].includes(s.batal_ditahan_mode) ? s.batal_ditahan_mode : 'hpp', persen: Number(s.batal_ditahan_persen || 50) }; };
  function hitungDitahan(cn: Row, mode: string, persen: number, manual: number) {
    const prod = num(cn.nilai_produksi);
    const v = !prod ? 0 : mode === 'persen' ? Math.round((prod * Math.min(100, Math.max(0, persen))) / 100) : mode === 'manual' ? Math.round(manual) : num(cn.hpp_estimasi);
    return Math.max(0, Math.min(num(cn.nilai_item), v));
  }
  /** Kemungkinan nota pengganti: konsumen sama, hari yang sama, nota lain yang lebih murah dibuat setelah nota asal. */
  function flagPengganti(_c: Ctx, cn: Row, orders: Row[]) {
    const o = orders.find((x) => x.id === cn.order_id);
    if (!o) return '';
    const hari = [str(o.tanggal), str(cn.tanggal)];
    const p = orders.find((x) => x.id !== o.id && x.customer_id === o.customer_id && hari.includes(str(x.tanggal)) && str(x.created_at) > str(o.created_at) && num(x.total) < num(o.total));
    return p ? `Nota ${str(p.nomor)} lebih murah dibuat di hari yang sama` : '';
  }

  function applyDecision(c: Ctx, cn: Row, opt: { ditahan: number; mode: string; penyelesaian: string; catatan: string }) {
    const order = c.s.all('orders').find((x) => x.id === cn.order_id) || fail('NOT_FOUND', 'Nota tidak ditemukan.');
    const lines = c.s.all('cancellation_items').filter((l) => l.cancellation_id === cn.id);
    const items = byId(c.s.all('order_items').filter((i) => i.order_id === order.id));
    lines.forEach((l) => {
      const i = items[str(l.order_item_id)];
      if (!i) fail('VALIDATION', 'Item nota sudah berubah. Ajukan ulang pembatalan.');
      if (num(i.qty_batal) + num(l.qty_batal) > num(i.qty)) fail('VALIDATION', `${str(i.nama_produk)} sudah dibatalkan sebagian. Ajukan ulang.`);
    });
    const nilaiBatal = num(cn.nilai_item) - opt.ditahan;
    lines.forEach((l) => {
      const i = items[str(l.order_item_id)];
      const qb = num(i.qty_batal) + num(l.qty_batal);
      const patch: Row = { qty_batal: qb, ...stamp(c, false) };
      if (qb >= num(i.qty) && !bool(l.diproduksi)) patch.status_produksi = 'batal';
      c.s.update('order_items', 'id', str(i.id), patch);
      Object.assign(i, patch);
    });
    const semua = Object.values(items).every((i) => num(i.qty_batal) >= num(i.qty));
    c.s.update('orders', 'id', str(order.id), { batal_nilai: num(order.batal_nilai) + nilaiBatal, status_batal: semua ? 'penuh' : 'sebagian', alasan_batal: str(cn.alasan).slice(0, 200), ...stamp(c, false) });
    recalcOrder(c, str(order.id));
    const o2 = c.s.all('orders').find((x) => x.id === order.id)!;
    const refundJalan = c.s.all('refunds').filter((r) => r.order_id === order.id && r.sumber === 'pembatalan' && r.status === 'siap').reduce((a, r) => a + num(r.nominal), 0);
    const kelebihan = Math.max(0, -num(o2.sisa) - refundJalan);
    let penyelesaian = '', refundId = '', depositId = '';
    if (kelebihan > 0) {
      penyelesaian = ['deposit', 'tunai', 'transfer'].includes(opt.penyelesaian) ? opt.penyelesaian : 'deposit';
      if (penyelesaian === 'deposit') {
        const dm = addDeposit(c, { customer_id: str(order.customer_id), jenis: 'pembatalan', masuk: kelebihan, ref_tabel: 'cancellations', ref_id: str(cn.id), order_id: str(order.id), keterangan: `Pembatalan ${str(cn.nomor)} · ${str(order.nomor)}` });
        depositId = str(dm.id);
        c.s.update('orders', 'id', str(order.id), { dikembalikan: num(o2.dikembalikan) + kelebihan });
        recalcOrder(c, str(order.id));
      } else {
        refundId = newId(c.env, 'rf');
        c.s.insert('refunds', { id: refundId, nomor: nomor(c, 'RF'), tanggal: today(c), customer_id: str(order.customer_id), sumber: 'pembatalan', ref_id: str(cn.id), order_id: str(order.id), nominal: kelebihan, cara: penyelesaian, status: 'siap',
          alasan: `Pembatalan ${str(cn.nomor)}`, method_id: '', kasir_id: '', penerima: '', bukti: '', diputus_oleh: me(c), diputus_at: iso(c.env), dibayar_oleh: '', dibayar_at: '', catatan: '', ...stamp(c, true) });
      }
    }
    const lp = lines.filter((l) => bool(l.diproduksi));
    c.s.update('cancellations', 'id', str(cn.id), {
      status: 'disetujui', tanggal: today(c), ditahan_mode: opt.mode, ditahan: opt.ditahan, nilai_batal: nilaiBatal, terbayar: num(order.terbayar), kelebihan, penyelesaian, refund_id: refundId, deposit_id: depositId,
      hpp_bahan: lp.reduce((a, l) => a + num(l.hpp_bahan), 0), hpp_klik: lp.reduce((a, l) => a + num(l.hpp_klik), 0),
      diputus_oleh: me(c), diputus_at: iso(c.env), catatan_owner: opt.catatan.slice(0, 300), ...stamp(c, false),
    });
    log(c, 'batal_setuju', 'cancellations', str(cn.id), `${str(cn.nomor)} disetujui: batal ${fmt(nilaiBatal)}${opt.ditahan ? `, ditahan ${fmt(opt.ditahan)}` : ''}${kelebihan ? `, kelebihan ${fmt(kelebihan)} → ${penyelesaian}` : ''} (${str(order.nomor)})`);
    ext.emit(c, { tipe: 'batal_setuju', judul: `Pembatalan ${str(cn.nomor)} disetujui`, detail: `${str(order.nomor)} · batal Rp ${fmt(nilaiBatal)}${kelebihan ? ` · Rp ${fmt(kelebihan)} jadi ${penyelesaian === 'deposit' ? 'deposit' : 'refund ' + penyelesaian}` : ''}`, nominal: nilaiBatal, scope: 'setoran', target: str(cn.created_by), ref_tabel: 'cancellations', ref_id: str(cn.id) });
    if (refundId) ext.emit(c, { tipe: 'refund_siap', judul: `Refund Rp ${fmt(kelebihan)} siap dibayar (${penyelesaian})`, detail: `${custName(c, str(order.customer_id))} · ${str(order.nomor)}`, nominal: kelebihan, scope: penyelesaian === 'tunai' ? 'kas_kecil' : 'keuangan', ref_tabel: 'refunds', ref_id: refundId });
  }

  const cnView = (c: Ctx, cn: Row) => {
    const u = users(c);
    const o = c.s.all('orders').find((x) => x.id === cn.order_id);
    const rf = cn.refund_id ? c.s.all('refunds').find((r) => r.id === cn.refund_id) : null;
    return { ...(cn as Record<string, unknown>), order_nomor: str(o?.nomor), order_tanggal: str(o?.tanggal), order_total: num(o?.total), customer_nama: custName(c, str(cn.customer_id)), diajukan_nama: u[str(cn.created_by)] || '', diputus_nama: u[str(cn.diputus_oleh)] || '', refund_status: str(rf?.status), refund_nomor: str(rf?.nomor) };
  };
  const bisaPutus = (c: Ctx, cn: Row) => cn.level === 'owner' ? can(c, 'pembatalan.owner', 'ubah') : can(c, 'pembatalan', 'ubah') || can(c, 'pembatalan.owner', 'ubah');

  // ---------------- handler ----------------
  const handlers: Record<string, { auth: boolean; fn: (c: any, p: any) => unknown }> = {
    'cancel.preview': {
      auth: true,
      fn: (c: Ctx, p: any) => {
        needAny(c, [['pembatalan', 'tambah'], ['order', 'hapus']]);
        const o = c.s.all('orders').find((x) => x.id === p.order_id) || fail('NOT_FOUND', 'Nota tidak ditemukan.');
        if (bool(o.batal)) fail('VALIDATION', 'Nota ini sudah dibatalkan.');
        const a = analyze(c, o, str(p.jenis) === 'sebagian' ? 'sebagian' : 'penuh', p.items);
        const pending = c.s.all('cancellations').some((x) => x.order_id === o.id && x.status === 'menunggu');
        return { nilai: a.nilai, nilai_produksi: a.nilai_produksi, terbayar: a.terbayar, jenis: a.jenis, level: a.level, alasan_level: a.alasan_level, ada_pengajuan: pending,
          lines: a.lines.map((l) => ({ id: l.item.id, nama: l.item.nama_produk, qty: l.qty, nilai: l.nilai, diproduksi: l.diproduksi })), kategori: KATEGORI_BATAL };
      },
    },
    'cancel.request': {
      auth: true,
      fn: (c: Ctx, p: any) => {
        needAny(c, [['pembatalan', 'tambah'], ['order', 'hapus']]);
        const alasan = str(p.alasan);
        if (!alasan) fail('VALIDATION', 'Isi alasan pembatalan.');
        const kategori = KATEGORI_BATAL.includes(str(p.kategori)) ? str(p.kategori) : 'Lainnya';
        const lampiranRaw = str(p.lampiran);
        return c.s.withLock(() => {
          const o = c.s.all('orders').find((x) => x.id === p.order_id) || fail('NOT_FOUND', 'Nota tidak ditemukan.');
          if (bool(o.batal)) fail('VALIDATION', 'Nota ini sudah dibatalkan.');
          if (c.s.all('cancellations').some((x) => x.order_id === o.id && x.status === 'menunggu')) fail('VALIDATION', 'Nota ini masih punya pengajuan pembatalan yang menunggu persetujuan.');
          const a = analyze(c, o, str(p.jenis) === 'sebagian' ? 'sebagian' : 'penuh', p.items);
          const id = newId(c.env, 'btl');
          const lampiran = saveBukti(c, `batal-${today(c)}-${id}.jpg`, lampiranRaw);
          const cn = c.s.insert('cancellations', {
            id, nomor: nomor(c, 'BTL'), tanggal: today(c), order_id: o.id, customer_id: o.customer_id, jenis: a.jenis, status: 'menunggu', level: a.level, kategori, alasan: alasan.slice(0, 300), lampiran,
            keinginan: ['deposit', 'tunai', 'transfer'].includes(str(p.keinginan)) ? str(p.keinginan) : 'deposit',
            nilai_item: a.nilai, nilai_produksi: a.nilai_produksi, hpp_estimasi: a.hpp_estimasi, hpp_bahan: 0, hpp_klik: 0, ditahan_mode: '', ditahan: 0, nilai_batal: 0, terbayar: a.terbayar, kelebihan: 0,
            penyelesaian: '', refund_id: '', deposit_id: '', diputus_oleh: '', diputus_at: '', catatan_owner: '', ...stamp(c, true),
          });
          a.lines.forEach((l) => c.s.insert('cancellation_items', { id: newId(c.env, 'bti'), cancellation_id: id, order_item_id: l.item.id, nama: l.item.nama_produk, qty: num(l.item.qty), qty_batal: l.qty, nilai: l.nilai, diproduksi: l.diproduksi, hpp_estimasi: l.hpp_estimasi, hpp_bahan: l.hpp_bahan, hpp_klik: l.hpp_klik }));
          log(c, 'batal_ajukan', 'cancellations', id, `Ajukan ${str(cn.nomor)} (${a.jenis}) untuk ${str(o.nomor)} senilai ${fmt(a.nilai)}`, alasan);
          if (a.level === 'cepat') {
            applyDecision(c, cn, { ditahan: 0, mode: '', penyelesaian: '', catatan: 'Jalur cepat' });
            ext.emit(c, { tipe: 'batal_cepat', judul: `${str(c.user?.nama)} membatalkan ${str(o.nomor)} (jalur cepat)`, detail: `Rp ${fmt(a.nilai)} · ${kategori} · "${alasan.slice(0, 80)}"`, nominal: a.nilai, scope: 'keuangan', ref_tabel: 'cancellations', ref_id: id });
          } else {
            ext.emit(c, { tipe: 'batal_ajukan', judul: `${str(c.user?.nama)} mengajukan pembatalan ${str(o.nomor)}`, detail: `Rp ${fmt(a.nilai)} · perlu persetujuan ${a.level === 'owner' ? 'owner' : 'admin'} · "${alasan.slice(0, 80)}"`, nominal: a.nilai, scope: 'keuangan', tindakan: 'batal', ref_tabel: 'cancellations', ref_id: id });
          }
          return { cancellation: cnView(c, c.s.all('cancellations').find((x) => x.id === id)!), order: orderDetail(c, str(o.id)) };
        });
      },
    },
    'cancel.get': {
      auth: true,
      fn: (c: Ctx, p: any) => {
        const cn = c.s.all('cancellations').find((x) => x.id === p.id) || fail('NOT_FOUND', 'Dokumen pembatalan tidak ditemukan.');
        if (!(can(c, 'pembatalan', 'lihat') || can(c, 'pembatalan', 'ubah') || can(c, 'pembatalan.owner', 'ubah') || cn.created_by === me(c))) fail('FORBIDDEN', 'Anda tidak punya akses untuk tindakan ini.');
        const st = settingDitahan(c);
        const o = c.s.all('orders').find((x) => x.id === cn.order_id);
        const sisaSebelum = o ? num(o.total) - num(o.batal_nilai) - num(o.terbayar) : 0;
        return {
          ...cnView(c, cn), items: c.s.all('cancellation_items').filter((l) => l.cancellation_id === cn.id),
          bisa_putuskan: cn.status === 'menunggu' && bisaPutus(c, cn), setting: st, sisa_sebelum: sisaSebelum,
          saran: { hpp: hitungDitahan(cn, 'hpp', 0, 0), persen: hitungDitahan(cn, 'persen', st.persen, 0) }, flag: flagPengganti(c, cn, c.s.all('orders')),
        };
      },
    },
    'cancel.decide': {
      auth: true,
      fn: (c: Ctx, p: any) => {
        const cn0 = c.s.all('cancellations').find((x) => x.id === p.id) || fail('NOT_FOUND', 'Dokumen pembatalan tidak ditemukan.');
        if (!bisaPutus(c, cn0)) fail('FORBIDDEN', cn0.level === 'owner' ? 'Pembatalan ini perlu persetujuan owner.' : 'Anda tidak punya akses untuk menyetujui pembatalan.');
        checkPassword(c, p.password);
        return c.s.withLock(() => {
          const cn = c.s.all('cancellations').find((x) => x.id === p.id)!;
          if (cn.status !== 'menunggu') fail('VALIDATION', 'Pengajuan ini sudah diputuskan.');
          if (!p.setuju) {
            const cat = str(p.catatan);
            if (!cat) fail('VALIDATION', 'Isi alasan penolakan.');
            c.s.update('cancellations', 'id', str(cn.id), { status: 'ditolak', diputus_oleh: me(c), diputus_at: iso(c.env), catatan_owner: cat.slice(0, 300), ...stamp(c, false) });
            log(c, 'batal_tolak', 'cancellations', str(cn.id), `${str(cn.nomor)} ditolak`, cat);
            ext.emit(c, { tipe: 'batal_tolak', judul: `Pembatalan ${str(cn.nomor)} ditolak`, detail: `"${cat.slice(0, 100)}"`, nominal: num(cn.nilai_item), scope: 'setoran', target: str(cn.created_by), ref_tabel: 'cancellations', ref_id: str(cn.id) });
          } else {
            const st = settingDitahan(c);
            const mode = ['hpp', 'persen', 'manual'].includes(str(p.ditahan_mode)) ? str(p.ditahan_mode) : st.mode;
            const dt = hitungDitahan(cn, mode, p.ditahan_persen != null ? num(p.ditahan_persen) : st.persen, num(p.ditahan_manual));
            applyDecision(c, cn, { ditahan: dt, mode: num(cn.nilai_produksi) ? mode : '', penyelesaian: str(p.penyelesaian), catatan: str(p.catatan) });
          }
          return cnView(c, c.s.all('cancellations').find((x) => x.id === p.id)!);
        });
      },
    },
    'cancel.list': {
      auth: true,
      fn: (c: Ctx, p: any) => {
        needAny(c, [['pembatalan', 'lihat'], ['pembatalan', 'ubah'], ['pembatalan.owner', 'ubah']]);
        const t = today(c);
        const from = isYmd(str(p.from)) ? str(p.from) : t.slice(0, 8) + '01', to = isYmd(str(p.to)) ? str(p.to) : t;
        const inR = (v: unknown) => str(v).slice(0, 10) >= from && str(v).slice(0, 10) <= to;
        const orders = c.s.all('orders');
        const all = c.s.all('cancellations');
        const rows = all.filter((x) => x.status === 'menunggu' || inR(x.tanggal) || inR(x.created_at)).map((x) => ({ ...cnView(c, x), flag: flagPengganti(c, x, orders), bisa_putuskan: x.status === 'menunggu' && bisaPutus(c, x) }))
          .sort((a, b) => str((b as Row).created_at).localeCompare(str((a as Row).created_at)));
        const ok = all.filter((x) => x.status === 'disetujui' && inR(x.diputus_at));
        const omzet = orders.filter((o) => !bool(o.batal) && str(o.tanggal) >= from && str(o.tanggal) <= to).reduce((a, o) => a + num(o.total), 0);
        const nilai = ok.reduce((a, x) => a + num(x.nilai_batal), 0);
        const rfs = c.s.all('refunds').filter((r) => r.sumber === 'pembatalan' && r.status === 'dibayar' && inR(r.dibayar_at));
        const deps = c.s.all('deposit_moves').filter((m) => m.jenis === 'pembatalan' && inR(m.tanggal));
        const wait = all.filter((x) => x.status === 'menunggu');
        const omzetUser: Record<string, number> = {};
        orders.filter((o) => !bool(o.batal) && str(o.tanggal) >= from && str(o.tanggal) <= to).forEach((o) => { omzetUser[str(o.cs_id)] = (omzetUser[str(o.cs_id)] || 0) + num(o.total); });
        const u = users(c);
        const perUser: Record<string, { nama: string; dokumen: number; nilai: number }> = {};
        ok.forEach((x) => { const k = str(x.created_by); const r = (perUser[k] ||= { nama: u[k] || '–', dokumen: 0, nilai: 0 }); r.dokumen++; r.nilai += num(x.nilai_batal); });
        const perKat: Record<string, number> = {};
        ok.forEach((x) => { perKat[str(x.kategori) || 'Lainnya'] = (perKat[str(x.kategori) || 'Lainnya'] || 0) + 1; });
        return {
          from, to, rows,
          ringkas: {
            nilai, dokumen: ok.length, persen_omzet: omzet ? Math.round((nilai / omzet) * 1000) / 10 : 0, omzet,
            kerugian: ok.reduce((a, x) => a + num(x.hpp_bahan) + num(x.hpp_klik), 0), kerugian_nota: ok.filter((x) => num(x.hpp_bahan) + num(x.hpp_klik) > 0).length,
            refund: rfs.reduce((a, r) => a + num(r.nominal), 0), refund_tunai: rfs.filter((r) => r.cara === 'tunai').reduce((a, r) => a + num(r.nominal), 0), refund_transfer: rfs.filter((r) => r.cara === 'transfer').reduce((a, r) => a + num(r.nominal), 0),
            deposit: deps.reduce((a, m) => a + num(m.masuk), 0), deposit_konsumen: new Set(deps.map((m) => str(m.customer_id))).size,
            menunggu: wait.length, menunggu_nilai: wait.reduce((a, x) => a + num(x.nilai_item), 0),
            menunggu_tertua: wait.length ? Math.max(...wait.map((x) => Math.round((Date.parse(t) - Date.parse(str(x.created_at).slice(0, 10))) / 86400000))) : 0,
            ditandai: rows.filter((r) => r.flag).length,
          },
          per_user: Object.entries(perUser).map(([id, r]) => ({ id, ...r, persen: omzetUser[id] ? Math.round((r.nilai / omzetUser[id]) * 1000) / 10 : null })).sort((a, b) => b.nilai - a.nilai),
          per_kategori: Object.entries(perKat).map(([k, n]) => ({ kategori: k, jumlah: n })).sort((a, b) => b.jumlah - a.jumlah),
          bisa_putuskan: can(c, 'pembatalan', 'ubah') || can(c, 'pembatalan.owner', 'ubah'),
        };
      },
    },

    // ---------------- refund ----------------
    'refund.list': {
      auth: true,
      fn: (c: Ctx, p: any) => {
        needAny(c, [['kasir', 'tambah'], ['pindah_dana', 'lihat'], ['deposit', 'lihat'], ['pembatalan', 'lihat']]);
        const u = users(c);
        const orders = byId(c.s.all('orders'));
        const meths = byId(c.s.all('payment_methods'));
        const st = str(p.status);
        return c.s.all('refunds').filter((r) => !st || r.status === st).sort((a, b) => str(b.created_at).localeCompare(str(a.created_at))).slice(0, 500).map((r) => ({
          ...r, customer_nama: custName(c, str(r.customer_id)), order_nomor: str(orders[str(r.order_id)]?.nomor), method_nama: str(meths[str(r.method_id)]?.nama),
          dibayar_nama: u[str(r.dibayar_oleh)] || '', diputus_nama: u[str(r.diputus_oleh)] || '', diajukan_nama: u[str(r.created_by)] || '',
          bisa_bayar: r.status === 'siap' && (r.cara === 'tunai' ? can(c, 'kasir', 'tambah') || can(c, 'pindah_dana', 'ubah') : can(c, 'pindah_dana', 'ubah')),
          bisa_putuskan: r.status === 'menunggu' && can(c, 'pembatalan.owner', 'ubah'),
        }));
      },
    },
    'refund.pay': {
      auth: true,
      fn: (c: Ctx, p: any) => {
        const r0 = c.s.all('refunds').find((x) => x.id === p.id) || fail('NOT_FOUND', 'Refund tidak ditemukan.');
        const cara = ['tunai', 'transfer'].includes(str(p.cara)) ? str(p.cara) : str(r0.cara);
        const tn = tunai(c);
        let methodId = '', kasirId = '';
        if (cara === 'tunai') {
          needAny(c, [['kasir', 'tambah'], ['pindah_dana', 'ubah']]);
          if (!tn) fail('VALIDATION', 'Metode Tunai belum ada.');
          methodId = str(tn!.id);
          // kasir membayar dari lacinya sendiri; owner/keuangan tanpa laci membayar dari kas owner
          const rows = Object.fromEntries(ext.trial(c, '2000-01-01', today(c)).rows.map((x) => [x.kode, x.saldo_akhir])) as Record<string, number>;
          const laci = Math.round(num(rows[`1100:${methodId}:${me(c)}`]));
          if (c.user?.role === 'kasir' || laci > 0) {
            kasirId = me(c);
            if (laci < num(r0.nominal)) fail('VALIDATION', `Saldo laci Anda ${fmt(laci)}, tidak cukup untuk refund ${fmt(num(r0.nominal))}.`);
          } else if (!can(c, 'pindah_dana', 'ubah')) fail('FORBIDDEN', 'Refund tunai dibayar dari laci kasir.');
        } else {
          needAny(c, [['pindah_dana', 'ubah']]);
          const m = c.s.all('payment_methods').find((x) => x.id === p.method_id && x.jenis !== 'tunai') || fail('VALIDATION', 'Pilih rekening asal transfer.');
          methodId = str(m.id);
          if (!str(p.bukti)) fail('VALIDATION', 'Lampirkan foto bukti transfer.');
        }
        if (!str(p.penerima)) fail('VALIDATION', 'Isi nama penerima uang.');
        checkPassword(c, p.password);
        return c.s.withLock(() => {
          const r = c.s.all('refunds').find((x) => x.id === p.id)!;
          if (r.status !== 'siap') fail('VALIDATION', r.status === 'dibayar' ? 'Refund ini sudah dibayar.' : 'Refund ini belum disetujui.');
          const bukti = saveBukti(c, `refund-${today(c)}-${str(r.id)}.jpg`, str(p.bukti));
          c.s.update('refunds', 'id', str(r.id), { status: 'dibayar', cara, method_id: methodId, kasir_id: kasirId, penerima: str(p.penerima).slice(0, 120), bukti, dibayar_oleh: me(c), dibayar_at: iso(c.env), catatan: str(p.catatan).slice(0, 200), ...stamp(c, false) });
          if (r.sumber === 'pembatalan' && r.order_id) {
            const o = c.s.all('orders').find((x) => x.id === r.order_id);
            if (o) { c.s.update('orders', 'id', str(o.id), { dikembalikan: num(o.dikembalikan) + num(r.nominal) }); recalcOrder(c, str(o.id)); }
          } else if (r.sumber === 'deposit') {
            addDeposit(c, { customer_id: str(r.customer_id), jenis: 'cair', keluar: num(r.nominal), method_id: methodId, kasir_id: kasirId, ref_tabel: 'refunds', ref_id: str(r.id), keterangan: `Pencairan ${str(r.nomor)}` });
          }
          log(c, 'refund_bayar', 'refunds', str(r.id), `${str(r.nomor)} dibayar ${cara} Rp ${fmt(num(r.nominal))} ke ${str(p.penerima)}`);
          ext.emit(c, { tipe: 'refund_bayar', judul: `${str(c.user?.nama)} membayar refund Rp ${fmt(num(r.nominal))} (${cara})`, detail: `${custName(c, str(r.customer_id))} · ${str(r.nomor)} · diterima ${str(p.penerima)}`, nominal: num(r.nominal), scope: 'keuangan', ref_tabel: 'refunds', ref_id: str(r.id) });
          return c.s.all('refunds').find((x) => x.id === r.id);
        });
      },
    },
    'refund.decide': {
      auth: true,
      fn: (c: Ctx, p: any) => {
        needAny(c, [['pembatalan.owner', 'ubah']]);
        checkPassword(c, p.password);
        return c.s.withLock(() => {
          const r = c.s.all('refunds').find((x) => x.id === p.id) || fail('NOT_FOUND', 'Pengajuan tidak ditemukan.');
          if (r.status !== 'menunggu') fail('VALIDATION', 'Pengajuan ini sudah diputuskan.');
          if (!p.setuju && !str(p.catatan)) fail('VALIDATION', 'Isi alasan penolakan.');
          if (p.setuju && num(r.nominal) > saldoOf(c, str(r.customer_id))) fail('VALIDATION', 'Saldo deposit konsumen sudah berubah dan tidak cukup.');
          c.s.update('refunds', 'id', str(r.id), { status: p.setuju ? 'siap' : 'ditolak', diputus_oleh: me(c), diputus_at: iso(c.env), catatan: str(p.catatan).slice(0, 200), ...stamp(c, false) });
          log(c, p.setuju ? 'cair_setuju' : 'cair_tolak', 'refunds', str(r.id), `Pencairan deposit ${str(r.nomor)} ${p.setuju ? 'disetujui' : 'ditolak'}`, str(p.catatan));
          ext.emit(c, { tipe: p.setuju ? 'cair_setuju' : 'cair_tolak', judul: `Pencairan deposit ${str(r.nomor)} ${p.setuju ? 'disetujui, siap dibayar' : 'ditolak'}`, detail: `${custName(c, str(r.customer_id))} · Rp ${fmt(num(r.nominal))}`, nominal: num(r.nominal), scope: 'setoran', target: str(r.created_by), ref_tabel: 'refunds', ref_id: str(r.id) });
          return c.s.all('refunds').find((x) => x.id === r.id);
        });
      },
    },

    // ---------------- deposit ----------------
    'deposit.summary': {
      auth: true,
      fn: (c: Ctx, p: any) => {
        needAny(c, [['deposit', 'lihat']]);
        const t = today(c);
        const from = isYmd(str(p.from)) ? str(p.from) : t.slice(0, 8) + '01', to = isYmd(str(p.to)) ? str(p.to) : t;
        const all = moves(c);
        const cust = byId(c.s.all('customers'));
        const per: Record<string, { saldo: number; terakhir: string; jenis_terakhir: string; mutasi: number }> = {};
        all.slice().sort((a, b) => str(a.created_at).localeCompare(str(b.created_at))).forEach((m) => {
          const k = str(m.customer_id); const r = (per[k] ||= { saldo: 0, terakhir: '', jenis_terakhir: '', mutasi: 0 });
          r.saldo += num(m.masuk) - num(m.keluar); r.terakhir = str(m.tanggal); r.jenis_terakhir = str(m.jenis); r.mutasi++;
        });
        const inR = (m: Row) => str(m.tanggal) >= from && str(m.tanggal) <= to;
        const rng = all.filter(inR);
        const total = Object.values(per).reduce((a, r) => a + r.saldo, 0);
        const buku = Math.round(num(ext.trial(c, '2000-01-01', t).rows.find((r) => r.kode === '2150')?.saldo_akhir));
        const sumJ = (j: string, k: 'masuk' | 'keluar') => rng.filter((m) => m.jenis === j).reduce((a, m) => a + num(m[k]), 0);
        return {
          from, to,
          ringkas: {
            total, konsumen: Object.values(per).filter((r) => Math.round(r.saldo) > 0).length,
            masuk: rng.reduce((a, m) => a + num(m.masuk), 0), topup: sumJ('topup', 'masuk'), dari_batal: sumJ('pembatalan', 'masuk'), lebih_bayar: sumJ('lebih_bayar', 'masuk'),
            dipakai: sumJ('pakai', 'keluar'), dipakai_nota: rng.filter((m) => m.jenis === 'pakai').length, dicairkan: sumJ('cair', 'keluar'), dicairkan_n: rng.filter((m) => m.jenis === 'cair').length,
            buku_besar: buku, cocok: Math.round(total) === buku, selisih: Math.round(total) - buku,
          },
          konsumen: Object.entries(per).filter(([, r]) => Math.round(r.saldo) !== 0).map(([id, r]) => ({
            customer_id: id, nama: str(cust[id]?.nama) || '(terhapus)', kode: str(cust[id]?.kode), tipe: str(cust[id]?.tipe), percetakan: str(cust[id]?.percetakan),
            saldo: Math.round(r.saldo), ditahan: ditahan(c, id), terakhir: r.terakhir, jenis_terakhir: r.jenis_terakhir, umur: Math.round((Date.parse(t) - Date.parse(r.terakhir)) / 86400000),
          })).sort((a, b) => b.saldo - a.saldo),
          bisa_topup: can(c, 'deposit', 'tambah'), bisa_cair: can(c, 'deposit', 'tambah'),
          pilihan: can(c, 'deposit', 'tambah') ? c.s.all('customers').filter((x) => bool(x.aktif)).map((x) => ({ id: x.id, nama: x.nama, kode: x.kode, percetakan: x.percetakan })) : [],
          methods: c.s.all('payment_methods').filter((m) => bool(m.aktif)).map((m) => ({ id: m.id, nama: m.nama, jenis: m.jenis })),
        };
      },
    },
    'deposit.card': {
      auth: true,
      fn: (c: Ctx, p: any) => {
        needAny(c, [['deposit', 'lihat'], ['master.konsumen', 'lihat'], ['kasir', 'tambah']]);
        const cid = str(p.customer_id);
        const u = users(c);
        const meths = byId(c.s.all('payment_methods'));
        const list = moves(c, cid).sort((a, b) => str(a.created_at).localeCompare(str(b.created_at))).map((m) => ({ ...m, oleh: u[str(m.created_by)] || '', method_nama: str(meths[str(m.method_id)]?.nama) }));
        const cu = c.s.all('customers').find((x) => x.id === cid);
        return { customer: cu ? { id: cu.id, nama: cu.nama, kode: cu.kode, telp: cu.telp, percetakan: cu.percetakan, tipe: cu.tipe } : null, saldo: saldoOf(c, cid), bebas: saldoBebas(c, cid), mutasi: list };
      },
    },
    'deposit.topup': {
      auth: true,
      fn: (c: Ctx, p: any) => {
        needAny(c, [['deposit', 'tambah']]);
        const cu = c.s.all('customers').find((x) => x.id === p.customer_id) || fail('VALIDATION', 'Pilih konsumen.');
        const nominal = Math.round(num(p.nominal));
        if (nominal <= 0) fail('VALIDATION', 'Isi nominal deposit.');
        const m = c.s.all('payment_methods').find((x) => x.id === p.method_id && bool(x.aktif)) || fail('VALIDATION', 'Pilih uang diterima lewat apa.');
        return c.s.withLock(() => {
          const id = newId(c.env, 'dpt');
          const bukti = saveBukti(c, `deposit-${today(c)}-${id}.jpg`, str(p.bukti));
          const kasir = m.jenis === 'tunai' && (c.user?.role === 'kasir' || !can(c, 'pindah_dana', 'ubah')) ? me(c) : '';
          const row = addDeposit(c, { customer_id: str(cu.id), jenis: 'topup', masuk: nominal, method_id: str(m.id), kasir_id: kasir, bukti, ref_tabel: '', ref_id: id, keterangan: str(p.catatan) || `Titip di muka · ${str(m.nama)}` });
          log(c, 'deposit_topup', 'deposit_moves', str(row.id), `Deposit ${str(cu.nama)} +${fmt(nominal)} (${str(m.nama)})`);
          ext.emit(c, { tipe: 'deposit_topup', judul: `Deposit masuk Rp ${fmt(nominal)} · ${str(cu.nama)}`, detail: `${str(row.nomor)} · ${str(m.nama)} · ${str(c.user?.nama)}`, nominal, scope: 'keuangan', ref_tabel: 'deposit_moves', ref_id: str(row.id) });
          return { ...row, customer_nama: cu.nama, method_nama: m.nama };
        });
      },
    },
    'deposit.cair': {
      auth: true,
      fn: (c: Ctx, p: any) => {
        needAny(c, [['deposit', 'tambah']]);
        const cu = c.s.all('customers').find((x) => x.id === p.customer_id) || fail('VALIDATION', 'Pilih konsumen.');
        const nominal = Math.round(num(p.nominal));
        if (nominal <= 0) fail('VALIDATION', 'Isi nominal yang dicairkan.');
        if (!str(p.alasan)) fail('VALIDATION', 'Isi alasan pencairan.');
        const cara = str(p.cara) === 'transfer' ? 'transfer' : 'tunai';
        return c.s.withLock(() => {
          const bebas = saldoBebas(c, str(cu.id));
          if (nominal > bebas) fail('VALIDATION', `Saldo deposit yang bisa dicairkan ${fmt(bebas)}.`);
          const id = newId(c.env, 'rf');
          const row = c.s.insert('refunds', { id, nomor: nomor(c, 'RF'), tanggal: today(c), customer_id: cu.id, sumber: 'deposit', ref_id: '', order_id: '', nominal, cara, status: 'menunggu', alasan: str(p.alasan).slice(0, 300),
            method_id: '', kasir_id: '', penerima: '', bukti: '', diputus_oleh: '', diputus_at: '', dibayar_oleh: '', dibayar_at: '', catatan: '', ...stamp(c, true) });
          log(c, 'cair_ajukan', 'refunds', id, `Ajukan pencairan deposit ${str(cu.nama)} Rp ${fmt(nominal)}`, str(p.alasan));
          ext.emit(c, { tipe: 'cair_ajukan', judul: `${str(c.user?.nama)} mengajukan pencairan deposit Rp ${fmt(nominal)}`, detail: `${str(cu.nama)} · ${cara} · "${str(p.alasan).slice(0, 80)}"`, nominal, scope: 'keuangan', tindakan: 'cair', ref_tabel: 'refunds', ref_id: id });
          return row;
        });
      },
    },
    'deposit.methods': {
      auth: true,
      fn: (c: Ctx) => {
        needAny(c, [['kasir', 'tambah'], ['pindah_dana', 'lihat'], ['deposit', 'lihat']]);
        return c.s.all('payment_methods').filter((m) => bool(m.aktif)).map((m) => ({ id: m.id, nama: m.nama, jenis: m.jenis }));
      },
    },
    'order.lebih_ke_deposit': {
      auth: true,
      fn: (c: Ctx, p: any) => {
        needAny(c, [['kasir', 'tambah'], ['pembatalan', 'ubah']]);
        return c.s.withLock(() => {
          const o = c.s.all('orders').find((x) => x.id === p.order_id) || fail('NOT_FOUND', 'Nota tidak ditemukan.');
          const n = overpayToDeposit(c, str(o.id));
          if (!n) fail('VALIDATION', 'Tidak ada kelebihan bayar pada nota ini.');
          log(c, 'lebih_deposit', 'orders', str(o.id), `Kelebihan bayar ${str(o.nomor)} Rp ${fmt(n)} jadi deposit`);
          return orderDetail(c, str(o.id));
        });
      },
    },

    // ---------------- kartu konsumen ----------------
    'customer.profile': {
      auth: true,
      fn: (c: Ctx, p: any) => {
        needAny(c, [['master.konsumen', 'lihat']]);
        const cid = str(p.customer_id);
        const cu = c.s.all('customers').find((x) => x.id === cid) || fail('NOT_FOUND', 'Konsumen tidak ditemukan.');
        const t = today(c);
        const u = users(c);
        const allOrders = c.s.all('orders').filter((o) => !bool(o.batal));
        const orders = allOrders.filter((o) => o.customer_id === cid).sort((a, b) => str(b.created_at).localeCompare(str(a.created_at)));
        const net = (o: Row) => num(o.total) - num(o.batal_nilai);
        const ids = new Set(orders.map((o) => str(o.id)));
        const items = c.s.all('order_items').filter((i) => ids.has(str(i.order_id)));
        const pays = c.s.all('payments').filter((x) => ids.has(str(x.order_id)));
        const meths = byId(c.s.all('payment_methods'));
        const belanja = orders.reduce((a, o) => a + net(o), 0);
        // peringkat berdasarkan belanja bersih semua konsumen
        const totals: Record<string, number> = {};
        allOrders.forEach((o) => { totals[str(o.customer_id)] = (totals[str(o.customer_id)] || 0) + net(o); });
        const rank = Object.values(totals).filter((v) => v > belanja).length + 1;
        const tgl = [...new Set(orders.map((o) => str(o.tanggal)))].sort();
        const interval = tgl.length > 1 ? Math.round((Date.parse(tgl[tgl.length - 1]) - Date.parse(tgl[0])) / 86400000 / (tgl.length - 1)) : null;
        const open = orders.filter((o) => num(o.sisa) > 0);
        const umur = (o: Row) => Math.round((Date.parse(t) - Date.parse(str(o.tanggal))) / 86400000);
        const aging = { a: 0, an: 0, b: 0, bn: 0, c: 0, cn: 0 };
        open.forEach((o) => { const d = umur(o); if (d <= 30) { aging.a += num(o.sisa); aging.an++; } else if (d <= 60) { aging.b += num(o.sisa); aging.bn++; } else { aging.c += num(o.sisa); aging.cn++; } });
        const cns = c.s.all('cancellations').filter((x) => x.customer_id === cid);
        const cnOk = cns.filter((x) => x.status === 'disetujui');
        const status = { lunas: 0, dp: 0, belum: 0, batal: 0 } as Record<string, number>;
        orders.forEach((o) => { const s = str(o.status_bayar); status[s] = (status[s] || 0) + 1; });
        const year = t.slice(0, 4);
        const bulan = Array.from({ length: 12 }, () => ({ cash: 0, piutang: 0, batal: 0 }));
        orders.forEach((o) => {
          if (str(o.tanggal).slice(0, 4) !== year) return;
          const m = Number(str(o.tanggal).slice(5, 7)) - 1, n = net(o), pi = Math.max(0, Math.min(n, num(o.sisa)));
          bulan[m].cash += n - pi; bulan[m].piutang += pi; bulan[m].batal += num(o.batal_nilai);
        });
        const prod: Record<string, { nama: string; nilai: number; qty: number }> = {};
        items.forEach((i) => { const q = num(i.qty) - num(i.qty_batal); if (q <= 0) return; const k = str(i.product_id); const r = (prod[k] ||= { nama: str(i.nama_produk), nilai: 0, qty: 0 }); r.nilai += Math.round(num(i.subtotal) * (q / Math.max(1, num(i.qty)))); r.qty += q; });
        const hari = [0, 0, 0, 0, 0, 0, 0], jam: Record<number, number> = {};
        orders.forEach((o) => { hari[new Date(str(o.tanggal) + 'T00:00:00').getDay()]++; const h = Number(str(o.created_at).slice(11, 13)); if (!Number.isNaN(h)) jam[h] = (jam[h] || 0) + 1; });
        const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const topHari = hari.map((n, i) => ({ n, i })).filter((x) => x.n).sort((a, b) => b.n - a.n).slice(0, 2).map((x) => HARI[x.i]);
        const jamTop = Object.entries(jam).sort((a, b) => b[1] - a[1])[0];
        const lunasDays: number[] = [];
        orders.filter((o) => o.status_bayar === 'lunas').forEach((o) => { const ps = pays.filter((x) => x.order_id === o.id); if (!ps.length) return; const last = ps.map((x) => str(x.tanggal)).sort().pop()!; lunasDays.push(Math.max(0, Math.round((Date.parse(last) - Date.parse(str(o.tanggal))) / 86400000))); });
        const cara: Record<string, number> = {};
        pays.forEach((x) => { const j = x.method_id === DEPOSIT ? 'deposit' : str(meths[str(x.method_id)]?.jenis) || 'lain'; cara[j] = (cara[j] || 0) + num(x.nominal); });
        const csCount: Record<string, number> = {};
        orders.forEach((o) => { csCount[str(o.cs_id)] = (csCount[str(o.cs_id)] || 0) + 1; });
        const csTop = Object.entries(csCount).sort((a, b) => b[1] - a[1])[0];
        const dm = moves(c, cid).sort((a, b) => str(a.created_at).localeCompare(str(b.created_at)));
        const itemsBy: Record<string, Row[]> = {};
        items.forEach((i) => { (itemsBy[str(i.order_id)] ||= []).push(i); });
        const timeline: { waktu: string; jenis: string; judul: string; detail: string }[] = [];
        pays.slice().sort((a, b) => str(b.created_at).localeCompare(str(a.created_at))).slice(0, 8).forEach((x) => timeline.push({ waktu: str(x.created_at), jenis: 'bayar', judul: `Pembayaran Rp ${fmt(num(x.nominal))}`, detail: `${u[str(x.kasir_id)] || ''} · ${x.method_id === DEPOSIT ? 'deposit' : str(meths[str(x.method_id)]?.nama)} · ${str(orders.find((o) => o.id === x.order_id)?.nomor)}` }));
        cns.forEach((x) => timeline.push({ waktu: str(x.diputus_at || x.created_at), jenis: 'batal', judul: `Pembatalan ${x.status === 'disetujui' ? 'disetujui' : x.status === 'ditolak' ? 'ditolak' : 'diajukan'}`, detail: `${str(x.nomor)} · ${u[str(x.diputus_oleh || x.created_by)] || ''}` }));
        dm.filter((m) => m.jenis === 'topup' || m.jenis === 'cair').forEach((m) => timeline.push({ waktu: str(m.created_at), jenis: m.jenis === 'topup' ? 'deposit' : 'cair', judul: `${m.jenis === 'topup' ? 'Top-up deposit' : 'Pencairan deposit'} Rp ${fmt(num(m.masuk) || num(m.keluar))}`, detail: `${u[str(m.created_by)] || ''} · ${str(m.nomor)}` }));
        c.s.all('activity_log').filter((l) => l.tabel === 'customers' && l.record_id === cid).forEach((l) => timeline.push({ waktu: str(l.waktu), jenis: 'data', judul: l.aksi === 'tambah' ? 'Konsumen dibuat' : 'Data konsumen diubah', detail: str(l.user_nama) }));
        if (!timeline.some((x) => x.judul === 'Konsumen dibuat') && cu.created_at) timeline.push({ waktu: str(cu.created_at), jenis: 'data', judul: 'Konsumen dibuat', detail: u[str(cu.created_by)] || '' });
        timeline.sort((a, b) => b.waktu.localeCompare(a.waktu));
        return {
          customer: cu, cs_terbanyak: csTop ? u[csTop[0]] || '' : '', pelanggan_sejak: tgl[0] || str(cu.created_at).slice(0, 10),
          kpi: {
            belanja, nota: orders.length, rata_nota: orders.length ? Math.round(belanja / orders.length) : 0, peringkat: belanja > 0 ? rank : null, jumlah_konsumen: Object.keys(totals).length,
            terakhir: orders[0] ? str(orders[0].tanggal) : '', hari_sejak: orders[0] ? umur(orders[0]) : null, interval,
            piutang: open.reduce((a, o) => a + num(o.sisa), 0), piutang_nota: open.length, piutang_tertua: open.length ? Math.max(...open.map(umur)) : 0,
            deposit: saldoOf(c, cid), deposit_bebas: saldoBebas(c, cid),
            batal_dokumen: cnOk.length, batal_nilai: cnOk.reduce((a, x) => a + num(x.nilai_batal), 0), batal_menunggu: cns.filter((x) => x.status === 'menunggu').length,
          },
          status, aging, tahun: year, bulan,
          produk: Object.values(prod).sort((a, b) => b.nilai - a.nilai).slice(0, 5),
          kebiasaan: { hari: topHari, jam: jamTop ? `${String(jamTop[0]).padStart(2, '0')}.00–${String(Number(jamTop[0]) + 1).padStart(2, '0')}.00` : '', lama_bayar: lunasDays.length ? Math.round(lunasDays.reduce((a, b) => a + b, 0) / lunasDays.length) : null, cara },
          orders: orders.slice(0, 300).map((o) => {
            const its = itemsBy[str(o.id)] || [];
            return { id: o.id, nomor: o.nomor, tanggal: o.tanggal, total: num(o.total), batal_nilai: num(o.batal_nilai), terbayar: num(o.terbayar), sisa: num(o.sisa), status_bayar: o.status_bayar, status_ambil: o.status_ambil, status_batal: str(o.status_batal),
              ringkas: `${str(its[0]?.nama_produk)}${its.length > 1 ? ` · ${its.length} item` : ''}`, umur: umur(o), deposit: pays.some((x) => x.order_id === o.id && x.method_id === DEPOSIT) };
          }),
          payments: pays.sort((a, b) => str(b.created_at).localeCompare(str(a.created_at))).slice(0, 300).map((x) => ({ id: x.id, tanggal: x.tanggal, nominal: num(x.nominal), metode: x.method_id === DEPOSIT ? 'Deposit' : str(meths[str(x.method_id)]?.nama), kasir: u[str(x.kasir_id)] || '', nota: str(orders.find((o) => o.id === x.order_id)?.nomor) })),
          deposit: dm.map((m) => ({ ...m, oleh: u[str(m.created_by)] || '' })),
          pembatalan: cns.sort((a, b) => str(b.created_at).localeCompare(str(a.created_at))).map((x) => cnView(c, x)),
          timeline: timeline.slice(0, 14),
        };
      },
    },
  };

  return { handlers, payWithDeposit, overpayToDeposit, saldoOf, saldoBebas, nomor, addDays };
}

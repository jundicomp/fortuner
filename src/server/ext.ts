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
  checkPassword: (c: any, password: unknown) => void;
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
  { kode: '6920', nama: 'Beban administrasi bank', tipe: 'beban' },
];

export const KAS_KECIL = 'kas_kecil';
export const LACI = 'laci:';
export const KAS_OWNER = 'Kas owner';
/** "Tina (Kasir)" → "Tina" */
const laciName = (nama: string) => nama.replace(/\s*\(.*?\)\s*/g, ' ').trim() || nama;
/** Alasan penyesuaian rekonsiliasi → akun lawan. */
export const RECON_REASONS: Record<string, string> = { 'Biaya admin bank': '6920', 'Bunga / bagi hasil': '4900', 'Selisih kas': '6910' };

export function makeExt(h: Helpers) {
  const { fail, str, bool, newId, iso, addDays, isYmd, settingsMap, need, stamp, log, checkPassword } = h;
  const can = (c: ExtCtx, key: string, op: Op = 'lihat') => !!c.perms?.[key]?.[op];
  const needAny = (c: ExtCtx, keys: [string, Op][]) => { if (!keys.some(([k, o]) => can(c, k, o))) fail('FORBIDDEN', 'Anda tidak punya akses untuk tindakan ini.'); };
  const today = (c: ExtCtx) => c.env.today();
  /** Harga bahan hanya untuk yang mengurus pembelian / laba. Operator & CS cukup melihat jumlah. */
  const seeCost = (c: ExtCtx) => can(c, 'pembelian') || can(c, 'laporan.laba') || can(c, 'master.harga_beli');
  const hideCost = (c: ExtCtx, r: Row, keys: string[]) => { if (seeCost(c)) return r; const o = { ...r }; keys.forEach((k) => { o[k] = null; }); return o; };
  const nextMonth = (ym: string) => { let y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) + 1; if (m > 12) { m = 1; y++; } return `${y}-${String(m).padStart(2, '0')}`; };
  const byId = (rows: Row[]) => Object.fromEntries(rows.map((r) => [str(r.id), r])) as Record<string, Row>;
  const userNames = (c: ExtCtx) => Object.fromEntries(c.s.all('users').map((u) => [str(u.id), str(u.nama)])) as Record<string, string>;
  interface KasAkun { id: string; nama: string; jenis: string; saldo: number; user_id?: string; plafon?: number }
  const fmt = (n: number) => Math.round(n).toLocaleString('id-ID');
  /** Saldo kas kecil (akun 1110) per hari ini. */
  function kasKecilSaldo(c: ExtCtx) { return Math.round(num(trial(c, '2000-01-01', today(c)).rows.find((r) => r.kode === '1110')?.saldo_akhir)); }
  interface Ev { tipe: string; judul: string; detail?: string; nominal?: number; scope: 'keuangan' | 'kas_kecil' | 'setoran'; target?: string; tindakan?: '' | 'setoran' | 'cek' | 'titip'; ref_tabel?: string; ref_id?: string }
  /** Catat kejadian untuk notifikasi. Tidak dipanggil saat seed demo (tanpa request). */
  function emit(c: ExtCtx, e: Ev) {
    if (!(c as any).req) return;
    try {
      c.s.insert('events', { id: newId(c.env, 'ev'), tipe: e.tipe, judul: e.judul.slice(0, 200), detail: str(e.detail).slice(0, 300), nominal: Math.round(num(e.nominal)), scope: e.scope, target_user: str(e.target),
        tindakan: str(e.tindakan), ref_tabel: str(e.ref_tabel), ref_id: str(e.ref_id), aktor_id: str(c.user?.id), created_at: iso(c.env) });
    } catch { /* notifikasi tidak boleh menggagalkan transaksi */ }
  }
  const pemutus = (c: ExtCtx) => can(c, 'pindah_dana');
  /** Siapa boleh melihat kejadian: keuangan → pemegang hak Pindah dana; kas kecil → + semua yang punya akses Kas; setoran → + kasir pemiliknya. */
  function evVisible(c: ExtCtx, ev: Row) {
    if (pemutus(c)) return true;
    if (ev.scope === 'kas_kecil') return can(c, 'kas');
    if (ev.scope === 'setoran') return str(ev.target_user) === str(c.user?.id);
    return false;
  }
  const tunaiMethod = (c: ExtCtx) => c.s.all('payment_methods').find((m) => m.jenis === 'tunai');
  /** Daftar user yang punya laci: kasir aktif + siapa pun yang pernah menerima tunai / punya saldo laci. */
  function laciUsers(c: ExtCtx, rows: Record<string, number>) {
    const tn = tunaiMethod(c);
    if (!tn) return [];
    const pre = `1100:${str(tn.id)}:`;
    const withSaldo = new Set(Object.keys(rows).filter((k) => k.startsWith(pre) && Math.round(num(rows[k]))).map((k) => k.slice(pre.length)));
    c.s.all('payments').forEach((p) => { if (p.method_id === tn.id && str(p.kasir_id)) withSaldo.add(str(p.kasir_id)); });
    return c.s.all('users').filter((u) => (u.role === 'kasir' && bool(u.aktif)) || withSaldo.has(str(u.id)));
  }
  /**
   * Semua tempat uang dengan saldo buku per tanggal: kas besar (metode Tunai), laci tiap kasir, kas kecil, rekening bank, EDC.
   * Tunai yang diterima kasir masuk ke lacinya sendiri; kas besar = uang tunai yang dipegang owner/keuangan.
   */
  function kasList(c: ExtCtx, t: string): KasAkun[] {
    const rows = Object.fromEntries(trial(c, '2000-01-01', t).rows.map((r) => [r.kode, r.saldo_akhir])) as Record<string, number>;
    const tn = tunaiMethod(c);
    const ms: KasAkun[] = c.s.all('payment_methods').filter((m) => bool(m.aktif)).map((m) => ({ id: str(m.id), nama: m.jenis === 'tunai' ? KAS_OWNER : str(m.nama), jenis: str(m.jenis), saldo: Math.round(num(rows['1100:' + str(m.id)])) }));
    const laci: KasAkun[] = tn ? laciUsers(c, rows).map((u) => ({ id: LACI + str(u.id), nama: `Laci ${laciName(str(u.nama))}`, jenis: 'laci', user_id: str(u.id), saldo: Math.round(num(rows[`1100:${str(tn.id)}:${str(u.id)}`])) })) : [];
    const ord = (j: string) => ({ tunai: 0, laci: 1, kas_kecil: 2, transfer: 3, edc: 4 } as Record<string, number>)[j] ?? 3;
    return [...ms, ...laci, { id: KAS_KECIL, nama: 'Kas kecil', jenis: 'kas_kecil', saldo: Math.round(num(rows['1110'])), plafon: Number(settingsMap(c.s).kas_kecil_plafon || 1000000) }].sort((a, b) => ord(a.jenis) - ord(b.jenis) || a.nama.localeCompare(b.nama));
  }
  /** Yang boleh dilihat user: pemegang hak "Pindah dana" melihat semua; kasir melihat semua laci kasir + kas kecil (rekening bank tidak). */
  function kasVisible(c: ExtCtx, list: KasAkun[]) {
    if (can(c, 'pindah_dana')) return list;
    const me = str(c.user?.id);
    // semua laci kasir terlihat oleh kasir (saling tahu kondisi kas), hanya baca
    const kasirIds = new Set(c.s.all('users').filter((u) => u.role === 'kasir').map((u) => str(u.id)));
    return list.filter((a) => (a.jenis === 'laci' && (a.user_id === me || (can(c, 'kas') && kasirIds.has(str(a.user_id))))) || (a.jenis === 'kas_kecil' && can(c, 'kas')) || (a.jenis !== 'laci' && a.jenis !== 'kas_kecil' && (can(c, 'pengeluaran') || can(c, 'hutang') || can(c, 'pembelian'))));
  }
  /** Transaksi yang menunggu keputusan owner: setoran menunggu + kas kecil yang perlu dicek. Kunci "tabel:id". */
  function openActions(c: ExtCtx) {
    const set = new Set<string>();
    c.s.all('cash_handovers').forEach((h) => { if (h.status === 'menunggu') set.add('cash_handovers:' + str(h.id)); });
    c.s.all('petty_cash').forEach((r) => { if (bool(r.perlu_cek) && !str(r.cek_status) && !bool(r.deleted)) set.add('petty_cash:' + str(r.id)); });
    c.s.all('fund_transfers').forEach((r) => { if (bool(r.perlu_cek) && !str(r.cek_status) && !bool(r.batal)) set.add('fund_transfers:' + str(r.id)); });
    c.s.all('expense_requests').forEach((r) => { if (r.status === 'menunggu') set.add('expense_requests:' + str(r.id)); });
    return set;
  }
  interface RRow { key: string; waktu: string; tanggal: string; jenis: string; keterangan: string; nominal: number; masuk: number; keluar: number; oleh: string; status: string; tone: string; aksi: '' | 'setoran' | 'cek' | 'titip'; ref_tabel: string; ref_id: string; bukti?: string; extra?: Row }
  /** Riwayat gabungan gerakan uang. Tab mengikuti hak akses: pemegang Pindah dana melihat semua, kasir hanya laci/setoran/kas kecil. */
  function riwayat(c: ExtCtx, tab: string, from: string, to: string) {
    needAny(c, [['kas', 'lihat'], ['pengeluaran.titip', 'lihat']]);
    const boss = pemutus(c), decide = can(c, 'pindah_dana', 'ubah');
    const me = str(c.user?.id), users = userNames(c), names = accNames(c);
    const tabs = boss
      ? [['semua', 'Semua'], ['cek', 'Perlu dicek'], ['setoran', 'Setoran'], ['titip', 'Titipan'], ['kaskecil', 'Kas kecil'], ['pindah', 'Pindah dana'], ...(can(c, 'pengeluaran') || can(c, 'hutang') ? [['pengeluaran', 'Pengeluaran']] : []), ['rekon', 'Rekonsiliasi']]
      : [['laci', 'Laci saya'], ['setoran', 'Setoran saya'], ...(can(c, 'pengeluaran.titip') ? [['titip', 'Titipan saya']] : []), ['kaskecil', 'Kas kecil']];
    if (!tabs.some(([k]) => k === tab)) tab = tabs[0][0];
    const open = openActions(c);
    const inR = (t: unknown) => (!from || str(t) >= from) && (!to || str(t) <= to);
    const cekInfo = (r: Row): [string, string] => !bool(r.perlu_cek) ? ['–', ''] : str(r.cek_status) === 'sesuai' ? [`Sesuai · ${users[str(r.cek_oleh)] || ''}`, 'ok'] : str(r.cek_status) === 'bermasalah' ? [`Bermasalah · ${str(r.cek_catatan)}`, 'bad'] : ['Perlu dicek', 'warn'];
    const mk = (r: Partial<RRow> & { key: string }): RRow => ({ waktu: '', tanggal: '', jenis: '', keterangan: '', nominal: 0, masuk: 0, keluar: 0, oleh: '', status: '–', tone: '', aksi: '', ref_tabel: '', ref_id: '', ...r });
    const ST: Record<string, [string, string]> = { menunggu: ['Menunggu', 'warn'], diterima: ['Diterima', 'ok'], ditolak: ['Ditolak', 'bad'], dibatalkan: ['Dibatalkan', 'mute'] };
    const setoran = (onlyMine: boolean) => c.s.all('cash_handovers').filter((h) => !onlyMine || h.kasir_id === me).map((h) => mk({
      key: 'cash_handovers:' + h.id, waktu: str(h.created_at), tanggal: str(h.tanggal), jenis: 'Setoran', keterangan: `${names[LACI + str(h.kasir_id)] || 'Laci'} → ${KAS_OWNER}${h.catatan ? ` · "${str(h.catatan)}"` : ''}${h.catatan_owner ? ` · owner: "${str(h.catatan_owner)}"` : ''}`,
      nominal: num(h.nominal), keluar: num(h.nominal), oleh: users[str(h.kasir_id)] || '', status: ST[str(h.status)]?.[0] || str(h.status), tone: ST[str(h.status)]?.[1] || '',
      aksi: decide && h.status === 'menunggu' ? 'setoran' : '', ref_tabel: 'cash_handovers', ref_id: str(h.id) }));
    const fundRow = (f: Row, view?: string) => {
      const [cs, ct] = cekInfo(f);
      const masuk = view && f.ke === view ? num(f.nominal) : 0, keluar = view && f.dari === view ? num(f.nominal) + num(f.biaya_admin) : 0;
      return mk({ key: 'fund_transfers:' + f.id, waktu: str(f.created_at), tanggal: str(f.tanggal), jenis: f.dari === KAS_KECIL || f.ke === KAS_KECIL ? 'Kas kecil' : 'Pindah dana',
        keterangan: `${str(f.jenis)}: ${names[str(f.dari)] || f.dari} → ${names[str(f.ke)] || f.ke} · ${str(f.keterangan)}`, nominal: num(f.nominal), masuk, keluar, oleh: users[str(f.created_by)] || '',
        status: bool(f.batal) ? 'Batal' : bool(f.perlu_cek) ? cs : 'Sah', tone: bool(f.batal) ? 'bad' : bool(f.perlu_cek) ? ct : 'ok',
        aksi: decide && open.has('fund_transfers:' + f.id) ? 'cek' : '', ref_tabel: 'fund_transfers', ref_id: str(f.id) });
    };
    const kasKecil = () => [
      ...c.s.all('petty_cash').filter((r) => !bool(r.deleted)).map((r) => { const [cs, ct] = cekInfo(r); return mk({ key: 'petty_cash:' + r.id, waktu: str(r.created_at), tanggal: str(r.tanggal), jenis: 'Kas kecil',
        keterangan: `${num(r.masuk) ? 'Masuk' : 'Keluar'}: ${str(r.item)}${r.keterangan ? ` · ${str(r.keterangan)}` : ''}`, nominal: num(r.masuk) || num(r.keluar), masuk: num(r.masuk), keluar: num(r.keluar), oleh: users[str(r.created_by)] || '',
        status: cs, tone: ct, aksi: decide && open.has('petty_cash:' + r.id) ? 'cek' : '', ref_tabel: 'petty_cash', ref_id: str(r.id) }); }),
      ...c.s.all('fund_transfers').filter((f) => f.dari === KAS_KECIL || f.ke === KAS_KECIL).map((f) => fundRow(f, KAS_KECIL)),
    ];
    const pengeluaran = () => {
      const cats = byId(c.s.all('expense_categories')), meths = byId(c.s.all('payment_methods'));
      return [
        ...c.s.all('expenses').filter((x) => !bool(x.deleted)).map((x) => mk({ key: 'expenses:' + x.id, waktu: str(x.created_at), tanggal: str(x.tanggal), jenis: 'Pengeluaran', keterangan: `${str(cats[str(x.kategori_id)]?.nama)} · ${str(x.item)}`,
          nominal: num(x.total), keluar: num(x.total), oleh: users[str(x.created_by)] || '', status: x.cara_bayar === 'hutang' ? 'Hutang' : (meths[str(x.method_id)]?.jenis === 'tunai' ? KAS_OWNER : str(meths[str(x.method_id)]?.nama)), tone: x.cara_bayar === 'hutang' ? 'warn' : 'mute', ref_tabel: 'expenses', ref_id: str(x.id) })),
        ...c.s.all('bill_payments').map((b) => mk({ key: 'bill_payments:' + b.id, waktu: str(b.created_at), tanggal: str(b.tanggal), jenis: 'Bayar bon', keterangan: str(b.keterangan) || 'Pembayaran hutang supplier',
          nominal: num(b.nominal), keluar: num(b.nominal), oleh: users[str(b.created_by)] || '', status: meths[str(b.method_id)]?.jenis === 'tunai' ? KAS_OWNER : str(meths[str(b.method_id)]?.nama), tone: 'mute', ref_tabel: 'bill_payments', ref_id: str(b.id) })),
      ];
    };
    const TT: Record<string, [string, string]> = { menunggu: ['Menunggu', 'warn'], dikonfirmasi: ['Dikonfirmasi', 'ok'], ditolak: ['Ditolak', 'bad'], dibatalkan: ['Dibatalkan', 'mute'] };
    const titip = (onlyMine: boolean) => {
      const meths = byId(c.s.all('payment_methods')), cats = byId(c.s.all('expense_categories'));
      return c.s.all('expense_requests').filter((r) => !onlyMine || r.created_by === me).map((r) => mk({ key: 'expense_requests:' + r.id, waktu: str(r.created_at), tanggal: str(r.tanggal), jenis: 'Titipan',
        keterangan: `${r.jenis === 'bon' ? 'Bayar bon' : str(cats[str(r.kategori_id)]?.nama)} · ${str(r.item) || ''} · dari ${str(meths[str(r.method_id)]?.nama)}${r.penerima ? ` ke ${str(r.penerima)}` : ''}${r.catatan_owner ? ` · owner: "${str(r.catatan_owner)}"` : ''}`,
        nominal: num(r.nominal), oleh: users[str(r.created_by)] || '', status: TT[str(r.status)]?.[0] || str(r.status), tone: TT[str(r.status)]?.[1] || '',
        aksi: decide && r.status === 'menunggu' ? 'titip' : '', ref_tabel: 'expense_requests', ref_id: str(r.id), bukti: str(r.bukti),
        extra: { jenis: r.jenis, method_id: r.method_id, kategori_id: r.kategori_id, item: r.item, penerima: r.penerima, catatan: r.catatan, tanggal: r.tanggal } }));
    };
    const rekon = () => c.s.all('reconciliations').map((r) => mk({ key: 'reconciliations:' + r.id, waktu: str(r.created_at), tanggal: str(r.tanggal), jenis: 'Rekonsiliasi',
      keterangan: `${names[str(r.akun)] || r.akun}: sistem ${fmt(num(r.saldo_sistem))}, asli ${fmt(num(r.saldo_asli))}${r.alasan ? ` · ${str(r.alasan)}` : ''}`, nominal: num(r.selisih),
      oleh: users[str(r.created_by)] || '', status: !num(r.selisih) ? 'Cocok' : bool(r.disesuaikan) ? 'Disesuaikan' : 'Dicatat', tone: !num(r.selisih) ? 'ok' : bool(r.disesuaikan) ? 'brand' : 'warn', ref_tabel: 'reconciliations', ref_id: str(r.id) }));
    const laciSaya = () => {
      const tn = tunaiMethod(c), myLaci = LACI + me;
      const orders = byId(c.s.all('orders'));
      return [
        ...c.s.all('payments').filter((x) => tn && x.method_id === tn.id && x.kasir_id === me).map((x) => mk({ key: 'payments:' + x.id, waktu: str(x.created_at), tanggal: str(x.tanggal), jenis: 'Penjualan',
          keterangan: `${str(orders[str(x.order_id)]?.nomor)} · tunai`, nominal: num(x.nominal), masuk: num(x.nominal), oleh: users[me] || '', status: '–', ref_tabel: 'payments', ref_id: str(x.id) })),
        ...setoran(true).map((r) => ({ ...r, keluar: r.status === 'Diterima' ? r.nominal : 0 })),
        ...c.s.all('fund_transfers').filter((f) => f.dari === myLaci || f.ke === myLaci).map((f) => fundRow(f, myLaci)),
      ];
    };
    let rows: RRow[] = [];
    if (tab === 'laci') rows = laciSaya();
    else if (tab === 'setoran') rows = setoran(!boss);
    else if (tab === 'titip') rows = titip(!boss);
    else if (tab === 'kaskecil') rows = kasKecil();
    else if (tab === 'pindah') rows = c.s.all('fund_transfers').map((f) => fundRow(f));
    else if (tab === 'pengeluaran') rows = pengeluaran();
    else if (tab === 'rekon') rows = rekon();
    else {
      const seen = new Set<string>();
      rows = [...setoran(false), ...titip(false), ...kasKecil(), ...c.s.all('fund_transfers').map((f) => fundRow(f)), ...(can(c, 'pengeluaran') || can(c, 'hutang') ? pengeluaran() : []), ...rekon()].filter((r) => (seen.has(r.key) ? false : (seen.add(r.key), true)));
      if (tab === 'cek') rows = rows.filter((r) => open.has(r.key));
    }
    if (tab !== 'cek') rows = rows.filter((r) => inR(r.tanggal) || open.has(r.key));
    rows.sort((a, b) => (b.waktu || b.tanggal).localeCompare(a.waktu || a.tanggal));
    return { tab, tabs: tabs.map(([key, label]) => ({ key, label, jumlah: key === 'cek' ? open.size : 0 })), rows: rows.slice(0, 1000), bisa_putuskan: decide };
  }
  const accNames = (c: ExtCtx) => ({
    ...Object.fromEntries(c.s.all('payment_methods').map((m) => [str(m.id), m.jenis === 'tunai' ? KAS_OWNER : str(m.nama)])),
    ...Object.fromEntries(c.s.all('users').map((u) => [LACI + str(u.id), `Laci ${laciName(str(u.nama))}`])),
    [KAS_KECIL]: 'Kas kecil',
  }) as Record<string, string>;
  function jenisPindah(dari: KasAkun, ke: KasAkun) {
    const cash = (a: KasAkun) => a.jenis === 'tunai' || a.jenis === 'laci';
    if (ke.jenis === 'kas_kecil') return 'Isi kas kecil';
    if (dari.jenis === 'kas_kecil') return 'Kembali dari kas kecil';
    if (dari.jenis === 'laci' && ke.jenis === 'tunai') return 'Setoran ke owner';
    if (dari.jenis === 'tunai' && ke.jenis === 'laci') return 'Modal laci kasir';
    if (dari.jenis === 'laci' && ke.jenis === 'laci') return 'Antar laci';
    if (cash(dari)) return 'Setor tunai';
    if (cash(ke)) return 'Tarik tunai';
    if (dari.jenis === 'edc') return 'Pencairan EDC';
    return 'Antar rekening';
  }

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
    const jasa = num(p?.biaya_jasa); // jasa/ongkos lain per unit (diisi di form produk)
    return { bahan: r2(bahan), klik: r2(klik * tarif), jasa: r2(jasa), total: r2(bahan + klik * tarif + jasa), klik_per_unit: klik, tarif_klik: tarif, resep: recipes.length > 0, rincian };
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
    const uNames = userNames(c);
    /** Laci kasir = sub-akun dari kas tunai: 1100:<idTunai>:<idUser>. */
    const laci = (userId: unknown) => {
      const k = `1100:${str(tunai?.id)}:${str(userId)}`;
      if (!accounts[k]) accounts[k] = { kode: k, nama: `Kas & bank: Laci ${laciName(uNames[str(userId)] || str(userId))}`, tipe: 'aset' };
      return k;
    };
    /** Tunai yang diterima/dihitung kasir masuk ke laci kasir itu; metode lain ke akunnya sendiri. */
    const kasOf = (methodId: unknown, kasirId: unknown) => (tunai && str(methodId) === str(tunai.id) && str(kasirId) ? laci(kasirId) : kas(methodId));
    const kasirIds = new Set(c.s.all('users').filter((u) => u.role === 'kasir').map((u) => str(u.id)));
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
    c.s.all('payments').forEach((p) => add(str(p.tanggal), str(oById[str(p.order_id)]?.nomor), 'pembayaran', `Pembayaran ${str(oById[str(p.order_id)]?.nomor)}`, [{ akun: kasOf(p.method_id, p.kasir_id), d: num(p.nominal), k: 0 }, { akun: '1200', d: 0, k: num(p.nominal) }]));
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
      if (num(p.masuk)) add(str(p.tanggal), 'KAS KECIL', 'kas kecil', str(p.item) || 'Isi kas kecil', [{ akun: '1110', d: num(p.masuk), k: 0 }, { akun: !tunai ? '3100' : kasirIds.has(str(p.created_by)) ? laci(p.created_by) : kas(tunai.id), d: 0, k: num(p.masuk) }]);
      if (num(p.keluar)) add(str(p.tanggal), 'KAS KECIL', 'kas kecil', str(p.item), [{ akun: '6900', d: num(p.keluar), k: 0 }, { akun: '1110', d: 0, k: num(p.keluar) }]);
    });
    c.s.all('cash_deposits').forEach((d) => {
      const sel = num(d.selisih);
      if (!sel) return;
      add(str(d.tanggal), 'TUTUP KAS', 'kas', str(d.keterangan) || 'Selisih tutup kas', sel < 0 ? [{ akun: '6910', d: -sel, k: 0 }, { akun: kasOf(d.method_id, d.kasir_id), d: 0, k: -sel }] : [{ akun: kasOf(d.method_id, d.kasir_id), d: sel, k: 0 }, { akun: '6910', d: 0, k: sel }]);
    });
    const acc = (id: unknown) => (str(id) === KAS_KECIL ? '1110' : str(id).startsWith(LACI) ? laci(str(id).slice(LACI.length)) : kas(id));
    c.s.all('fund_transfers').forEach((f) => {
      if (bool(f.batal)) return;
      const ket = `${str(f.keterangan)}`;
      add(str(f.tanggal), 'PINDAH DANA', 'pindah dana', ket, [{ akun: acc(f.ke), d: num(f.nominal), k: 0 }, { akun: acc(f.dari), d: 0, k: num(f.nominal) }]);
      if (num(f.biaya_admin)) add(str(f.tanggal), 'PINDAH DANA', 'pindah dana', `Biaya admin: ${ket}`, [{ akun: '6920', d: num(f.biaya_admin), k: 0 }, { akun: acc(f.dari), d: 0, k: num(f.biaya_admin) }]);
    });
    c.s.all('cash_handovers').forEach((h) => {
      if (str(h.status) !== 'diterima' || !tunai) return;
      add(str(h.tanggal), 'SETORAN', 'setoran', `Setoran laci ${laciName(uNames[str(h.kasir_id)] || '')} ke owner`, [{ akun: kas(tunai.id), d: num(h.nominal), k: 0 }, { akun: laci(h.kasir_id), d: 0, k: num(h.nominal) }]);
    });
    c.s.all('reconciliations').forEach((r) => {
      const sel = num(r.selisih);
      if (!bool(r.disesuaikan) || !sel) return;
      const lawan = str(r.akun_lawan) || '6910';
      add(str(r.tanggal), 'REKONSILIASI', 'rekonsiliasi', `Penyesuaian: ${str(r.alasan)}${r.keterangan ? ' · ' + str(r.keterangan) : ''}`,
        sel > 0 ? [{ akun: acc(r.akun), d: sel, k: 0 }, { akun: lawan, d: 0, k: sel }] : [{ akun: lawan, d: -sel, k: 0 }, { akun: acc(r.akun), d: 0, k: -sel }]);
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
            const c1 = productCost(c, str(x.id), Number(x.sisi) === 2 ? 2 : 1, cache);
            const pr = (k: string, cost: number) => { const v = h ? num((h as any)[k]) : 0; return v ? { harga: v, margin: Math.round(((v - cost) / v) * 1000) / 10 } : null; };
            const cells = { es: pr('es', c1.total), rb: pr('rb', c1.total) };
            const margins = Object.values(cells).filter(Boolean).map((v) => (v as { margin: number }).margin);
            const terendah = margins.length ? Math.min(...margins) : null;
            return {
              id: x.id, kode: x.kode, nama: x.nama, kategori: x.kategori, jenis_harga: x.jenis_harga, mesin: str(cache.machines[str(x.mesin_id)]?.nama),
              kertas_sendiri: bool(x.kertas_sendiri), resep: c1.resep || bool(x.kertas_sendiri), hpp_bahan: c1.bahan, hpp_klik: c1.klik, hpp: c1.total, sisi: Number(x.sisi) === 2 ? 2 : 1, ...cells, margin_terendah: terendah,
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
    'analytics.get': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        need(c, 'laporan');
        const t = today(c);
        const grain: 'hari' | 'bulan' = p.grain === 'bulan' ? 'bulan' : 'hari';
        const to = isYmd(str(p.to)) ? str(p.to) : t;
        let from = isYmd(str(p.from)) ? str(p.from) : grain === 'bulan' ? `${addDays(to, -330).slice(0, 7)}-01` : addDays(to, -29);
        if (grain === 'bulan') from = `${from.slice(0, 7)}-01`;
        if (from > to) fail('VALIDATION', 'Tanggal awal harus sebelum tanggal akhir.');
        const laba = seeCost(c);
        const productId = str(p.product_id);
        const materialId = str(p.material_id);
        const keyOf = (d: string) => (grain === 'bulan' ? d.slice(0, 7) : d);
        // daftar bucket (hari / bulan) dalam rentang
        const keys: string[] = [];
        if (grain === 'hari') { for (let d = from; d <= to && keys.length < 400; d = addDays(d, 1)) keys.push(d); }
        else { let y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7)); const end = to.slice(0, 7); while (keys.length < 60) { const k = `${y}-${String(m).padStart(2, '0')}`; if (k > end) break; keys.push(k); m++; if (m > 12) { m = 1; y++; } } }
        const zero = () => Object.fromEntries(keys.map((k) => [k, 0])) as Record<string, number>;
        const inR = (d: unknown) => str(d) >= from && str(d) <= to;

        // ---- penjualan & laba kotor (per item; HPP aktual dari stok, atau taksiran resep + klik) ----
        const cache = { mats: byId(c.s.all('materials')), recipes: c.s.all('recipes'), machines: byId(c.s.all('machines')), products: byId(c.s.all('products')) };
        const unitCost: Record<string, number> = {};
        const costOf = (i: Row) => {
          if (str(i.stok_at)) return num(i.hpp_bahan) + num(i.hpp_klik);
          const k = `${str(i.product_id)}|${num(i.sisi) === 2 ? 2 : 1}`;
          if (!(k in unitCost)) unitCost[k] = productCost(c, str(i.product_id), num(i.sisi) === 2 ? 2 : 1, cache).total;
          return unitCost[k] * num(i.qty);
        };
        const allOrders = c.s.all('orders').filter((o) => !bool(o.batal));
        const oById = byId(allOrders);
        const omzet = zero(), hpp = zero(), qty = zero(); const nota: Record<string, Set<string>> = {};
        const perProduk: Record<string, { id: string; kode: string; nama: string; qty: number; omzet: number; hpp: number; nota: Set<string> }> = {};
        c.s.all('order_items').forEach((i) => {
          const o = oById[str(i.order_id)];
          if (!o || i.status_produksi === 'batal' || !inR(o.tanggal)) return;
          const k = keyOf(str(o.tanggal));
          const sub = num(i.subtotal), cst = costOf(i);
          const pid = str(i.product_id);
          const pr = (perProduk[pid] ||= { id: pid, kode: str(cache.products[pid]?.kode), nama: str(i.nama_produk), qty: 0, omzet: 0, hpp: 0, nota: new Set() });
          pr.qty += num(i.qty); pr.omzet += sub; pr.hpp += cst; pr.nota.add(str(o.id));
          if (productId && pid !== productId) return;
          if (k in omzet) { omzet[k] += sub; hpp[k] += cst; qty[k] += num(i.qty); (nota[k] ||= new Set()).add(str(o.id)); }
        });
        const penjualan = keys.map((k) => ({ key: k, omzet: Math.round(omzet[k]), hpp: laba ? Math.round(hpp[k]) : null, laba: laba ? Math.round(omzet[k] - hpp[k]) : null, qty: qty[k], nota: nota[k]?.size || 0 }));

        // ---- pembelian bahan ----
        const purchases = c.s.all('purchases').filter((x) => !bool(x.deleted) && inR(x.tanggal));
        const pById = byId(purchases);
        const beli = zero(), beliTrx: Record<string, Set<string>> = {};
        const perBahan: Record<string, { id: string; nama: string; satuan: string; qty: number; total: number }> = {};
        c.s.all('purchase_items').forEach((i) => {
          const pr = pById[str(i.purchase_id)]; if (!pr) return;
          const mid = str(i.material_id); const m = cache.mats[mid];
          const b = (perBahan[mid] ||= { id: mid, nama: str(m?.nama) || '–', satuan: str(m?.satuan), qty: 0, total: 0 });
          b.qty += num(i.qty_stok); b.total += num(i.subtotal);
          if (materialId && mid !== materialId) return;
          const k = keyOf(str(pr.tanggal));
          if (k in beli) { beli[k] += num(i.subtotal); (beliTrx[k] ||= new Set()).add(str(pr.id)); }
        });
        const pembelian = laba ? keys.map((k) => ({ key: k, total: Math.round(beli[k]), transaksi: beliTrx[k]?.size || 0 })) : null;

        // ---- saldo piutang & hutang di akhir tiap hari/bulan ----
        const bucketEnd = (k: string) => (grain === 'hari' ? k : addDays(`${nextMonth(k)}-01`, -1));
        const ends = keys.map((k) => { const e = bucketEnd(k); return e > to ? to : e; });
        const cum = (events: [string, number][]) => {
          events.sort((a, b) => a[0].localeCompare(b[0]));
          let j = 0, run = 0;
          return ends.map((e) => { while (j < events.length && events[j][0] <= e) { run += events[j][1]; j++; } return Math.round(run); });
        };
        const piutangEv: [string, number][] = [];
        allOrders.forEach((o) => piutangEv.push([str(o.tanggal), num(o.total)]));
        c.s.all('payments').forEach((x) => { if (oById[str(x.order_id)]) piutangEv.push([str(x.tanggal), -num(x.nominal)]); });
        const piutang = cum(piutangEv);
        let hutang: number[] | null = null;
        if (laba) {
          const hutangEv: [string, number][] = [];
          c.s.all('supplier_bills').forEach((b) => hutangEv.push([str(b.tanggal), num(b.total)]));
          c.s.all('bill_payments').forEach((x) => hutangEv.push([str(x.tanggal), -num(x.nominal)]));
          hutang = cum(hutangEv);
        }
        const saldo = keys.map((k, i) => ({ key: k, piutang: piutang[i], hutang: hutang ? hutang[i] : null }));

        // ---- top pelanggan (dengan capaian per bulan) ----
        const cust = byId(c.s.all('customers'));
        const months: string[] = []; { let y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7)); while (months.length < 24) { const k = `${y}-${String(m).padStart(2, '0')}`; if (k > to.slice(0, 7)) break; months.push(k); m++; if (m > 12) { m = 1; y++; } } }
        const perCust: Record<string, { id: string; nama: string; tipe: string; omzet: number; nota: number; terbayar: number; sisa: number; bulanan: Record<string, number>; terakhir: string }> = {};
        allOrders.filter((o) => inR(o.tanggal)).forEach((o) => {
          const id = str(o.customer_id); const cu = cust[id];
          const r = (perCust[id] ||= { id, nama: str(cu?.nama) || '–', tipe: str(cu?.tipe), omzet: 0, nota: 0, terbayar: 0, sisa: 0, bulanan: {}, terakhir: '' });
          r.omzet += num(o.total); r.nota += 1; r.terbayar += num(o.terbayar); r.sisa += Math.max(0, num(o.sisa));
          const mk = str(o.tanggal).slice(0, 7); r.bulanan[mk] = (r.bulanan[mk] || 0) + num(o.total);
          if (str(o.tanggal) > r.terakhir) r.terakhir = str(o.tanggal);
        });
        const custAll = Object.values(perCust).filter((r) => !/^umum|walk/i.test(r.nama));
        const totalOmzet = Object.values(perCust).reduce((a, r) => a + r.omzet, 0);
        const pelanggan = custAll.sort((a, b) => b.omzet - a.omzet).slice(0, Math.min(50, Math.max(1, Number(p.top) || 10)))
          .map((r, i) => ({ ...r, rank: i + 1, porsi: totalOmzet ? Math.round((r.omzet / totalOmzet) * 1000) / 10 : 0 }));

        // ---- ringkasan + pembanding periode sebelumnya (panjang sama) ----
        const len = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
        const pFrom = addDays(from, -len), pTo = addDays(from, -1);
        let prevOmzet = 0, prevHpp = 0;
        c.s.all('order_items').forEach((i) => {
          const o = oById[str(i.order_id)];
          if (!o || i.status_produksi === 'batal' || str(o.tanggal) < pFrom || str(o.tanggal) > pTo) return;
          if (productId && str(i.product_id) !== productId) return;
          prevOmzet += num(i.subtotal); prevHpp += costOf(i);
        });
        const prevBeli = c.s.all('purchases').filter((x) => !bool(x.deleted) && str(x.tanggal) >= pFrom && str(x.tanggal) <= pTo).reduce((a, x) => a + num(x.total), 0);
        const sumOmzet = penjualan.reduce((a, x) => a + x.omzet, 0);
        const sumHpp = keys.reduce((a, k) => a + hpp[k], 0);
        return {
          from, to, grain, keys, lihat_laba: laba, product_id: productId, material_id: materialId,
          penjualan, pembelian, saldo, pelanggan, months,
          ringkasan: {
            omzet: sumOmzet, laba: laba ? Math.round(sumOmzet - sumHpp) : null, margin: laba && sumOmzet ? Math.round(((sumOmzet - sumHpp) / sumOmzet) * 1000) / 10 : null,
            nota: new Set(Object.values(nota).flatMap((x) => [...x])).size,
            pembelian: laba ? (pembelian || []).reduce((a, x) => a + x.total, 0) : null,
            piutang: piutang[piutang.length - 1] ?? 0, piutang_awal: piutang[0] ?? 0,
            hutang: hutang ? hutang[hutang.length - 1] ?? 0 : null, hutang_awal: hutang ? hutang[0] ?? 0 : null,
            sebelumnya: { from: pFrom, to: pTo, omzet: Math.round(prevOmzet), laba: laba ? Math.round(prevOmzet - prevHpp) : null, pembelian: laba ? Math.round(prevBeli) : null },
          },
          produk: Object.values(perProduk).map((r) => ({ id: r.id, kode: r.kode, nama: r.nama, qty: r.qty, nota: r.nota.size, omzet: Math.round(r.omzet), hpp: laba ? Math.round(r.hpp) : null, laba: laba ? Math.round(r.omzet - r.hpp) : null, margin: laba && r.omzet ? Math.round(((r.omzet - r.hpp) / r.omzet) * 1000) / 10 : null })).sort((a, b) => b.omzet - a.omzet),
          bahan: laba ? Object.values(perBahan).map((b) => ({ ...b, total: Math.round(b.total) })).sort((a, b) => b.total - a.total) : [],
        };
      },
    },
    /** Saldo per kas/rekening (metode bayar) dari buku besar, untuk memilih sumber dana saat membayar. */
    'kas.saldo': {
      auth: true,
      fn: (c: ExtCtx) => {
        needAny(c, [['pengeluaran', 'lihat'], ['hutang', 'lihat'], ['pembelian', 'lihat'], ['kas', 'lihat'], ['pindah_dana', 'lihat']]);
        return kasVisible(c, kasList(c, today(c)));
      },
    },

    // ---------- pindah dana & rekonsiliasi ----------
    'fund.list': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        need(c, 'pindah_dana');
        const from = str(p.from), to = str(p.to);
        const names = accNames(c), users = userNames(c);
        const inR = (t: unknown) => (!from || str(t) >= from) && (!to || str(t) <= to);
        const transfers = c.s.all('fund_transfers').filter((f) => inR(f.tanggal))
          .map((f): Row => ({ ...f, dari_nama: names[str(f.dari)] || str(f.dari), ke_nama: names[str(f.ke)] || str(f.ke), oleh: users[str(f.created_by)] || '', batal_oleh_nama: users[str(f.batal_oleh)] || '' }))
          .sort((a, b) => (str(b.tanggal) + str(b.created_at)).localeCompare(str(a.tanggal) + str(a.created_at)));
        const recons = c.s.all('reconciliations').filter((r) => inR(r.tanggal))
          .map((r): Row => ({ ...r, akun_nama: names[str(r.akun)] || str(r.akun), oleh: users[str(r.created_by)] || '' }))
          .sort((a, b) => str(b.created_at).localeCompare(str(a.created_at)));
        const per = isYmd(str(p.per)) && str(p.per) <= today(c) ? str(p.per) : today(c);
        return { transfers, recons, akun: kasList(c, per), per, alasan: Object.keys(RECON_REASONS) };
      },
    },
    'fund.transfer': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        need(c, 'pindah_dana', 'tambah');
        const r = (p.transfer || {}) as Row;
        const t = str(r.tanggal) || today(c);
        if (!isYmd(t) || t > today(c)) fail('VALIDATION', 'Tanggal tidak valid.');
        const akun = kasList(c, t);
        const dari = akun.find((a) => a.id === str(r.dari)) || fail('VALIDATION', 'Pilih asal dana.');
        const ke = akun.find((a) => a.id === str(r.ke)) || fail('VALIDATION', 'Pilih tujuan dana.');
        if (dari.id === ke.id) fail('VALIDATION', 'Asal dan tujuan tidak boleh sama.');
        const nominal = Math.round(num(r.nominal)), admin = Math.round(num(r.biaya_admin));
        if (nominal <= 0) fail('VALIDATION', 'Isi nominal yang dipindah.');
        if (admin < 0) fail('VALIDATION', 'Biaya admin tidak boleh negatif.');
        const ket = str(r.keterangan).trim();
        if (!ket) fail('VALIDATION', 'Isi catatan / keterangan pindah dana.');
        checkPassword(c, p.password);
        return c.s.withLock(() => {
          const jenis = jenisPindah(dari, ke);
          const row = c.s.insert('fund_transfers', { id: newId(c.env, 'pd'), tanggal: t, jenis, dari: dari.id, ke: ke.id, nominal, biaya_admin: admin, keterangan: ket.slice(0, 300), batal: false, alasan_batal: '', batal_oleh: '', batal_at: '', ...stamp(c, true) });
          log(c, 'pindah_dana', 'fund_transfers', str(row.id), `${jenis}: ${dari.nama} → ${ke.nama} Rp ${nominal.toLocaleString('id-ID')}${admin ? ` (admin ${admin.toLocaleString('id-ID')})` : ''} · ${ket}`);
          emit(c, { tipe: 'pindah_dana', judul: `${str(c.user?.nama)}: ${jenis} Rp ${fmt(nominal)}`, detail: `${dari.nama} → ${ke.nama} · ${ket}`, nominal, scope: dari.id === KAS_KECIL || ke.id === KAS_KECIL ? 'kas_kecil' : 'keuangan', ref_tabel: 'fund_transfers', ref_id: str(row.id) });
          return { ...row, dari_nama: dari.nama, ke_nama: ke.nama };
        });
      },
    },
    'fund.cancel': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        need(c, 'pindah_dana', 'hapus');
        const alasan = str(p.alasan).trim();
        if (!alasan) fail('VALIDATION', 'Isi alasan pembatalan.');
        checkPassword(c, p.password);
        return c.s.withLock(() => {
          const f = c.s.all('fund_transfers').find((x) => x.id === p.id) || fail('NOT_FOUND', 'Data pindah dana tidak ditemukan.');
          if (bool(f.batal)) fail('VALIDATION', 'Pindah dana ini sudah dibatalkan.');
          c.s.update('fund_transfers', 'id', str(f.id), { batal: true, alasan_batal: alasan.slice(0, 300), batal_oleh: str(c.user?.id), batal_at: iso(c.env), ...stamp(c, false) });
          const names = accNames(c);
          emit(c, { tipe: 'pindah_batal', judul: `${str(c.user?.nama)} membatalkan pindah dana Rp ${fmt(num(f.nominal))}`, detail: `${names[str(f.dari)] || f.dari} → ${names[str(f.ke)] || f.ke} · ${alasan}`, nominal: num(f.nominal), scope: f.dari === KAS_KECIL || f.ke === KAS_KECIL ? 'kas_kecil' : 'keuangan', ref_tabel: 'fund_transfers', ref_id: str(f.id) });
          log(c, 'batal_pindah_dana', 'fund_transfers', str(f.id), `Batal ${str(f.jenis)}: ${names[str(f.dari)] || f.dari} → ${names[str(f.ke)] || f.ke} Rp ${num(f.nominal).toLocaleString('id-ID')}`, alasan);
          return { ok: true };
        });
      },
    },
    // ---------- setoran laci kasir → owner (dengan persetujuan) ----------
    'setoran.list': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        need(c, 'kas');
        const semua = can(c, 'pindah_dana');
        const me = str(c.user?.id), users = userNames(c);
        const from = str(p.from), to = str(p.to);
        const rows = c.s.all('cash_handovers').filter((h) => (semua || h.kasir_id === me) && (h.status === 'menunggu' || ((!from || str(h.tanggal) >= from) && (!to || str(h.tanggal) <= to))))
          .map((h): Row => ({ ...h, kasir_nama: users[str(h.kasir_id)] || '', diputus_nama: users[str(h.diputus_oleh)] || '' }))
          .sort((a, b) => (a.status === 'menunggu' ? 0 : 1) - (b.status === 'menunggu' ? 0 : 1) || str(b.created_at).localeCompare(str(a.created_at)));
        const lacis = kasList(c, today(c)).filter((a) => a.jenis === 'laci');
        return { rows, bisa_putuskan: can(c, 'pindah_dana', 'ubah'), laci_saya: lacis.find((a) => a.user_id === me) || null, laci: semua ? lacis : lacis.filter((a) => a.user_id === me) };
      },
    },
    'setoran.create': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        need(c, 'kas', 'tambah');
        const nominal = Math.round(num(p.nominal));
        if (nominal <= 0) fail('VALIDATION', 'Isi jumlah uang yang disetor.');
        checkPassword(c, p.password);
        const me = str(c.user?.id);
        return c.s.withLock(() => {
          if (c.s.all('cash_handovers').some((h) => h.kasir_id === me && h.status === 'menunggu')) fail('VALIDATION', 'Masih ada setoran yang menunggu persetujuan. Tunggu diputuskan atau batalkan dulu.');
          const laciSaya = kasList(c, today(c)).find((a) => a.jenis === 'laci' && a.user_id === me);
          const row = c.s.insert('cash_handovers', { id: newId(c.env, 'st'), tanggal: today(c), kasir_id: me, nominal, saldo_laci: laciSaya?.saldo || 0, catatan: str(p.catatan).slice(0, 300), status: 'menunggu', diputus_oleh: '', diputus_at: '', catatan_owner: '', ...stamp(c, true) });
          log(c, 'setoran', 'cash_handovers', str(row.id), `Setoran laci Rp ${nominal.toLocaleString('id-ID')} (saldo laci ${num(laciSaya?.saldo).toLocaleString('id-ID')}) menunggu persetujuan`);
          emit(c, { tipe: 'setoran_baru', judul: `${str(c.user?.nama)} mengirim setoran Rp ${fmt(nominal)}`, detail: 'Menunggu persetujuan' + (str(p.catatan) ? ` · "${str(p.catatan)}"` : ''), nominal, scope: 'setoran', target: me, tindakan: 'setoran', ref_tabel: 'cash_handovers', ref_id: str(row.id) });
          return row;
        });
      },
    },
    'setoran.cancel': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        need(c, 'kas');
        return c.s.withLock(() => {
          const h = c.s.all('cash_handovers').find((x) => x.id === p.id) || fail('NOT_FOUND', 'Setoran tidak ditemukan.');
          if (h.kasir_id !== str(c.user?.id)) fail('FORBIDDEN', 'Hanya kasir pembuat yang bisa membatalkan.');
          if (h.status !== 'menunggu') fail('VALIDATION', 'Setoran sudah diputuskan, tidak bisa dibatalkan.');
          c.s.update('cash_handovers', 'id', str(h.id), { status: 'dibatalkan', diputus_oleh: str(c.user?.id), diputus_at: iso(c.env), ...stamp(c, false) });
          log(c, 'setoran_batal', 'cash_handovers', str(h.id), `Kasir membatalkan setoran Rp ${num(h.nominal).toLocaleString('id-ID')}`);
          emit(c, { tipe: 'setoran_batal', judul: `${str(c.user?.nama)} membatalkan setoran Rp ${fmt(num(h.nominal))}`, nominal: num(h.nominal), scope: 'setoran', target: str(h.kasir_id), ref_tabel: 'cash_handovers', ref_id: str(h.id) });
          return { ok: true };
        });
      },
    },
    'setoran.decide': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        need(c, 'pindah_dana', 'ubah');
        const terima = bool(p.terima);
        const cat = str(p.catatan).trim();
        if (!terima && !cat) fail('VALIDATION', 'Isi alasan penolakan.');
        checkPassword(c, p.password);
        return c.s.withLock(() => {
          const h = c.s.all('cash_handovers').find((x) => x.id === p.id) || fail('NOT_FOUND', 'Setoran tidak ditemukan.');
          if (h.status !== 'menunggu') fail('VALIDATION', 'Setoran ini sudah diputuskan.');
          c.s.update('cash_handovers', 'id', str(h.id), { status: terima ? 'diterima' : 'ditolak', diputus_oleh: str(c.user?.id), diputus_at: iso(c.env), catatan_owner: cat.slice(0, 300), ...stamp(c, false) });
          const nm = userNames(c)[str(h.kasir_id)] || '';
          log(c, terima ? 'setoran_terima' : 'setoran_tolak', 'cash_handovers', str(h.id), `${terima ? 'Terima' : 'Tolak'} setoran ${nm} Rp ${num(h.nominal).toLocaleString('id-ID')}`, cat);
          emit(c, { tipe: terima ? 'setoran_terima' : 'setoran_tolak', judul: `Setoran ${nm} Rp ${fmt(num(h.nominal))} ${terima ? 'diterima' : 'ditolak'}`, detail: `oleh ${str(c.user?.nama)}${cat ? ` · "${cat}"` : ''}`, nominal: num(h.nominal), scope: 'setoran', target: str(h.kasir_id), ref_tabel: 'cash_handovers', ref_id: str(h.id) });
          return { ok: true };
        });
      },
    },
    // ---------- kas kecil: isi dari laci, isi ulang sampai plafon, cek owner ----------
    'kaskecil.isi_laci': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        need(c, 'kas', 'tambah');
        const nominal = Math.round(num(p.nominal));
        const ket = str(p.keterangan).trim();
        if (nominal <= 0) fail('VALIDATION', 'Isi jumlah yang dipindah ke kas kecil.');
        if (!ket) fail('VALIDATION', 'Isi untuk keperluan apa.');
        checkPassword(c, p.password);
        const me = str(c.user?.id);
        return c.s.withLock(() => {
          const laci = kasList(c, today(c)).find((a) => a.jenis === 'laci' && a.user_id === me) || fail('VALIDATION', 'Anda tidak punya laci kasir.');
          if (nominal > laci.saldo) fail('VALIDATION', `Saldo ${laci.nama} tidak cukup (Rp ${fmt(laci.saldo)}).`);
          const row = c.s.insert('fund_transfers', { id: newId(c.env, 'pd'), tanggal: today(c), jenis: 'Isi kas kecil dari laci', dari: laci.id, ke: KAS_KECIL, nominal, biaya_admin: 0, keterangan: ket.slice(0, 300),
            batal: false, alasan_batal: '', batal_oleh: '', batal_at: '', perlu_cek: true, cek_status: '', cek_oleh: '', cek_at: '', cek_catatan: '', ...stamp(c, true) });
          log(c, 'kas_kecil', 'fund_transfers', str(row.id), `Isi kas kecil dari ${laci.nama} Rp ${fmt(nominal)} · ${ket}`);
          emit(c, { tipe: 'kk_isi_laci', judul: `${str(c.user?.nama)} mengisi kas kecil dari laci Rp ${fmt(nominal)}`, detail: `Perlu dicek · "${ket}"`, nominal, scope: 'kas_kecil', tindakan: 'cek', ref_tabel: 'fund_transfers', ref_id: str(row.id) });
          return row;
        });
      },
    },
    'kaskecil.isi_plafon': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        need(c, 'pindah_dana', 'tambah');
        checkPassword(c, p.password);
        return c.s.withLock(() => {
          const akun = kasList(c, today(c));
          const kk = akun.find((a) => a.id === KAS_KECIL)!;
          const owner = akun.find((a) => a.jenis === 'tunai') || fail('VALIDATION', 'Metode Tunai (Kas owner) belum ada.');
          const nominal = Math.max(0, num(kk.plafon) - kk.saldo);
          if (nominal <= 0) fail('VALIDATION', 'Kas kecil sudah penuh sesuai plafon.');
          const ket = str(p.keterangan).trim() || 'Isi ulang sampai plafon';
          const row = c.s.insert('fund_transfers', { id: newId(c.env, 'pd'), tanggal: today(c), jenis: 'Isi kas kecil', dari: owner.id, ke: KAS_KECIL, nominal, biaya_admin: 0, keterangan: ket,
            batal: false, alasan_batal: '', batal_oleh: '', batal_at: '', perlu_cek: false, cek_status: '', cek_oleh: '', cek_at: '', cek_catatan: '', ...stamp(c, true) });
          log(c, 'kas_kecil', 'fund_transfers', str(row.id), `Isi ulang kas kecil sampai plafon Rp ${fmt(nominal)}`);
          emit(c, { tipe: 'kk_isi_plafon', judul: `${str(c.user?.nama)} mengisi ulang kas kecil Rp ${fmt(nominal)}`, detail: `Kas kecil kembali Rp ${fmt(num(kk.plafon))}`, nominal, scope: 'kas_kecil', ref_tabel: 'fund_transfers', ref_id: str(row.id) });
          return { ...row, saldo_baru: num(kk.plafon) };
        });
      },
    },
    'cek.set': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        need(c, 'pindah_dana', 'ubah');
        const tabel = str(p.tabel);
        if (!['petty_cash', 'fund_transfers'].includes(tabel)) fail('VALIDATION', 'Data tidak dikenal.');
        const status = str(p.status);
        if (!['sesuai', 'bermasalah'].includes(status)) fail('VALIDATION', 'Pilih Sesuai atau Bermasalah.');
        const cat = str(p.catatan).trim();
        if (status === 'bermasalah' && !cat) fail('VALIDATION', 'Isi catatan masalahnya.');
        return c.s.withLock(() => {
          const r = c.s.all(tabel).find((x) => x.id === p.id) || fail('NOT_FOUND', 'Data tidak ditemukan.');
          if (!bool(r.perlu_cek)) fail('VALIDATION', 'Transaksi ini tidak perlu dicek.');
          c.s.update(tabel, 'id', str(r.id), { cek_status: status, cek_oleh: str(c.user?.id), cek_at: iso(c.env), cek_catatan: cat.slice(0, 300), ...stamp(c, false) });
          const nominal = num(r.keluar || r.nominal);
          log(c, 'cek_kas_kecil', tabel, str(r.id), `Tandai ${status}: ${str(r.item || r.keterangan)} Rp ${fmt(nominal)}`, cat);
          emit(c, { tipe: 'cek_' + status, judul: `${str(c.user?.nama)} menandai ${status}: Rp ${fmt(nominal)}`, detail: `${str(r.item || r.keterangan)}${cat ? ` · "${cat}"` : ''}`, nominal, scope: 'kas_kecil', ref_tabel: tabel, ref_id: str(r.id) });
          return { ok: true };
        });
      },
    },

    // ---------- notifikasi ----------
    'notif.list': {
      auth: true,
      fn: (c: ExtCtx) => {
        const me = str(c.user?.id), users = userNames(c);
        const readAt = str(c.s.all('notif_reads').find((r) => r.user_id === me)?.read_at);
        const all = c.s.all('events').filter((e) => evVisible(c, e)).sort((a, b) => str(b.created_at).localeCompare(str(a.created_at)));
        const open = openActions(c);
        const items = all.slice(0, 40).map((e) => ({ ...e, aktor: users[str(e.aktor_id)] || '', baru: str(e.created_at) > readAt && str(e.aktor_id) !== me,
          masih_tindakan: !!e.tindakan && open.has(`${str(e.ref_tabel)}:${str(e.ref_id)}`) }));
        return { items, belum_dibaca: all.filter((e) => str(e.created_at) > readAt && str(e.aktor_id) !== me).length, perlu_tindakan: pemutus(c) ? open.size : 0, read_at: readAt, bisa_putuskan: can(c, 'pindah_dana', 'ubah') };
      },
    },
    'notif.read': {
      auth: true,
      fn: (c: ExtCtx) => {
        const me = str(c.user?.id);
        return c.s.withLock(() => {
          const now = iso(c.env);
          if (c.s.all('notif_reads').some((r) => r.user_id === me)) c.s.update('notif_reads', 'user_id', me, { read_at: now });
          else c.s.insert('notif_reads', { user_id: me, read_at: now });
          return { read_at: now };
        });
      },
    },

    // ---------- riwayat transaksi kas ----------
    'riwayat.list': {
      auth: true,
      fn: (c: ExtCtx, p: any) => riwayat(c, str(p.tab) || 'semua', str(p.from), str(p.to)),
    },
    'recon.save': {
      auth: true,
      fn: (c: ExtCtx, p: any) => {
        need(c, 'pindah_dana', 'ubah');
        const t = str(p.tanggal) || today(c);
        if (!isYmd(t) || t > today(c)) fail('VALIDATION', 'Tanggal tidak valid.');
        const input = (Array.isArray(p.rows) ? p.rows : []) as Row[];
        const rows = input.filter((r) => r.saldo_asli !== '' && r.saldo_asli != null && Number.isFinite(Number(r.saldo_asli)));
        if (!rows.length) fail('VALIDATION', 'Isi minimal satu saldo asli.');
        const akun = kasList(c, t);
        rows.forEach((r) => {
          if (!akun.some((a) => a.id === str(r.akun))) fail('VALIDATION', 'Kas / rekening tidak dikenal.');
          if (bool(r.sesuaikan)) {
            if (!RECON_REASONS[str(r.alasan)]) fail('VALIDATION', 'Pilih alasan penyesuaian.');
            if (!str(r.keterangan).trim()) fail('VALIDATION', 'Isi catatan penyesuaian.');
          }
        });
        checkPassword(c, p.password);
        return c.s.withLock(() => {
          const out = rows.map((r) => {
            const a = akun.find((x) => x.id === str(r.akun))!;
            const asli = Math.round(num(r.saldo_asli)), selisih = asli - a.saldo;
            const adj = bool(r.sesuaikan) && selisih !== 0;
            const row = c.s.insert('reconciliations', { id: newId(c.env, 'rk'), tanggal: t, akun: a.id, saldo_sistem: a.saldo, saldo_asli: asli, selisih, disesuaikan: adj,
              alasan: adj ? str(r.alasan) : '', akun_lawan: adj ? RECON_REASONS[str(r.alasan)] : '', keterangan: str(r.keterangan).slice(0, 300), ...stamp(c, true) });
            log(c, 'rekonsiliasi', 'reconciliations', str(row.id), `Rekonsiliasi ${a.nama} ${t}: sistem ${a.saldo.toLocaleString('id-ID')}, asli ${asli.toLocaleString('id-ID')}, selisih ${selisih.toLocaleString('id-ID')}${adj ? ` → disesuaikan (${r.alasan})` : ''}`, str(r.keterangan));
            return row;
          });
          emit(c, { tipe: 'rekonsiliasi', judul: `${str(c.user?.nama)} melakukan rekonsiliasi ${out.length} kas/rekening`, detail: out.filter((r) => num(r.selisih)).map((r) => `${accNames(c)[str(r.akun)] || r.akun} ${num(r.selisih) > 0 ? '+' : ''}${fmt(num(r.selisih))}`).join(', ') || 'semua cocok', scope: 'keuangan', ref_tabel: 'reconciliations' });
          return { ok: true, rows: out };
        });
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

  return { handlers, hooks, deductItem, move, productCost, buildJournal, pnl, trial, lowStock, emit, kasKecilSaldo, accNames };
}

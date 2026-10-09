/**
 * Skema semua sheet di spreadsheet database.
 * Tipe kolom: s = teks, n = angka, b = boolean, j = JSON (disimpan sebagai teks).
 * Urutan kolom = urutan header di sheet. Menambah kolom baru cukup di akhir daftar; jalankan setup() lagi untuk menambah header.
 */
export type ColType = 's' | 'n' | 'b' | 'j';
export type TableSchema = Record<string, ColType>;

const audit: TableSchema = { created_at: 's', created_by: 's', updated_at: 's', updated_by: 's' };

export const SCHEMA: Record<string, TableSchema> = {
  // ---------- Sistem ----------
  users: {
    id: 's', username: 's', nama: 's', role: 's', password_hash: 's', salt: 's', khusus_kantor: 'b',
    jam_login_dari: 's', jam_login_sampai: 's', aktif: 'b', harus_ganti_password: 'b', ...audit,
  },
  role_permissions: { role: 's', permissions: 'j', updated_at: 's', updated_by: 's' },
  devices: {
    id: 's', kode_pc: 's', nama: 's', jenis: 's', device_hash: 's', status: 's', printer_koneksi: 's', printer_alamat: 's',
    lebar_kertas: 's', laci_otomatis: 'b', disetujui_oleh: 's', last_seen: 's',
    role_izin: 's', lokasi: 's', nama_komputer: 's', versi_app: 's', ...audit,
  },
  sessions: { token_hash: 's', user_id: 's', device_id: 's', expired_at: 's', created_at: 's' },
  activity_log: { id: 's', waktu: 's', user_id: 's', user_nama: 's', aksi: 's', tabel: 's', record_id: 's', ringkasan: 's', alasan: 's' },
  settings: { key: 's', value: 's' },
  counters: { key: 's', value: 'n' },

  // ---------- Master ----------
  products: { id: 's', kode: 's', nama: 's', kategori: 's', mesin_id: 's', jenis_harga: 's', satuan: 's', aktif: 'b', ...audit },
  price_history: {
    id: 's', product_id: 's', berlaku_mulai: 's', berlaku_sampai: 's',
    rb: 'n', rb_bb: 'n', rs: 'n', rs_bb: 'n', eb: 'n', eb_bb: 'n', es: 'n', es_bb: 'n', catatan: 's', ...audit,
  },
  cost_history: { id: 's', product_id: 's', berlaku_mulai: 's', harga_beli: 'n', supplier_id: 's', sumber: 's', ...audit },
  customers: { id: 's', kode: 's', nama: 's', telp: 's', tipe: 's', alamat: 's', catatan: 's', aktif: 'b', ...audit },
  suppliers: { id: 's', nama: 's', telp: 's', bahan: 's', aktif: 'b', ...audit },
  machines: { id: 's', nama: 's', pakai_counter: 'b', aktif: 'b', ...audit },
  payment_methods: { id: 's', nama: 's', jenis: 's', rekening: 's', aktif: 'b', ...audit },

  // ---------- Transaksi (dipakai mulai Tahap 2, sheet sudah disiapkan) ----------
  orders: {
    id: 's', nomor: 's', tanggal: 's', kode_pc: 's', no_urut: 'n', customer_id: 's', cs_id: 's', total: 'n', terbayar: 'n', sisa: 'n',
    status_bayar: 's', status_ambil: 's', tgl_ambil: 's', batal: 'b', alasan_batal: 's', dibuat_offline: 'b', catatan: 's', desain: 's', janji_selesai: 's', ...audit,
  },
  order_items: {
    id: 's', order_id: 's', product_id: 's', nama_produk: 's', keterangan: 's', qty: 'n', sisi: 'n', ukuran_cutting: 'n', klik: 'n',
    tier: 's', harga_satuan: 'n', harga_beli: 'n', harga_manual: 'b', subtotal: 'n', mesin_id: 's', status_produksi: 's',
    operator_id: 's', selesai_at: 's', price_version_id: 's', ...audit,
  },
  payments: { id: 's', order_id: 's', tanggal: 's', nominal: 'n', method_id: 's', kasir_id: 's', catatan: 's', ...audit },

  // ---------- Operasional (Tahap 4) ----------
  machine_counters: {
    id: 's', tanggal: 's', mesin_id: 's', counter_awal: 'n', counter_akhir: 'n', reject_trouble: 'n', reject_operator: 'n', reject_fo: 'n', batal: 'n', keterangan: 's', ...audit,
  },
  petty_cash: { id: 's', tanggal: 's', item: 's', masuk: 'n', keluar: 'n', keterangan: 's', deleted: 'b', ...audit },
  cash_deposits: { id: 's', tanggal: 's', kasir_id: 's', method_id: 's', sistem: 'n', aktual: 'n', selisih: 'n', keterangan: 's', ...audit },

  // ---------- Keuangan (Tahap 5) ----------
  expense_categories: { id: 's', nama: 's', jenis: 's', aktif: 'b', ...audit },
  expenses: {
    id: 's', tanggal: 's', nota: 's', supplier_id: 's', kategori_id: 's', product_id: 's', item: 's', qty: 'n', satuan: 's', harga: 'n', total: 'n', isi_per_satuan: 'n',
    mesin_id: 's', cara_bayar: 's', method_id: 's', bill_id: 's', keterangan: 's', deleted: 'b', ...audit,
  },
  supplier_bills: { id: 's', tanggal: 's', nota: 's', supplier_id: 's', expense_id: 's', total: 'n', terbayar: 'n', sisa: 'n', jatuh_tempo: 's', keterangan: 's', ...audit },
  bill_payments: { id: 's', bill_id: 's', tanggal: 's', nominal: 'n', method_id: 's', keterangan: 's', ...audit },
};

export type Row = Record<string, unknown>;

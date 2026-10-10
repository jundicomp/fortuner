export type Role = 'owner' | 'admin' | 'cs' | 'kasir' | 'operator' | 'keuangan';
export const ROLES: { value: Role; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'cs', label: 'Front Office (CS)' },
  { value: 'kasir', label: 'Kasir' },
  { value: 'operator', label: 'Operator' },
  { value: 'keuangan', label: 'Keuangan' },
];

export type Op = 'lihat' | 'tambah' | 'ubah' | 'hapus' | 'ekspor';
export type PermissionMap = Record<string, Partial<Record<Op, boolean>>>;

export interface User {
  id: string;
  username: string;
  nama: string;
  role: Role;
  khusus_kantor: boolean;
  jam_login_dari: string; // "07:00" atau ""
  jam_login_sampai: string;
  aktif: boolean;
  harus_ganti_password?: boolean;
  created_at?: string;
}

export interface Session {
  token: string;
  user: User;
  permissions: PermissionMap;
  expired_at: string;
}

export type JenisHarga = 'matriks' | 'cutting' | 'tetap' | 'manual';

export interface PriceRow {
  id: string;
  product_id: string;
  berlaku_mulai: string; // YYYY-MM-DD
  berlaku_sampai: string; // "" = masih berlaku
  rb: number | null; rb_bb: number | null; rs: number | null; rs_bb: number | null;
  eb: number | null; eb_bb: number | null; es: number | null; es_bb: number | null;
  catatan: string;
  created_by?: string;
  created_at?: string;
}

export interface Product {
  id: string;
  kode: string;
  nama: string;
  kategori: string;
  mesin_id: string;
  jenis_harga: JenisHarga;
  satuan: string;
  aktif: boolean;
  kertas_sendiri?: boolean; // upah print: kertas dibawa konsumen, tidak memotong stok
  harga?: PriceRow | null; // harga yang berlaku hari ini (diisi server)
  harga_berikutnya?: PriceRow | null; // harga terjadwal (bila ada)
}

export interface Customer { id: string; kode: string; nama: string; telp: string; tipe: 'reseller' | 'enduser'; alamat: string; catatan: string; aktif: boolean; created_at?: string }
export interface Supplier { id: string; nama: string; telp: string; bahan: string; aktif: boolean }
export interface Machine { id: string; nama: string; pakai_counter: boolean; aktif: boolean; biaya_klik?: number }
export interface PaymentMethod { id: string; nama: string; jenis: 'tunai' | 'transfer' | 'edc'; rekening: string; aktif: boolean }

export interface Device {
  id: string;
  kode_pc: string;
  nama: string;
  jenis: 'desktop' | 'web';
  status: 'menunggu' | 'disetujui' | 'dicabut';
  printer_koneksi: 'usb' | 'lan' | '';
  printer_alamat: string;
  lebar_kertas: '58' | '80' | '';
  laci_otomatis: boolean;
  role_izin?: string;
  lokasi?: string;
  nama_komputer?: string;
  versi_app?: string;
  disetujui_oleh: string;
  last_seen: string;
  created_at?: string;
  is_this_device?: boolean;
}

export interface LogRow { id: string; waktu: string; user_id: string; user_nama: string; aksi: string; tabel: string; record_id: string; ringkasan: string; alasan: string }

export type Settings = Record<string, string>;

export type MasterTable = 'customers' | 'suppliers' | 'machines' | 'payment_methods';

// ---------- Tahap 2: transaksi ----------
export interface CustomerLite { id: string; kode: string; nama: string; telp: string; tipe: 'reseller' | 'enduser' }

export interface PosBootstrap {
  today: string;
  settings: Settings;
  device: { kode_pc: string; nama: string; status: string; printer_koneksi: string; printer_alamat: string; lebar_kertas: string; laci_otomatis: boolean } | null;
  counter: { key: string; value: number };
  products: Product[];
  price_rows: PriceRow[];
  customers: CustomerLite[];
  payment_methods: PaymentMethod[];
  machines: Machine[];
  can_manual: boolean;
}

export type StatusBayar = 'lunas' | 'dp' | 'belum' | 'batal';

export interface Order {
  id: string; nomor: string; tanggal: string; kode_pc: string; no_urut: number; customer_id: string; cs_id: string;
  total: number; terbayar: number; sisa: number; status_bayar: StatusBayar; status_ambil: 'belum' | 'diambil'; tgl_ambil: string;
  batal: boolean; alasan_batal: string; dibuat_offline: boolean; catatan: string; desain?: string; janji_selesai?: string; created_at: string;
  customer_nama?: string; customer_telp?: string; customer_tipe?: string; customer_kode?: string; cs_nama?: string;
  item_count?: number; ringkas?: string; produksi_selesai?: boolean;
}
export interface OrderItem {
  id: string; order_id: string; product_id: string; nama_produk: string; keterangan: string; qty: number; sisi: number; ukuran_cutting: number;
  klik: number; tier: string; harga_satuan: number; harga_beli: number | null; harga_manual: boolean; subtotal: number; mesin_id: string; mesin_nama?: string;
  status_produksi: 'antrian' | 'proses' | 'selesai' | 'batal';
  jenis_harga?: string;
}
export interface Payment { id: string; order_id: string; tanggal: string; nominal: number; method_id: string; method_nama?: string; kasir_nama?: string; catatan: string; created_at: string }
export interface OrderDetail { order: Order; items: OrderItem[]; payments: Payment[]; payment_methods?: { id: string; nama: string; jenis: string }[]; duplikat?: boolean; renomor?: boolean; nomor_awal?: string }

import { MasterPage } from './MasterPage';
import type { Customer, Machine, PaymentMethod, Supplier } from '@/types';

export function CustomersPage() {
  return (
    <MasterPage<Customer>
      table="customers" perm="master.konsumen" title="Konsumen" noun="Konsumen"
      desc="Tipe konsumen menentukan kolom harga yang dipakai di kasir: reseller atau end user."
      defaults={{ tipe: 'enduser', kode: '' }}
      cardTitle={(r) => <span>{r.nama} <span className="font-mono text-xs font-normal text-muted">#{r.kode}</span></span>}
      columns={[
        { accessorKey: 'kode', header: 'Kode', meta: { className: 'font-mono text-xs', hideOnCard: true } },
        { accessorKey: 'nama', header: 'Nama', cell: (c) => <span className="font-semibold">{c.getValue()}</span>, meta: { hideOnCard: true } },
        { accessorKey: 'telp', header: 'Telepon' },
        { accessorKey: 'tipe', header: 'Tipe', meta: { filter: 'select', filterLabel: (v) => (v === 'reseller' ? 'Reseller' : 'End user') }, cell: (c) => c.getValue() === 'reseller' ? <span className="pill pill-brand">Reseller</span> : <span className="pill pill-mute">End user</span> },
        { accessorKey: 'alamat', header: 'Alamat', meta: { hideOnCard: true } },
      ]}
      fields={[
        { key: 'nama', label: 'Nama', required: true, full: true },
        { key: 'kode', label: 'Kode', hint: 'Kosongkan untuk nomor otomatis.' },
        { key: 'tipe', label: 'Tipe harga', type: 'select', options: [{ value: 'enduser', label: 'End user' }, { value: 'reseller', label: 'Reseller' }] },
        { key: 'telp', label: 'Telepon', type: 'tel' },
        { key: 'alamat', label: 'Alamat' },
        { key: 'catatan', label: 'Catatan', type: 'textarea' },
      ]}
    />
  );
}

export function SuppliersPage() {
  return (
    <MasterPage<Supplier>
      table="suppliers" perm="master.supplier" title="Supplier" noun="Supplier" desc="Pemasok bahan. Dipakai di Pengeluaran dan Hutang Supplier."
      defaults={{}}
      columns={[
        { accessorKey: 'nama', header: 'Nama', cell: (c) => <span className="font-semibold">{c.getValue()}</span> },
        { accessorKey: 'bahan', header: 'Bahan' },
        { accessorKey: 'telp', header: 'Telepon' },
      ]}
      fields={[
        { key: 'nama', label: 'Nama', required: true, full: true },
        { key: 'bahan', label: 'Bahan yang dipasok', placeholder: 'mis. kertas, stiker' },
        { key: 'telp', label: 'Telepon', type: 'tel' },
      ]}
    />
  );
}

export function MachinesPage() {
  return (
    <MasterPage<Machine>
      table="machines" perm="master.mesin" title="Mesin" noun="Mesin"
      desc="Mesin yang nonaktif tidak muncul di pilihan produk dan antrian produksi. Counter dipakai untuk pencatatan klik harian."
      defaults={{ pakai_counter: false }}
      columns={[
        { accessorKey: 'nama', header: 'Nama', cell: (c) => <span className="font-semibold">{c.getValue()}</span> },
        { id: 'counter', accessorFn: (r) => (r.pakai_counter ? 'Ya' : 'Tidak'), header: 'Pakai counter', meta: { filter: 'select' } },
      ]}
      fields={[
        { key: 'nama', label: 'Nama mesin', required: true, full: true },
        { key: 'pakai_counter', label: 'Catat counter klik harian (versant, Mahogani, Dopo)', type: 'switch' },
      ]}
    />
  );
}

export function PaymentMethodsPage() {
  return (
    <MasterPage<PaymentMethod>
      table="payment_methods" perm="master.metode" title="Metode Bayar" noun="Metode bayar"
      desc="Pilihan pembayaran di kasir dan dasar rekap uang masuk per metode."
      defaults={{ jenis: 'transfer' }}
      columns={[
        { accessorKey: 'nama', header: 'Nama', cell: (c) => <span className="font-semibold">{c.getValue()}</span> },
        { accessorKey: 'jenis', header: 'Jenis', meta: { filter: 'select', filterLabel: (v) => ({ tunai: 'Tunai', transfer: 'Transfer', edc: 'EDC' } as Record<string, string>)[String(v)] || String(v) } },
        { accessorKey: 'rekening', header: 'Rekening' },
      ]}
      fields={[
        { key: 'nama', label: 'Nama', required: true },
        { key: 'jenis', label: 'Jenis', type: 'select', options: [{ value: 'tunai', label: 'Tunai' }, { value: 'transfer', label: 'Transfer' }, { value: 'edc', label: 'EDC' }] },
        { key: 'rekening', label: 'No. rekening / keterangan', full: true },
      ]}
    />
  );
}

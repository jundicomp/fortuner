import { useState } from 'react';
import { Upload } from 'lucide-react';
import { MasterPage } from './MasterPage';
import { CustomerImport } from './CustomerImport';
import { useAuth } from '@/auth/AuthContext';
import { nf } from '@/lib/format';
import type { Customer, Machine, PaymentMethod, Supplier } from '@/types';

const jenisLabel = (t?: string) => (t === 'reseller' ? 'Percetakan' : 'End user');

export function CustomersPage() {
  const { can } = useAuth();
  const [importing, setImporting] = useState(false);
  return (
    <>
      <MasterPage<Customer>
        table="customers" perm="master.konsumen" title="Konsumen" noun="Konsumen"
        desc="Jenis konsumen menentukan harga di kasir: Percetakan memakai harga reseller, End user memakai harga end user."
        defaults={{ tipe: 'enduser', kode: '', percetakan: '' }}
        actions={can('master.konsumen', 'tambah') && can('master.konsumen', 'ubah') && <button className="btn" onClick={() => setImporting(true)}><Upload size={16} />Import Excel</button>}
        cardTitle={(r) => <span>{r.nama} <span className="font-mono text-xs font-normal text-muted">#{r.kode}</span></span>}
        columns={[
          { accessorKey: 'kode', header: 'Kode', meta: { className: 'font-mono text-xs', hideOnCard: true } },
          { accessorKey: 'nama', header: 'Nama', cell: (c) => <span className="font-semibold">{c.getValue()}</span>, meta: { hideOnCard: true } },
          {
            id: 'jenis', accessorFn: (r) => jenisLabel(r.tipe), header: 'Jenis', meta: { filter: 'select' },
            cell: (c) => c.row.original.tipe === 'reseller' ? <span className="pill pill-brand">Percetakan</span> : <span className="pill pill-mute">End user</span>,
          },
          { accessorKey: 'percetakan', header: 'Nama percetakan', cell: (c) => c.getValue() || <span className="text-muted">–</span> },
          { accessorKey: 'telp', header: 'Telepon' },
          { accessorKey: 'alamat', header: 'Alamat', meta: { hideOnCard: true } },
        ]}
        fields={[
          { key: 'kode', label: 'Kode', type: 'info', render: (r) => r.kode ? <span className="font-mono">{String(r.kode)}</span> : 'Dibuat otomatis oleh sistem' },
          { key: 'nama', label: 'Nama', required: true },
          { key: 'tipe', label: 'Jenis konsumen', type: 'choice', required: true, options: [{ value: 'reseller', label: 'Percetakan' }, { value: 'enduser', label: 'End user' }] },
          { key: 'percetakan', label: 'Nama percetakan', required: true, show: (r) => r.tipe === 'reseller', placeholder: 'mis. Percetakan Cahaya Ilmu' },
          { key: 'tipe_harga', label: 'Tipe harga', type: 'info', render: (r) => r.tipe === 'reseller' ? 'Harga reseller (rb / rs)' : 'Harga end user (eb / es)', hint: 'Otomatis mengikuti jenis konsumen.' },
          { key: 'telp', label: 'Telepon', type: 'tel', required: true },
          { key: 'alamat', label: 'Alamat' },
          { key: 'catatan', label: 'Catatan', type: 'textarea' },
        ]}
      />
      {importing && <CustomerImport onClose={() => setImporting(false)} />}
    </>
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
        { accessorKey: 'biaya_klik', header: 'Biaya per klik', meta: { align: 'right' }, cell: (c) => (Number(c.getValue()) ? <span className="num">{nf(Number(c.getValue()))}</span> : <span className="text-muted">–</span>) },
      ]}
      fields={[
        { key: 'nama', label: 'Nama mesin', required: true, full: true },
        { key: 'biaya_klik', label: 'Biaya per klik (Rp)', type: 'number', hint: 'Tarif klik/sewa mesin per lembar cetak per sisi. Masuk ke HPP produk. Kosongkan bila tidak ada.' },
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

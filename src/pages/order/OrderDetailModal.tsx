import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CloudOff, HandCoins, PackageCheck, Printer, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ErrorBox, Field } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { printReceipt, type ReceiptShop } from '@/components/Receipt';
import { drawerForCash, paperWidth } from '@/platform/printer';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { newClientId, posCache } from '@/lib/offline';
import { useSettings } from '@/lib/queries';
import { CUT_SIZES } from '@/lib/pricing';
import { nf, rp, tgl, tglJam } from '@/lib/format';
import type { OrderDetail } from '@/types';

export const BAYAR: Record<string, [string, string]> = { lunas: ['Lunas', 'pill-ok'], dp: ['DP', 'pill-warn'], belum: ['Belum bayar', 'pill-bad'], batal: ['Batal', 'pill-mute'] };
export const PRODUKSI: Record<string, [string, string]> = { antrian: ['Antrian', 'pill-brand'], proses: ['Proses', 'pill-warn'], selesai: ['Selesai', 'pill-ok'], batal: ['Batal', 'pill-mute'] };
const numIn = (s: string) => Number(String(s).replace(/[^\d]/g, '')) || 0;

export function OrderDetailModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const settings = useSettings();
  const q = useQuery({ queryKey: ['order', orderId], queryFn: () => api<OrderDetail>('orders.get', { order_id: orderId }) });
  const [panel, setPanel] = useState<'' | 'bayar' | 'ambil' | 'batal'>('');
  const [nominalIn, setNominalIn] = useState('');
  const [diterimaIn, setDiterimaIn] = useState('');
  const [methodId, setMethodId] = useState('');
  const [alasan, setAlasan] = useState('');
  const [payId] = useState(() => newClientId('pmt'));

  const methodList = q.data?.payment_methods || [];
  const after = (msg: string) => { qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast(msg); setPanel(''); setAlasan(''); };
  const setData = (d: OrderDetail) => qc.setQueryData(['order', orderId], d);

  const pay = useMutation({
    mutationFn: () => api<OrderDetail>('orders.pay', { order_id: orderId, payment_id: payId, nominal: numIn(nominalIn), method_id: methodId }),
    onSuccess: (d) => { setData(d); if (isTunai) drawerForCash(); after(d.order.sisa <= 0 ? 'Nota lunas' : 'Pembayaran dicatat'); },
  });
  const ambil = useMutation({
    mutationFn: (diambil: boolean) => api<OrderDetail>('orders.ambil', { order_id: orderId, diambil, alasan }),
    onSuccess: (d) => { setData(d); after(d.order.status_ambil === 'diambil' ? 'Ditandai sudah diambil' : 'Status diambil dibatalkan'); },
  });
  const cancel = useMutation({
    mutationFn: () => api<OrderDetail>('orders.cancel', { order_id: orderId, alasan }),
    onSuccess: (d) => { setData(d); after('Nota dibatalkan'); },
  });

  const d = q.data;
  const o = d?.order;
  const isTunai = methodList.find((m) => m.id === methodId)?.jenis === 'tunai';
  const nominal = numIn(nominalIn);
  const kembali = isTunai && numIn(diterimaIn) > nominal ? numIn(diterimaIn) - nominal : 0;
  const shop: ReceiptShop = { nama: settings.data?.nama_usaha || 'Fortuner', alamat: settings.data?.alamat, telp: settings.data?.telp, catatan: settings.data?.catatan_struk };
  const width = paperWidth(posCache.get()?.device?.lebar_kertas);

  const reprint = () => {
    if (!d || !o) return;
    printReceipt({
      nomor: o.nomor, waktu: o.created_at, customer: o.customer_nama || '', cs: (o.cs_nama || '').split(' ')[0], ulang: true, catatan: o.catatan, offline: o.dibuat_offline,
      items: d.items.map((i) => ({ nama: i.nama_produk, keterangan: i.keterangan, qty: i.qty, sisi: i.sisi, ukuran: i.jenis_harga === 'cutting' ? i.ukuran_cutting : null, harga: i.harga_satuan, subtotal: i.subtotal })),
      total: o.total, payments: d.payments.map((p) => ({ label: `${tgl(p.tanggal)} ${p.method_nama}`, nominal: p.nominal })), sisa: Math.max(0, o.sisa),
    }, shop, width);
  };

  return (
    <Modal open onClose={onClose} size="lg"
      title={o ? <span className="font-mono">{o.nomor}</span> : 'Memuat nota…'}
      subtitle={o ? <>{tglJam(o.created_at)} · {o.customer_nama} ({o.customer_tipe === 'reseller' ? 'reseller' : 'end user'}) · CS {o.cs_nama}</> : undefined}>
      {q.isLoading && <p className="text-sm text-muted">Memuat…</p>}
      <ErrorBox error={q.error} />
      {d && o && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            <span className={`pill ${BAYAR[o.status_bayar]?.[1]}`}>{BAYAR[o.status_bayar]?.[0]}</span>
            <span className={`pill ${o.status_ambil === 'diambil' ? 'pill-ok' : 'pill-mute'}`}>{o.status_ambil === 'diambil' ? `Diambil ${tglJam(o.tgl_ambil)}` : 'Belum diambil'}</span>
            {o.dibuat_offline && <span className="pill pill-warn"><CloudOff size={11} />Dibuat offline</span>}
            {o.batal && <span className="pill pill-bad">Dibatalkan: {o.alasan_batal}</span>}
          </div>
          {(o.catatan || o.desain || o.janji_selesai) && (
            <div className="flex flex-col gap-1 rounded-lg bg-sunk px-3 py-2 text-sm">
              {o.desain && <div><span className="text-muted">File desain:</span> {o.desain}</div>}
              {o.janji_selesai && <div><span className="text-muted">Janji selesai:</span> {tglJam(o.janji_selesai)}</div>}
              {o.catatan && <div><span className="text-muted">Catatan:</span> {o.catatan}</div>}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="tbl w-full min-w-[560px] text-[13px]">
              <thead><tr className="bg-sunk text-[11px] uppercase tracking-wider text-muted">
                <th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-right">Jml</th><th className="px-3 py-2 text-right">Harga</th><th className="px-3 py-2 text-right">Subtotal</th><th className="px-3 py-2 text-left">Produksi</th>
              </tr></thead>
              <tbody>
                {d.items.map((i) => (
                  <tr key={i.id} className="border-t border-line">
                    <td className="px-3 py-2">
                      <div className="font-semibold">{i.nama_produk}{i.sisi === 2 ? ' · BB' : ''}{i.jenis_harga === 'cutting' ? ` · ${CUT_SIZES[i.ukuran_cutting]}` : ''}</div>
                      <div className="text-xs text-muted">{[i.keterangan, i.mesin_nama, i.harga_manual ? 'harga manual' : ''].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="num px-3 py-2 text-right">{nf(i.qty)}</td>
                    <td className="num px-3 py-2 text-right">{nf(i.harga_satuan)}</td>
                    <td className="num px-3 py-2 text-right font-semibold">{nf(i.subtotal)}</td>
                    <td className="px-3 py-2"><span className={`pill ${PRODUKSI[i.status_produksi]?.[1]}`}>{PRODUKSI[i.status_produksi]?.[0]}</span></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink/70 font-bold"><td className="px-3 py-2" colSpan={3}>Total</td><td className="num px-3 py-2 text-right">{nf(o.total)}</td><td /></tr>
                <tr><td className="px-3 py-1 text-muted" colSpan={3}>Terbayar</td><td className="num px-3 py-1 text-right">{nf(o.terbayar)}</td><td /></tr>
                <tr className="font-bold"><td className="px-3 py-1.5" colSpan={3}>{o.sisa < 0 ? 'Lebih bayar' : 'Sisa'}</td><td className={`num px-3 py-1.5 text-right ${o.sisa > 0 ? 'text-bad' : o.sisa < 0 ? 'text-warn' : 'text-ok'}`}>{nf(Math.abs(o.sisa))}</td><td /></tr>
              </tfoot>
            </table>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold">Pembayaran</h3>
            {!d.payments.length ? <p className="text-sm text-muted">Belum ada pembayaran.</p> : (
              <ul className="divide-y divide-line rounded-xl border border-line text-sm">
                {d.payments.map((p, i) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                    <span className="num w-5 text-muted">{i + 1}</span><span className="num">{tgl(p.tanggal)}</span><span className="font-semibold">{p.method_nama}</span>
                    <span className="text-xs text-muted">{p.kasir_nama}{p.catatan ? ` · ${p.catatan}` : ''}</span><span className="num ml-auto font-bold">{rp(p.nominal)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {panel === 'bayar' && (
            <section className="rounded-xl border border-brand/40 bg-brand/5 p-4">
              <h3 className="mb-3 text-sm font-bold">Catat pembayaran</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label={`Nominal (sisa ${nf(o.sisa)})`}><input id="od-nominal" className="input num text-right" inputMode="numeric" value={nominalIn ? nf(numIn(nominalIn)) : ''} onChange={(e) => setNominalIn(e.target.value)} /></Field>
                <Field label="Metode"><select id="od-metode" className="input" value={methodId} onChange={(e) => setMethodId(e.target.value)}><option value="">– pilih –</option>{methodList.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}</select></Field>
                {isTunai && <Field label="Uang diterima" hint={kembali ? `Kembalian ${rp(kembali)}` : undefined}><input id="od-diterima" className="input num text-right" inputMode="numeric" value={diterimaIn ? nf(numIn(diterimaIn)) : ''} onChange={(e) => setDiterimaIn(e.target.value)} /></Field>}
              </div>
              <div className="mt-3"><ErrorBox error={pay.error} /></div>
              <div className="mt-3 flex justify-end gap-2"><button className="btn" onClick={() => setPanel('')}>Batal</button><button className="btn btn-primary" disabled={!nominal || !methodId || pay.isPending} onClick={() => pay.mutate()}>Simpan pembayaran</button></div>
            </section>
          )}
          {panel === 'ambil' && (
            <section className="rounded-xl border border-warn/40 bg-warn/5 p-4">
              <h3 className="text-sm font-bold">Serahkan barang padahal belum lunas?</h3>
              <p className="mt-1 text-sm text-muted">Sisa {rp(o.sisa)} tetap tercatat sebagai piutang. Isi alasan untuk log.</p>
              <input id="od-alasan-ambil" className="input mt-3" value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="mis. pelanggan tetap, bayar akhir bulan" />
              <div className="mt-3"><ErrorBox error={ambil.error} /></div>
              <div className="mt-3 flex justify-end gap-2"><button className="btn" onClick={() => setPanel('')}>Batal</button><button className="btn btn-primary" disabled={!alasan.trim() || ambil.isPending} onClick={() => ambil.mutate(true)}>Tandai diambil</button></div>
            </section>
          )}
          {panel === 'batal' && (
            <section className="rounded-xl border border-bad/40 bg-bad/5 p-4">
              <h3 className="text-sm font-bold text-bad">Batalkan nota {o.nomor}?</h3>
              <p className="mt-1 text-sm text-muted">Nota tetap tersimpan dengan status batal dan tidak dihitung di omzet maupun piutang.</p>
              <input id="od-alasan-batal" className="input mt-3" value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Alasan pembatalan" />
              <div className="mt-3"><ErrorBox error={cancel.error} /></div>
              <div className="mt-3 flex justify-end gap-2"><button className="btn" onClick={() => setPanel('')}>Kembali</button><button className="btn btn-danger" disabled={!alasan.trim() || cancel.isPending} onClick={() => cancel.mutate()}>Batalkan nota</button></div>
            </section>
          )}

          {!panel && (
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              {!o.batal && o.sisa > 0 && (can('kasir', 'tambah') || can('order', 'ubah') || can('piutang', 'ubah')) && (
                <button className="btn btn-primary" onClick={() => { pay.reset(); setNominalIn(String(o.sisa)); setDiterimaIn(''); setMethodId(methodList.find((m) => m.jenis === 'tunai')?.id || ''); setPanel('bayar'); }}><HandCoins size={16} />Bayar</button>
              )}
              {!o.batal && can('order', 'ubah') && (o.status_ambil === 'diambil'
                ? <button className="btn" disabled={ambil.isPending} onClick={() => ambil.mutate(false)}><Undo2 size={16} />Batal diambil</button>
                : <button className="btn" disabled={ambil.isPending} onClick={() => { ambil.reset(); setAlasan(''); if (o.sisa > 0) setPanel('ambil'); else ambil.mutate(true); }}><PackageCheck size={16} />Tandai diambil</button>)}
              <button className="btn" onClick={reprint}><Printer size={16} />Cetak ulang</button>
              {!o.batal && can('order', 'hapus') && <button className="btn btn-ghost ml-auto text-bad" onClick={() => { cancel.reset(); setAlasan(''); setPanel('batal'); }}><Ban size={16} />Batalkan</button>}
            </div>
          )}
          <ErrorBox error={!panel ? ambil.error : null} />
        </div>
      )}
    </Modal>
  );
}

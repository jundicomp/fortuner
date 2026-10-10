import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/table/DataTable';
import { DateRangeFilter, periodeLabel, rangeFor, type DateRange } from '@/components/table/DateRangeFilter';
import { ErrorBox, Field, PageHeader } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { addDays, nf, rp, tgl, ymd } from '@/lib/format';
import { dec, numIn, useStockMeta, type Purchase, type StockMeta } from './stokApi';
import { Money } from '@/components/ui/Money';

export const usePurchases = (from = '', to = '', enabled = true) => useQuery({ queryKey: ['purchases', from, to], queryFn: () => api<Purchase[]>('purchase.list', { from, to }), enabled });

/** Isian terakhir per bahan (satuan beli, isi, harga) supaya form pembelian berikutnya terisi otomatis. */
export function lastBuy(list: Purchase[] | undefined) {
  const m: Record<string, { satuan_beli: string; isi: number; harga_beli: number; supplier_id: string }> = {};
  [...(list || [])].sort((a, b) => a.tanggal.localeCompare(b.tanggal)).forEach((p) => p.items.forEach((i) => { m[i.material_id] = { satuan_beli: i.satuan_beli, isi: i.isi, harga_beli: i.harga_beli, supplier_id: p.supplier_id }; }));
  return m;
}

/** Pembelian bahan baku: menambah stok, memperbarui harga rata-rata, dan tercatat sebagai pengeluaran (lunas) atau hutang supplier (tempo). */
export function PembelianPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const meta = useStockMeta();
  const [range, setRange] = useState<DateRange>(rangeFor('bulan_ini'));
  const q = usePurchases(range.from, range.to);
  const all = usePurchases();
  const [form, setForm] = useState(false);
  const [view, setView] = useState<Purchase | null>(null);
  const [del, setDel] = useState<Purchase | null>(null);
  const [alasan, setAlasan] = useState('');
  const remove = useMutation({
    mutationFn: () => api('purchase.delete', { id: del!.id, alasan }),
    onSuccess: () => { ['purchases', 'stock-meta', 'expenses', 'bills', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast('Pembelian dihapus, stok dikoreksi'); setDel(null); setView(null); setAlasan(''); },
  });
  const rows = useMemo(() => [...(q.data || [])].sort((a, b) => (b.tanggal + b.created_at).localeCompare(a.tanggal + a.created_at)), [q.data]);
  const total = rows.reduce((a, r) => a + r.total, 0);
  const tempo = rows.filter((r) => r.cara_bayar === 'hutang');

  const cols: ColumnDef<Purchase, any>[] = [
    { accessorKey: 'tanggal', header: 'Tanggal', cell: (c) => <span className="num whitespace-nowrap">{tgl(c.getValue())}</span> },
    { accessorKey: 'nota', header: 'Nota', meta: { className: 'font-mono text-xs' } },
    { accessorKey: 'supplier', header: 'Supplier', meta: { filter: 'select' } },
    { id: 'bahan', accessorFn: (r) => r.items.map((i) => `${i.nama} ${dec(i.qty_beli)} ${i.satuan_beli}`).join(', '), header: 'Bahan', cell: (c) => <span className="text-xs">{c.getValue()}</span> },
    { accessorKey: 'total', header: 'Total', meta: { align: 'right', total: true, money: true }, cell: (c) => <b className="num">{nf(c.getValue())}</b> },
    { id: 'bayar', accessorFn: (r) => (r.cara_bayar === 'hutang' ? 'Tempo' : r.metode), header: 'Bayar', meta: { filter: 'select' },
      cell: (c) => c.row.original.cara_bayar === 'hutang'
        ? <span className={`pill ${c.row.original.sisa_hutang > 0 ? 'pill-warn' : 'pill-ok'}`}>{c.row.original.sisa_hutang > 0 ? `Tempo · sisa ${nf(c.row.original.sisa_hutang)}` : 'Tempo lunas'}</span>
        : <span className="text-xs">{c.getValue()}</span> },
    { accessorKey: 'oleh', header: 'Dicatat', meta: { filter: 'select', hideOnCard: true } },
  ];

  return (
    <>
      <PageHeader title="Pembelian Bahan" desc="Setiap pembelian menambah stok bahan, memperbarui harga rata-rata, dan otomatis tercatat di Pengeluaran (lunas) atau Hutang Supplier (tempo)."
        actions={can('pembelian', 'tambah') && <button id="pur-new" className="btn btn-primary" onClick={() => setForm(true)} disabled={!meta.data}><Plus size={16} />Catat pembelian</button>} />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <section className="card tint tint-orange p-4"><div className="text-xs font-bold uppercase tracking-wider text-muted">Total pembelian</div><div className="num mt-1 text-2xl font-extrabold">{rp(total)}</div><div className="text-xs text-muted">{rows.length} nota</div></section>
        <section className="card tint tint-amber p-4"><div className="text-xs font-bold uppercase tracking-wider text-muted">Tempo / hutang</div><div className="num mt-1 text-lg font-bold">{rp(tempo.reduce((a, r) => a + r.total, 0))}</div><div className="text-xs text-muted">sisa belum dibayar {rp(tempo.reduce((a, r) => a + r.sisa_hutang, 0))}</div></section>
        <section className="card tint tint-teal p-4"><div className="text-xs font-bold uppercase tracking-wider text-muted">Bahan terbanyak dibeli</div>
          <ul className="mt-1.5 flex flex-col gap-1 text-sm">{topBahan(rows).map(([n, v]) => <li key={n} className="flex justify-between gap-2"><span className="truncate">{n}</span><span className="num font-semibold">{nf(v)}</span></li>)}{!rows.length && <li className="text-muted">–</li>}</ul>
        </section>
      </div>
      <DataTable<Purchase> data={rows} loading={q.isLoading} columns={cols} title="Pembelian bahan" storageKey="pembelian" canExport={can('pembelian', 'ekspor')} onRowClick={setView}
        exportSubtitle={periodeLabel(range.from, range.to)} toolbar={<DateRangeFilter value={range} onChange={setRange} id="pur-range" />} searchPlaceholder="Cari nota, supplier, bahan…"
        cardTitle={(r) => <span className="flex justify-between gap-2"><span>{r.supplier || 'Tanpa supplier'}</span><span className="num text-sm">{tgl(r.tanggal)}</span></span>} emptyText="Belum ada pembelian di periode ini." />
      {form && meta.data && <PurchaseForm meta={meta.data} last={lastBuy(all.data)} onClose={() => setForm(false)} />}
      {view && (
        <Modal open onClose={() => setView(null)} title={`Pembelian ${view.nota || ''}`.trim()} subtitle={`${tgl(view.tanggal)} · ${view.supplier || 'tanpa supplier'} · ${view.cara_bayar === 'hutang' ? `tempo s/d ${tgl(view.jatuh_tempo)}` : view.metode}`}
          footer={<>{can('pembelian', 'hapus') && <button className="btn btn-ghost mr-auto text-bad" onClick={() => setDel(view)}><Trash2 size={15} />Hapus</button>}<button className="btn" onClick={() => setView(null)}>Tutup</button></>}>
          <table className="tbl w-full text-sm">
            <thead className="text-left text-xs text-muted"><tr><th className="py-1">Bahan</th><th className="text-right">Beli</th><th className="text-right">Harga</th><th className="text-right">Masuk stok</th><th className="text-right">Subtotal</th></tr></thead>
            <tbody className="divide-y divide-line">{view.items.map((i) => (
              <tr key={i.id}><td className="py-1.5 font-semibold">{i.nama}</td><td className="num text-right">{dec(i.qty_beli)} {i.satuan_beli}</td><td className="num text-right"><Money v={i.harga_beli} /></td>
                <td className="num text-right">{dec(i.qty_stok)} {i.satuan}<span className="block text-[11px] text-muted">@ {dec(i.harga_stok)}</span></td><td className="num text-right font-semibold"><Money v={i.subtotal} /></td></tr>
            ))}</tbody>
            <tfoot><tr className="border-t-2 border-line font-bold"><td colSpan={4} className="py-2">Total</td><td className="num text-right"><Money v={view.total} /></td></tr></tfoot>
          </table>
          {view.keterangan && <p className="mt-3 text-sm text-muted">{view.keterangan}</p>}
        </Modal>
      )}
      <Modal open={!!del} onClose={() => setDel(null)} size="sm" title="Hapus pembelian?" subtitle={del ? `${del.nota || del.supplier} · ${rp(del.total)} · ${tgl(del.tanggal)}` : undefined}
        footer={<><button className="btn" onClick={() => setDel(null)}>Batal</button><button id="pur-del-ok" className="btn btn-danger" disabled={!alasan.trim() || remove.isPending} onClick={() => remove.mutate()}>Hapus</button></>}>
        <p className="mb-3 text-sm text-muted">Stok bahan dikurangi kembali, pengeluaran dan tagihan hutangnya ikut dihapus. Tidak bisa bila hutangnya sudah dicicil.</p>
        <Field label="Alasan (tercatat di log)"><input id="pur-alasan" className="input" value={alasan} onChange={(e) => setAlasan(e.target.value)} /></Field>
        <div className="mt-3"><ErrorBox error={remove.error} /></div>
      </Modal>
    </>
  );
}

function topBahan(rows: Purchase[]) {
  const m: Record<string, number> = {};
  rows.forEach((p) => p.items.forEach((i) => { m[i.nama] = (m[i.nama] || 0) + i.subtotal; }));
  return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 4);
}

interface Line { key: number; material_id: string; qty_beli: string; satuan_beli: string; isi: string; harga_beli: string }

/** Form pembelian banyak bahan sekaligus. `initial` dipakai dari Daftar Belanja. */
export function PurchaseForm({ meta, last, initial, onClose }: { meta: StockMeta; last: ReturnType<typeof lastBuy>; initial?: { material_id: string; qty_stok: number }[]; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const mats = meta.materials.filter((m) => m.aktif);
  const byId = Object.fromEntries(meta.materials.map((m) => [m.id, m]));
  let seq = 0;
  const lineFor = (material_id: string, qtyStok = 0): Line => {
    const l = last[material_id];
    const isi = l?.isi || 1;
    return { key: ++seq + Math.random(), material_id, satuan_beli: l?.satuan_beli || byId[material_id]?.satuan || '', isi: String(isi), harga_beli: l ? String(l.harga_beli) : byId[material_id]?.harga_terakhir ? String(Math.round(byId[material_id].harga_terakhir)) : '', qty_beli: qtyStok ? String(Math.max(1, Math.ceil(qtyStok / isi))) : '1' };
  };
  const firstSup = initial?.length ? last[initial[0].material_id]?.supplier_id || '' : '';
  const [f, setF] = useState({
    tanggal: ymd(), nota: '', supplier_id: firstSup, cara_bayar: 'lunas' as 'lunas' | 'hutang',
    method_id: meta.payment_methods.find((m) => m.jenis === 'tunai')?.id || meta.payment_methods[0]?.id || '', jatuh_tempo: addDays(ymd(), 30), keterangan: '',
  });
  const [lines, setLines] = useState<Line[]>(() => (initial?.length ? initial.map((i) => lineFor(i.material_id, i.qty_stok)) : [{ key: 0, material_id: '', qty_beli: '1', satuan_beli: '', isi: '1', harga_beli: '' }]));
  const setLine = (k: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...patch } : l)));
  const calc = lines.map((l) => { const q = numIn(l.qty_beli), h = numIn(l.harga_beli), isi = numIn(l.isi) || 1; return { q, h, isi, sub: Math.round(q * h), stok: q * isi, hs: h / isi }; });
  const total = calc.reduce((a, c) => a + c.sub, 0);
  const valid = lines.length > 0 && lines.every((l, i) => l.material_id && calc[i].q > 0 && calc[i].h > 0) && (f.cara_bayar === 'lunas' ? !!f.method_id : !!f.supplier_id);
  const save = useMutation({
    mutationFn: () => api<{ total: number }>('purchase.save', { purchase: { ...f, items: lines.map((l, i) => ({ material_id: l.material_id, qty_beli: calc[i].q, satuan_beli: l.satuan_beli, isi: calc[i].isi, harga_beli: calc[i].h })) } }),
    onSuccess: (r) => { ['purchases', 'stock-meta', 'expenses', 'bills', 'dashboard', 'stock-card'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast(`Pembelian ${rp(r.total)} tercatat, stok bertambah`); onClose(); },
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  return (
    <Modal open onClose={onClose} size="xl" title="Catat pembelian bahan" subtitle="Isi per satuan beli: berapa lembar/meter dalam 1 rim/pack/roll. Stok bertambah sesuai jumlah × isi."
      footer={<><button className="btn" onClick={onClose}>Batal</button><button id="pur-save" className="btn btn-primary" disabled={!valid || save.isPending} onClick={() => save.mutate()}>Simpan {total ? rp(total) : ''}</button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
        <Field label="Tanggal" className="sm:col-span-2"><input id="pur-tanggal" type="date" className="input" max={ymd()} value={f.tanggal} onChange={(e) => set('tanggal', e.target.value)} /></Field>
        <Field label="Supplier" className="sm:col-span-2">
          <select id="pur-supplier" className="input" value={f.supplier_id} onChange={(e) => set('supplier_id', e.target.value)}><option value="">– tanpa supplier –</option>{meta.suppliers.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}</select>
        </Field>
        <Field label="No. nota supplier" className="sm:col-span-2"><input id="pur-nota" className="input" value={f.nota} onChange={(e) => set('nota', e.target.value)} /></Field>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-line">
        <table className="tbl w-full min-w-[720px] text-sm">
          <thead className="bg-sunk text-left text-xs text-muted">
            <tr><th className="px-2 py-2">Bahan</th><th className="w-20 px-2 text-right">Jumlah</th><th className="w-24 px-2">Satuan beli</th><th className="w-20 px-2 text-right">Isi</th><th className="w-32 px-2 text-right">Harga / satuan</th><th className="w-36 px-2 text-right">Masuk stok</th><th className="w-28 px-2 text-right">Subtotal</th><th className="w-8" /></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lines.map((l, i) => {
              const m = byId[l.material_id];
              return (
                <tr key={l.key}>
                  <td className="px-2 py-1.5">
                    <select id={`pur-mat-${i}`} className="input min-w-[170px]" value={l.material_id} onChange={(e) => { const nl = lineFor(e.target.value); setLine(l.key, { material_id: e.target.value, satuan_beli: nl.satuan_beli, isi: nl.isi, harga_beli: nl.harga_beli }); if (!f.supplier_id && last[e.target.value]?.supplier_id) set('supplier_id', last[e.target.value].supplier_id); }}>
                      <option value="">– pilih bahan –</option>{mats.map((x) => <option key={x.id} value={x.id} disabled={lines.some((o) => o.key !== l.key && o.material_id === x.id)}>{x.nama}</option>)}
                    </select>
                  </td>
                  <td className="px-2"><input id={`pur-qty-${i}`} className="input num text-right" inputMode="decimal" value={l.qty_beli} onChange={(e) => setLine(l.key, { qty_beli: e.target.value })} /></td>
                  <td className="px-2"><input id={`pur-sat-${i}`} className="input" value={l.satuan_beli} placeholder="rim" onChange={(e) => setLine(l.key, { satuan_beli: e.target.value })} /></td>
                  <td className="px-2"><input id={`pur-isi-${i}`} className="input num text-right" inputMode="decimal" value={l.isi} onChange={(e) => setLine(l.key, { isi: e.target.value })} title={`Isi ${m?.satuan || 'satuan stok'} per ${l.satuan_beli || 'satuan beli'}`} /></td>
                  <td className="px-2"><input id={`pur-harga-${i}`} className="input num text-right" inputMode="numeric" value={l.harga_beli ? nf(numIn(l.harga_beli)) : ''} onChange={(e) => setLine(l.key, { harga_beli: e.target.value })} /></td>
                  <td className="num px-2 text-right text-xs" title={m?.harga_rata ? `Harga rata-rata sekarang ${dec(m.harga_rata)} per ${m.satuan}` : undefined}>{m ? <>{dec(calc[i].stok)} {m.satuan}<span className="block text-muted">@ {dec(calc[i].hs)}</span></> : '–'}</td>
                  <td className="num px-2 text-right font-semibold"><Money v={calc[i].sub} /></td>
                  <td className="px-1">{lines.length > 1 && <button className="btn btn-ghost btn-sm px-1" aria-label="Hapus baris" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}><X size={14} /></button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button id="pur-add-line" className="btn btn-sm mt-2" onClick={() => setLines((ls) => [...ls, { key: Date.now(), material_id: '', qty_beli: '1', satuan_beli: '', isi: '1', harga_beli: '' }])}><Plus size={14} />Tambah bahan</button>
      {!mats.length && <p className="mt-2 text-sm text-warn">Belum ada bahan. Tambahkan dulu di menu Stok Bahan.</p>}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-6">
        <div className="flex gap-2 sm:col-span-6" role="group" aria-label="Cara bayar">
          {(['lunas', 'hutang'] as const).map((k) => (
            <button key={k} id={`pur-cara-${k}`} type="button" onClick={() => set('cara_bayar', k)} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${f.cara_bayar === k ? 'border-brand bg-brand text-brand-ink' : 'border-line hover:border-muted'}`}>{k === 'lunas' ? 'Dibayar lunas' : 'Tempo / hutang'}</button>
          ))}
        </div>
        {f.cara_bayar === 'lunas' ? (
          <Field label="Dibayar dengan" className="sm:col-span-3"><select id="pur-metode" className="input" value={f.method_id} onChange={(e) => set('method_id', e.target.value)}>{meta.payment_methods.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}</select></Field>
        ) : (
          <Field label="Jatuh tempo" className="sm:col-span-3" hint={!f.supplier_id ? <span className="text-warn">Pembelian tempo wajib memilih supplier.</span> : 'Masuk ke Hutang Supplier.'}><input id="pur-jt" type="date" className="input" value={f.jatuh_tempo} onChange={(e) => set('jatuh_tempo', e.target.value)} /></Field>
        )}
        <Field label="Catatan" className="sm:col-span-3"><input id="pur-ket" className="input" value={f.keterangan} onChange={(e) => set('keterangan', e.target.value)} /></Field>
        <div className="flex items-baseline justify-between rounded-lg bg-sunk px-4 py-3 sm:col-span-6"><span className="text-sm font-semibold">Total</span><span className="num text-2xl font-extrabold">{rp(total)}</span></div>
        <div className="sm:col-span-6"><ErrorBox error={save.error} /></div>
      </div>
    </Modal>
  );
}

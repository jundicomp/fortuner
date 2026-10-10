import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ErrorBox } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { nf } from '@/lib/format';
import { dec, numIn, useStockMeta } from '@/pages/stok/stokApi';
import type { Product } from '@/types';

interface Cost { bahan: number; klik: number; total: number; klik_per_unit: number; tarif_klik: number; resep: boolean; rincian: { material_id: string; nama: string; satuan: string; qty: number; harga: number; nilai: number }[] }
interface Recipe { lines: { material_id: string; qty: number; per: 'unit' | 'klik' }[]; satu_sisi: Cost; bolak_balik: Cost; lihat_harga?: boolean }

/** Resep bahan per produk + perkiraan HPP (bahan + biaya klik mesin). Dipakai untuk memotong stok dan menghitung laba. */
export function RecipeTab({ product }: { product: Product }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const meta = useStockMeta();
  const q = useQuery({ queryKey: ['recipe', product.id], queryFn: () => api<Recipe>('recipe.get', { product_id: product.id }) });
  const [lines, setLines] = useState<{ material_id: string; qty: string; per: 'unit' | 'klik' }[]>([]);
  useEffect(() => { if (q.data) setLines(q.data.lines.map((l) => ({ material_id: l.material_id, qty: String(l.qty).replace('.', ','), per: l.per }))); }, [q.data]);
  const canEdit = can('master.produk', 'ubah') || can('stok', 'ubah');
  const seeCost = !!q.data?.lihat_harga;
  const save = useMutation({
    mutationFn: () => api<Recipe>('recipe.save', { product_id: product.id, lines: lines.filter((l) => l.material_id).map((l) => ({ ...l, qty: numIn(l.qty) })) }),
    onSuccess: (r) => { qc.setQueryData(['recipe', product.id], (o: Recipe | undefined) => ({ ...r, lihat_harga: o?.lihat_harga })); qc.invalidateQueries({ queryKey: ['margin'] }); toast('Resep disimpan'); },
  });
  const mats = (meta.data?.materials || []).filter((m) => m.aktif);
  const byId = Object.fromEntries((meta.data?.materials || []).map((m) => [m.id, m]));
  const matriks = product.jenis_harga === 'matriks';
  const dirty = JSON.stringify(lines.map((l) => [l.material_id, numIn(l.qty), l.per])) !== JSON.stringify((q.data?.lines || []).map((l) => [l.material_id, l.qty, l.per]));

  if (q.isLoading) return <p className="text-sm text-muted">Memuat…</p>;
  if (product.kertas_sendiri) return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-warn/40 bg-warn/5 p-4 text-sm"><b>Kertas sendiri / upah print.</b> Konsumen membawa kertasnya sendiri, jadi produk ini tidak memakai bahan dari stok. HPP-nya hanya biaya klik mesin. Untuk mengubahnya, matikan pilihan "Kertas sendiri" di tab Data produk.</div>
      {seeCost && q.data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CostCard title={matriks ? 'HPP 1 sisi' : 'HPP per unit'} c={q.data.satu_sisi} />
          {matriks && <CostCard title="HPP bolak-balik" c={q.data.bolak_balik} />}
        </div>
      )}
    </div>
  );
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">Bahan yang terpakai untuk <b className="text-ink">1 {product.satuan || 'lembar'}</b> produk ini. Saat item selesai (atau dibayar, sesuai pengaturan) stok bahan dipotong otomatis dan HPP nota dihitung dari harga rata-rata bahan + biaya klik mesin.</p>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-sunk text-left text-xs text-muted"><tr><th className="px-3 py-2">Bahan</th><th className="w-28 px-2 text-right">Pemakaian</th><th className="w-40 px-2">Dihitung per</th>{seeCost && <th className="px-2 text-right">Harga rata2</th>}<th className="w-8" /></tr></thead>
          <tbody className="divide-y divide-line">
            {lines.map((l, i) => {
              const m = byId[l.material_id];
              return (
                <tr key={i}>
                  <td className="px-3 py-1.5">
                    {canEdit ? <select id={`rcp-mat-${i}`} className="input" value={l.material_id} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, material_id: e.target.value } : x)))}>
                      <option value="">– pilih bahan –</option>{mats.map((x) => <option key={x.id} value={x.id} disabled={lines.some((o, j) => j !== i && o.material_id === x.id)}>{x.nama}</option>)}
                    </select> : <b>{m?.nama}</b>}
                  </td>
                  <td className="px-2"><span className="flex items-center gap-1"><input id={`rcp-qty-${i}`} className="input num text-right" inputMode="decimal" disabled={!canEdit} value={l.qty} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} /><span className="text-xs text-muted">{m?.satuan}</span></span></td>
                  <td className="px-2">
                    <select id={`rcp-per-${i}`} className="input" disabled={!canEdit} value={l.per} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, per: e.target.value as 'unit' | 'klik' } : x)))}>
                      <option value="unit">per {product.satuan || 'lembar'} jadi</option><option value="klik">per klik (sisi cetak)</option>
                    </select>
                  </td>
                  {seeCost && <td className="num px-2 text-right">{m ? dec(m.harga_rata) : '–'}</td>}
                  <td className="px-1">{canEdit && <button className="btn btn-ghost btn-sm px-1" aria-label="Hapus" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><X size={14} /></button>}</td>
                </tr>
              );
            })}
            {!lines.length && <tr><td colSpan={5} className="px-3 py-4 text-center text-sm text-muted">Belum ada resep. Tanpa resep, stok tidak dipotong dan HPP produk ini hanya dari biaya klik.</td></tr>}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <button id="rcp-add" className="btn btn-sm" onClick={() => setLines((ls) => [...ls, { material_id: '', qty: '1', per: 'unit' }])}><Plus size={14} />Tambah bahan</button>
          {!mats.length && !meta.isLoading && <span className="text-xs text-warn">Belum ada bahan. Tambahkan di menu Stok Bahan.</span>}
          <span className="flex-1" />
          <button id="rcp-save" className="btn btn-primary btn-sm" disabled={!dirty || save.isPending || lines.some((l) => !l.material_id || !(numIn(l.qty) > 0))} onClick={() => save.mutate()}>Simpan resep</button>
        </div>
      )}
      <ErrorBox error={save.error} />
      {seeCost && q.data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CostCard title={matriks ? 'HPP 1 sisi' : 'HPP per unit'} c={q.data.satu_sisi} />
          {matriks && <CostCard title="HPP bolak-balik" c={q.data.bolak_balik} />}
        </div>
      )}
    </div>
  );
}

function CostCard({ title, c }: { title: string; c: Cost }) {
  return (
    <div className="card tint tint-teal p-4 text-sm">
      <div className="text-xs font-bold uppercase tracking-wider text-muted">{title}</div>
      <div className="num mt-1 text-2xl font-extrabold">{dec(c.total)}</div>
      <ul className="mt-2 flex flex-col gap-0.5 text-xs">
        {c.rincian.map((r) => <li key={r.material_id} className="flex justify-between gap-2"><span>{r.nama} {dec(r.qty)} {r.satuan}</span><span className="num">{dec(r.nilai)}</span></li>)}
        <li className="flex justify-between gap-2"><span>Klik mesin {c.klik_per_unit} × {nf(c.tarif_klik)}</span><span className="num">{dec(c.klik)}</span></li>
      </ul>
      {!c.tarif_klik && <p className="mt-2 text-[11px] text-muted">Biaya klik mesin belum diisi (Master Data → Mesin).</p>}
    </div>
  );
}

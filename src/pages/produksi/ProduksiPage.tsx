import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCheck, Clock, FileText, Play, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { CUT_SIZES } from '@/lib/pricing';
import { nf, tglJam } from '@/lib/format';
import { OrderDetailModal } from '@/pages/order/OrderDetailModal';

interface Item {
  id: string; order_id: string; nomor: string; tanggal: string; order_created: string; customer: string; fo: string; desain: string; janji_selesai: string; catatan: string; status_bayar: string;
  nama_produk: string; keterangan: string; qty: number; sisi: number; klik: number; ukuran_cutting: number; jenis_harga: string; mesin_id: string; mesin_nama: string;
  status_produksi: 'antrian' | 'proses' | 'selesai'; operator: string; selesai_at: string; updated_at: string;
}
const COLS = [
  { key: 'antrian' as const, label: 'Antrian', tone: 'pill-brand' },
  { key: 'proses' as const, label: 'Proses', tone: 'pill-warn' },
  { key: 'selesai' as const, label: 'Selesai', tone: 'pill-ok' },
];
const MKEY = 'fortuner-produksi-mesin';

/** Papan produksi per mesin. Operator memindah item: Antrian → Proses → Selesai. */
export function ProduksiPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['produksi'], queryFn: () => api<Item[]>('production.list', { done_days: 1 }), refetchInterval: 20_000 });
  const [mesin, setMesin] = useState(() => { try { return localStorage.getItem(MKEY) || ''; } catch { return ''; } });
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState('');
  const [mobileCol, setMobileCol] = useState<'antrian' | 'proses' | 'selesai'>('antrian');
  const move = useMutation({
    mutationFn: (v: { ids: string[]; status: string }) => api('production.move', { item_ids: v.ids, status: v.status }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['produksi'] });
      const prev = qc.getQueryData<Item[]>(['produksi']);
      qc.setQueryData<Item[]>(['produksi'], (d) => (d || []).map((i) => (v.ids.includes(i.id) ? { ...i, status_produksi: v.status as Item['status_produksi'] } : i)));
      return { prev };
    },
    onError: (e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(['produksi'], ctx.prev); toast((e as Error).message, 'err'); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['produksi'] }); qc.invalidateQueries({ queryKey: ['orders'] }); },
  });
  const canMove = can('produksi', 'ubah');
  const now = Date.now();

  const all = q.data || [];
  const mName = useMemo(() => Object.fromEntries(all.map((i) => [i.mesin_id, i.mesin_nama])), [all]);
  // chip mesin: hanya mesin yang punya item, diurut terbanyak antrian+proses
  const chips = useMemo(() => {
    const c: Record<string, number> = {};
    all.forEach((i) => { if (i.status_produksi !== 'selesai') c[i.mesin_id] = (c[i.mesin_id] || 0) + 1; });
    const ids = Array.from(new Set(all.map((i) => i.mesin_id)));
    return ids.map((id) => ({ id, nama: mName[id] || 'Tanpa mesin', n: c[id] || 0 })).sort((a, b) => b.n - a.n);
  }, [all, mName]);
  const term = search.trim().toLowerCase();
  const items = all.filter((i) => (!mesin || i.mesin_id === mesin) && (!term || `${i.nomor} ${i.customer} ${i.nama_produk} ${i.keterangan}`.toLowerCase().includes(term)));
  const sortKey = (i: Item) => (i.janji_selesai || '9999') + i.order_created;
  const byCol = (k: Item['status_produksi']) => items.filter((i) => i.status_produksi === k).sort((a, b) => k === 'selesai' ? b.selesai_at.localeCompare(a.selesai_at) : sortKey(a).localeCompare(sortKey(b)));
  const setM = (v: string) => { setMesin(v); try { localStorage.setItem(MKEY, v); } catch { /* abaikan */ } };
  const late = (i: Item) => i.janji_selesai && i.status_produksi !== 'selesai' && Date.parse(i.janji_selesai) < now;
  const soon = (i: Item) => i.janji_selesai && i.status_produksi !== 'selesai' && !late(i) && Date.parse(i.janji_selesai) - now < 3 * 3600e3;

  const Card = ({ i }: { i: Item }) => (
    <div className={`rounded-xl border bg-surface p-3 shadow-sm ${late(i) ? 'border-bad/60' : soon(i) ? 'border-warn/60' : 'border-line'}`}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <button className="font-mono font-bold hover:text-brand" onClick={() => setOpen(i.order_id)}>{i.nomor}</button>
        {!mesin && <span className="font-mono uppercase text-brand">{mName[i.mesin_id] || '–'}</span>}
      </div>
      <div className="mt-1.5 font-bold leading-snug">{i.nama_produk}{i.sisi === 2 ? ' · BB' : ''}{i.jenis_harga === 'cutting' ? ` · ${CUT_SIZES[i.ukuran_cutting]}` : ''}</div>
      <div className="num mt-0.5 text-sm">{nf(i.qty)} lembar{i.klik !== i.qty ? ` · ${nf(i.klik)} klik` : ''}</div>
      {i.keterangan && <div className="mt-1 text-sm text-muted">{i.keterangan}</div>}
      <div className="mt-2 flex flex-col gap-1 text-xs text-muted">
        <span className="truncate">{i.customer} · FO {i.fo}</span>
        {i.desain && <span className="flex items-center gap-1 truncate"><FileText size={12} className="shrink-0" />{i.desain}</span>}
        {i.catatan && <span className="rounded bg-sunk px-1.5 py-1 text-ink">{i.catatan}</span>}
        {i.janji_selesai && i.status_produksi !== 'selesai' && (
          <span className={`flex items-center gap-1 font-semibold ${late(i) ? 'text-bad' : soon(i) ? 'text-warn' : ''}`}>
            {late(i) ? <AlertTriangle size={12} /> : <Clock size={12} />}{late(i) ? 'Terlambat · ' : 'Janji '}{tglJam(i.janji_selesai)}
          </span>
        )}
        {i.status_produksi !== 'antrian' && i.operator && <span>{i.status_produksi === 'selesai' ? `Selesai ${tglJam(i.selesai_at)} · ` : 'Dikerjakan '}{i.operator}</span>}
      </div>
      {canMove && (
        <div className="mt-3 flex gap-2">
          {i.status_produksi === 'antrian' && <button className="btn btn-sm flex-1" onClick={() => move.mutate({ ids: [i.id], status: 'proses' })}><Play size={13} />Mulai</button>}
          {i.status_produksi === 'proses' && <>
            <button className="btn btn-ghost btn-sm" onClick={() => move.mutate({ ids: [i.id], status: 'antrian' })} title="Kembalikan ke antrian"><RotateCcw size={13} /></button>
            <button className="btn btn-primary btn-sm flex-1" onClick={() => move.mutate({ ids: [i.id], status: 'selesai' })}><CheckCheck size={13} />Selesai</button>
          </>}
          {i.status_produksi === 'selesai' && <button className="btn btn-ghost btn-sm" onClick={() => move.mutate({ ids: [i.id], status: 'proses' })}><RotateCcw size={13} />Batal selesai</button>}
        </div>
      )}
    </div>
  );

  return (
    <>
      <PageHeader title="Produksi" desc="Item dari nota FO masuk ke antrian mesinnya. Urutan antrian: janji selesai paling dekat dulu. Kolom Selesai menampilkan item 1 hari terakhir yang belum diambil." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className={`chip ${!mesin ? 'border-ink bg-ink text-canvas' : 'hover:border-muted'}`} onClick={() => setM('')}>Semua mesin <span className="num">{all.filter((i) => i.status_produksi !== 'selesai').length}</span></button>
        {chips.map((c) => <button key={c.id} className={`chip ${mesin === c.id ? 'border-ink bg-ink text-canvas' : 'hover:border-muted'}`} onClick={() => setM(c.id)}>{c.nama} <span className="num">{c.n}</span></button>)}
        <div className="relative ml-auto w-full sm:w-64">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input id="produksi-cari" className="input pl-9" placeholder="Cari nota, konsumen, produk…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-ghost" onClick={() => q.refetch()} title="Muat ulang"><RefreshCw size={15} className={q.isFetching ? 'animate-spin' : ''} /></button>
      </div>
      {/* HP: satu kolom dengan tab */}
      <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-sunk p-1 md:hidden">
        {COLS.map((c) => <button key={c.key} onClick={() => setMobileCol(c.key)} className={`rounded-lg py-2 text-sm font-bold ${mobileCol === c.key ? 'bg-surface shadow' : 'text-muted'}`}>{c.label} <span className="num">{byCol(c.key).length}</span></button>)}
      </div>
      {q.isLoading ? <div className="card p-6 text-sm text-muted">Memuat antrian…</div> : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COLS.map((c) => {
            const list = byCol(c.key);
            return (
              <section key={c.key} className={`flex min-w-0 flex-col gap-3 rounded-2xl bg-sunk/70 p-3 ${mobileCol === c.key ? '' : 'max-md:hidden'}`}>
                <div className="flex items-center justify-between px-1">
                  <span className={`pill ${c.tone}`}>{c.label}</span>
                  <span className="num text-sm font-bold text-muted">{list.length}</span>
                </div>
                {!list.length && <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">Kosong</div>}
                {list.map((i) => <Card key={i.id} i={i} />)}
              </section>
            );
          })}
        </div>
      )}
      {open && <OrderDetailModal orderId={open} onClose={() => setOpen('')} />}
    </>
  );
}

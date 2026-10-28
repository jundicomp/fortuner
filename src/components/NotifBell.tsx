import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Bell, Check, CheckCircle2, Clock, HandCoins, Receipt, Scale, ShoppingCart, TriangleAlert, Wallet, X, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { tglJam } from '@/lib/format';
import { DecideModal } from '@/pages/kas/SetoranTab';
import { CekModal, type CekTarget } from '@/components/CekModal';
import { TitipDecideById } from '@/components/Titip';

export interface NotifItem {
  id: string; tipe: string; judul: string; detail: string; nominal: number; scope: string; tindakan: string; ref_tabel: string; ref_id: string;
  aktor: string; created_at: string; baru: boolean; masih_tindakan: boolean;
}
interface NotifData { items: NotifItem[]; belum_dibaca: number; perlu_tindakan: number; read_at: string; bisa_putuskan: boolean }

const ICON: Record<string, [typeof Bell, string]> = {
  setoran_baru: [Clock, 'bg-amber-100 text-amber-700'], setoran_terima: [CheckCircle2, 'bg-green-100 text-green-700'], setoran_tolak: [XCircle, 'bg-red-100 text-red-700'], setoran_batal: [X, 'bg-slate-100 text-slate-600'],
  kk_keluar: [ShoppingCart, 'bg-orange-100 text-orange-700'], kk_masuk: [Wallet, 'bg-amber-100 text-amber-700'], kk_isi_laci: [Wallet, 'bg-amber-100 text-amber-700'], kk_isi_plafon: [Wallet, 'bg-green-100 text-green-700'],
  cek_sesuai: [CheckCircle2, 'bg-green-100 text-green-700'], cek_bermasalah: [TriangleAlert, 'bg-red-100 text-red-700'],
  pindah_dana: [ArrowLeftRight, 'bg-blue-100 text-blue-700'], pindah_batal: [ArrowLeftRight, 'bg-red-100 text-red-700'], rekonsiliasi: [Scale, 'bg-purple-100 text-purple-700'],
  pengeluaran: [Receipt, 'bg-red-100 text-red-700'], titip_baru: [Receipt, 'bg-amber-100 text-amber-700'], titip_konfirmasi: [CheckCircle2, 'bg-green-100 text-green-700'], titip_tolak: [XCircle, 'bg-red-100 text-red-700'], bayar_hutang: [HandCoins, 'bg-red-100 text-red-700'],
};
const iconOf = (t: string) => ICON[t] || [Bell, 'bg-slate-100 text-slate-600'];
const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return 'baru saja'; if (m < 60) return `${m} menit lalu`;
  const h = Math.round(m / 60); if (h < 24) return `${h} jam lalu`;
  return tglJam(iso);
};

/** Lonceng notifikasi di kanan atas + pop-up melayang untuk transaksi baru. */
export function NotifBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['notif'], queryFn: () => api<NotifData>('notif.list'), refetchInterval: 20000, enabled: !!user });
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'semua' | 'tindakan'>('semua');
  const [pops, setPops] = useState<NotifItem[]>([]);
  const [decide, setDecide] = useState<{ it: NotifItem; terima: boolean } | null>(null);
  const [cek, setCek] = useState<CekTarget | null>(null);
  const [titip, setTitip] = useState<{ id: string; terima: boolean } | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const read = useMutation({ mutationFn: () => api('notif.read'), onSuccess: () => qc.invalidateQueries({ queryKey: ['notif'] }) });

  // pop-up untuk kejadian baru sejak pengambilan sebelumnya (tidak saat pertama dimuat)
  useEffect(() => {
    const items = q.data?.items;
    if (!items) return;
    if (!seen.current) { seen.current = new Set(items.map((i) => i.id)); return; }
    const fresh = items.filter((i) => !seen.current!.has(i.id) && i.baru);
    items.forEach((i) => seen.current!.add(i.id));
    if (fresh.length) {
      setPops((p) => [...fresh.slice(0, 3), ...p].slice(0, 4));
      ['kas-saldo', 'kas-kecil', 'setoran', 'riwayat', 'fund'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    }
  }, [q.data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pops.length) return;
    const t = setTimeout(() => setPops((p) => p.slice(0, -1)), 6000);
    return () => clearTimeout(t);
  }, [pops]);
  useEffect(() => {
    const click = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', click);
    return () => document.removeEventListener('mousedown', click);
  }, []);

  const d = q.data;
  const n = d?.belum_dibaca || 0;
  const list = (d?.items || []).filter((i) => tab === 'semua' || i.masih_tindakan);
  const toggle = () => { const o = !open; setOpen(o); if (o && n) read.mutate(); };

  const actions = (it: NotifItem) => {
    if (!it.masih_tindakan || !d?.bisa_putuskan) return null;
    if (it.tindakan === 'setoran') return (
      <div className="mt-1.5 flex gap-1.5">
        <button className="btn btn-sm border-green-700 bg-green-700 px-2.5 text-xs text-white" onClick={() => setDecide({ it, terima: true })}><Check size={13} />Terima</button>
        <button className="btn btn-sm border-bad px-2.5 text-xs text-bad" onClick={() => setDecide({ it, terima: false })}><X size={13} />Tolak</button>
      </div>
    );
    if (it.tindakan === 'titip') return (
      <div className="mt-1.5 flex gap-1.5">
        <button className="btn btn-sm border-green-700 bg-green-700 px-2.5 text-xs text-white" onClick={() => { setOpen(false); setTitip({ id: it.ref_id, terima: true }); }}><Check size={13} />Periksa &amp; konfirmasi</button>
        <button className="btn btn-sm border-bad px-2.5 text-xs text-bad" onClick={() => { setOpen(false); setTitip({ id: it.ref_id, terima: false }); }}><X size={13} />Tolak</button>
      </div>
    );
    if (it.tindakan === 'cek') {
      const t = { tabel: it.ref_tabel, id: it.ref_id, judul: it.detail.replace(/^Perlu dicek · /, '') || it.judul, nominal: it.nominal };
      return (
        <div className="mt-1.5 flex gap-1.5">
          <button className="btn btn-sm px-2.5 text-xs" onClick={() => setCek({ ...t, status: 'sesuai' })}>Sesuai</button>
          <button className="btn btn-sm px-2.5 text-xs text-bad" onClick={() => setCek({ ...t, status: 'bermasalah' })}>Bermasalah</button>
        </div>
      );
    }
    return null;
  };
  const Row = ({ it }: { it: NotifItem }) => {
    const [Icon, cls] = iconOf(it.tipe);
    return (
      <div className={`flex gap-2.5 border-b border-line px-3.5 py-2.5 ${it.baru ? 'bg-brand/5' : ''}`}>
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${cls}`}><Icon size={15} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold leading-snug">{it.judul}</div>
          <div className="truncate text-xs text-muted">{it.detail ? `${it.detail} · ` : ''}{ago(it.created_at)}</div>
          {actions(it)}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="relative" ref={ref}>
        <button id="notif-bell" className="btn btn-ghost relative px-2.5" onClick={toggle} aria-label={`Notifikasi${n ? `, ${n} belum dibaca` : ''}`} aria-expanded={open}>
          <Bell size={18} />
          {n > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-brand px-1 text-center text-[10.5px] font-bold leading-[18px] text-white">{n > 99 ? '99+' : n}</span>}
        </button>
        {open && (
          <div className="fixed inset-x-2 top-[68px] z-40 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[400px]">
            <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5"><b>Notifikasi</b>
              <div className="flex gap-1">
                <button className={`chip px-2.5 py-0.5 text-xs ${tab === 'semua' ? 'border-ink bg-ink text-canvas' : ''}`} onClick={() => setTab('semua')}>Semua</button>
                {(d?.perlu_tindakan || 0) > 0 && <button className={`chip px-2.5 py-0.5 text-xs ${tab === 'tindakan' ? 'border-ink bg-ink text-canvas' : ''}`} onClick={() => setTab('tindakan')}>Perlu tindakan · {d!.perlu_tindakan}</button>}
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {!list.length ? <p className="px-4 py-8 text-center text-sm text-muted">{tab === 'semua' ? 'Belum ada notifikasi.' : 'Tidak ada yang perlu ditindak.'}</p> : list.map((it) => <Row key={it.id} it={it} />)}
            </div>
            <button className="w-full py-2.5 text-center text-sm font-semibold text-brand hover:bg-sunk" onClick={() => { setOpen(false); nav('/riwayat'); }}>Lihat semua di Riwayat →</button>
          </div>
        )}
      </div>
      <div className="pointer-events-none fixed right-3 top-[72px] z-50 flex w-[320px] max-w-[calc(100vw-24px)] flex-col gap-2" aria-live="polite">
        {pops.map((it) => {
          const [Icon] = iconOf(it.tipe);
          return (
            <button key={it.id} className="pointer-events-auto flex gap-2.5 rounded-xl bg-ink px-3.5 py-3 text-left text-canvas shadow-2xl" onClick={() => { setPops((p) => p.filter((x) => x.id !== it.id)); setOpen(true); }}>
              <Icon size={17} className="mt-0.5 shrink-0 text-brand" />
              <span className="min-w-0"><b className="block text-[13px] leading-snug">{it.judul}</b>{it.detail && <span className="block truncate text-xs opacity-75">{it.detail}</span>}</span>
            </button>
          );
        })}
      </div>
      {decide && <DecideModal s={{ id: decide.it.ref_id, kasir_nama: decide.it.aktor, nominal: decide.it.nominal, tanggal: decide.it.created_at.slice(0, 10) }} terima={decide.terima} onClose={() => setDecide(null)} />}
      {cek && <CekModal t={cek} onClose={() => setCek(null)} />}
      {titip && <TitipDecideById id={titip.id} terima={titip.terima} onClose={() => setTitip(null)} />}
    </>
  );
}

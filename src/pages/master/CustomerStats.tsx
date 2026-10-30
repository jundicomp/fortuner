import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Contact, Moon, Sparkles, UserCheck, Users } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { nf, rp } from '@/lib/format';

interface Stats {
  total: number; total_percetakan: number; total_enduser: number; aktif: number; nonaktif: number; percetakan: number; enduser: number;
  baru_bulan_ini: number; transaksi_bulan_ini: number; tidur: number;
  omzet: { reseller: number; enduser: number } | null;
  top: { id: string; nama: string; percetakan: string; tipe: string; omzet: number; nota: number }[] | null;
  piutang: { total: number; konsumen: number } | null;
}

const C_PRC = 'rgb(var(--brand))';
const C_EU = '#2E8B57';
const LS = 'konsumen-ringkasan';
const bulanNama = () => new Date().toLocaleDateString('id-ID', { month: 'long' });
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

/** Batang dua warna Percetakan vs End user + legenda. */
function Split({ a, b, fmt }: { a: number; b: number; fmt: (n: number) => string }) {
  const t = a + b;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-sunk">
        {t > 0 && <div style={{ width: `${(a / t) * 100}%`, background: C_PRC }} />}
        {t > 0 && <div style={{ width: `${(b / t) * 100}%`, background: C_EU }} />}
      </div>
      <div className="mt-2 flex flex-col gap-1 text-xs sm:flex-row sm:justify-between sm:gap-3">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: C_PRC }} />Percetakan <b className="num whitespace-nowrap">{fmt(a)}</b><span className="text-muted">{pct(a, t)}%</span></span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: C_EU }} />End user <b className="num whitespace-nowrap">{fmt(b)}</b><span className="text-muted">{pct(b, t)}%</span></span>
      </div>
    </div>
  );
}

export function CustomerStats() {
  const q = useQuery({ queryKey: ['master', 'customers', 'stats'], queryFn: () => api<Stats>('customers.stats', {}) });
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(LS) !== '0'; } catch { return true; } });
  const toggle = () => setOpen((o) => { try { localStorage.setItem(LS, o ? '0' : '1'); } catch { /* abaikan */ } return !o; });
  const s = q.data;
  const bln = bulanNama();

  const tiles = s ? [
    { label: 'Konsumen aktif', value: nf(s.aktif), sub: s.nonaktif ? `${nf(s.nonaktif)} nonaktif` : 'semua aktif', icon: Users, tint: 'orange' },
    { label: `Baru bulan ${bln}`, value: nf(s.baru_bulan_ini), sub: 'konsumen ditambahkan', icon: Sparkles, tint: 'blue' },
    { label: `Order bulan ${bln}`, value: nf(s.transaksi_bulan_ini), sub: `${pct(s.transaksi_bulan_ini, s.aktif)}% konsumen aktif pernah order`, icon: UserCheck, tint: 'green' },
    { label: 'Lama tidak order', value: nf(s.tidur), sub: 'order terakhir lebih dari 60 hari', icon: Moon, tint: 'purple' },
  ] : [];
  const maxTop = Math.max(1, ...(s?.top || []).map((t) => t.omzet));

  return (
    <section className="mb-4" aria-label="Ringkasan konsumen">
      <button id="cust-stats-toggle" onClick={toggle} className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-muted hover:text-ink">
        <ChevronDown size={14} className={`transition ${open ? '' : '-rotate-90'}`} />Ringkasan konsumen
      </button>
      {open && (q.isLoading ? <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">{[0, 1, 2, 3, 4].map((i) => <div key={i} className={`card h-[120px] animate-pulse bg-sunk ${i ? '' : 'col-span-2'}`} />)}</div>
        : s && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
              <div id="cust-total" className="card col-span-2 flex flex-col p-4">
                <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold uppercase tracking-wider text-muted">Total konsumen</span><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink text-canvas"><Contact size={17} /></span></div>
                <div className="mt-2 flex items-end gap-4">
                  <div className="num text-3xl font-extrabold leading-none">{nf(s.total)}</div>
                  <div className="mb-0.5 flex h-2 flex-1 overflow-hidden rounded-full bg-sunk">
                    {s.total > 0 && <><div style={{ width: `${(s.total_percetakan / s.total) * 100}%`, background: C_PRC }} /><div style={{ width: `${(s.total_enduser / s.total) * 100}%`, background: C_EU }} /></>}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {([['Percetakan', s.total_percetakan, C_PRC], ['End user', s.total_enduser, C_EU]] as const).map(([l, n, col]) => (
                    <div key={l} className="rounded-xl border border-line px-3 py-2" style={{ borderLeft: `4px solid ${col}` }}>
                      <div className="text-xs font-semibold text-muted">{l}</div>
                      <div className="flex items-baseline gap-1.5"><b className="num text-lg">{nf(n)}</b><span className="text-xs text-muted">{pct(n, s.total)}%</span></div>
                    </div>
                  ))}
                </div>
              </div>
              {tiles.map((k) => (
                <div key={k.label} className={`card tint tint-${k.tint} p-4`}>
                  <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold uppercase tracking-wider text-muted">{k.label}</span><span className="tint-chip flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"><k.icon size={17} /></span></div>
                  <div className="num mt-2 text-2xl font-extrabold">{k.value}</div>
                  <div className="mt-1 text-xs text-muted">{k.sub}</div>
                </div>
              ))}
            </div>
            <div className={`grid grid-cols-1 gap-3 ${s.top ? 'lg:grid-cols-2' : ''}`}>
              <div className="card flex flex-col gap-5 p-4">
                <div>
                  <h3 className="mb-3 text-sm font-bold">Jenis konsumen aktif</h3>
                  <Split a={s.percetakan} b={s.enduser} fmt={nf} />
                </div>
                {s.omzet && (
                  <div>
                    <h3 className="mb-3 text-sm font-bold">Omzet bulan {bln} per jenis</h3>
                    <Split a={s.omzet.reseller} b={s.omzet.enduser} fmt={rp} />
                  </div>
                )}
                {s.piutang && (
                  <div className="mt-auto flex items-center justify-between rounded-xl border border-dashed border-line px-3 py-2 text-sm">
                    <span className="text-muted">Piutang berjalan · {nf(s.piutang.konsumen)} konsumen</span><b className="num text-bad">{rp(s.piutang.total)}</b>
                  </div>
                )}
              </div>
              {s.top && (
                <div className="card p-4">
                  <h3 className="mb-3 text-sm font-bold">Top konsumen bulan {bln}</h3>
                  {s.top.length ? (
                    <ol className="flex flex-col gap-3">
                      {s.top.map((t, i) => (
                        <li key={t.id}>
                          <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="min-w-0 truncate"><span className="mr-1.5 text-muted">{i + 1}</span><b>{t.nama}</b>{t.percetakan && t.percetakan !== t.nama && <span className="text-muted"> · {t.percetakan}</span>}</span>
                            <span className="num shrink-0 font-semibold">{rp(t.omzet)} <span className="text-xs font-normal text-muted">· {nf(t.nota)} nota</span></span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-sunk"><div className="h-full rounded-full" style={{ width: `${(t.omzet / maxTop) * 100}%`, background: t.tipe === 'reseller' ? C_PRC : C_EU }} /></div>
                        </li>
                      ))}
                    </ol>
                  ) : <p className="text-sm text-muted">Belum ada order bulan ini.</p>}
                </div>
              )}
            </div>
          </div>
        ))}
    </section>
  );
}

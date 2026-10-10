/**
 * Mesin offline versi web.
 *  - Cache data kasir (produk, riwayat harga, konsumen, metode bayar) supaya Kasir tetap jalan saat internet mati.
 *  - Antrian kirim (outbox): nota & pembayaran yang belum sampai ke server, disimpan di localStorage.
 *  - Cek koneksi tiap 30 detik (ping ke Apps Script) dan kirim antrian otomatis saat online.
 * Versi desktop (Tahap 3) mengganti penyimpanannya dengan SQLite; antarmukanya tetap sama.
 */
import { useSyncExternalStore } from 'react';
import { api, ApiError, simOffline } from './api';
import type { OrderDetail, PosBootstrap } from '@/types';

export type OpKind = 'orders.create' | 'orders.pay';
export interface OutboxOp {
  id: string;            // = id nota / id pembayaran (idempotent di server)
  kind: OpKind;
  payload: Record<string, unknown>;
  label: string;         // mis. "FT-K1-1026-0007 · Toko Sinar Abadi"
  total?: number;
  /** ringkasan untuk ditampilkan di perangkat sebelum terkirim (tidak dikirim ke server) */
  view?: { customer: string; telp?: string; tipe?: string; items: { nama: string; keterangan?: string; qty: number; harga: number }[] };
  created_at: string;
  status: 'pending' | 'failed';
  error?: string;
  tries: number;
}

export interface SyncState {
  online: boolean;
  syncing: boolean;
  outbox: OutboxOp[];
  lastSync: string;
  lastCheck: string;
  notice: string;        // pesan terakhir (mis. nomor nota diganti server)
}

const OUTBOX_KEY = 'fortuner-outbox';
const BOOT_KEY = 'fortuner-pos-cache';
const LAST_KEY = 'fortuner-last-sync';

const readJson = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const writeJson = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

let state: SyncState = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine && !simOffline.get(),
  syncing: false,
  outbox: readJson<OutboxOp[]>(OUTBOX_KEY, []),
  lastSync: readJson<string>(LAST_KEY, ''),
  lastCheck: '',
  notice: '',
};
const listeners = new Set<() => void>();
const afterSync = new Set<() => void>();
function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  if (patch.outbox) writeJson(OUTBOX_KEY, patch.outbox);
  listeners.forEach((l) => l());
}

export const sync = {
  get: () => state,
  subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); },
  /** Dipanggil setelah antrian terkirim (untuk memuat ulang daftar order dsb.) */
  onSynced(fn: () => void) { afterSync.add(fn); return () => afterSync.delete(fn); },
  pendingCount: () => state.outbox.length,

  enqueue(op: Omit<OutboxOp, 'status' | 'tries' | 'created_at'>) {
    if (state.outbox.some((o) => o.id === op.id)) return;
    const next = [...state.outbox, { ...op, status: 'pending' as const, tries: 0, created_at: new Date().toISOString() }];
    if (!writeJson(OUTBOX_KEY, next)) throw new Error('Penyimpanan browser penuh atau diblokir. Nota tidak bisa disimpan offline.');
    set({ outbox: next });
    if (state.online) void sync.flush();
  },

  remove(id: string) { set({ outbox: state.outbox.filter((o) => o.id !== id) }); },
  retry(id: string) { set({ outbox: state.outbox.map((o) => (o.id === id ? { ...o, status: 'pending', error: '' } : o)) }); void sync.flush(); },
  clearNotice() { set({ notice: '' }); },

  /** Kirim antrian berurutan. Berhenti bila jaringan putus; error lain menandai item gagal dan lanjut ke item berikutnya. */
  async flush() {
    if (state.syncing) return;
    const todo = state.outbox.filter((o) => o.status === 'pending');
    if (!todo.length) return;
    set({ syncing: true });
    const notices: string[] = [];
    let sent = 0;
    for (const op of todo) {
      try {
        const res = await api<OrderDetail>(op.kind, op.payload);
        if (res?.renomor) notices.push(`Nomor ${res.nomor_awal} sudah terpakai; server memberi nomor ${res.order.nomor}. Tulis nomor baru di struk.`);
        set({ outbox: state.outbox.filter((o) => o.id !== op.id), online: true });
        sent++;
      } catch (e) {
        const err = e as ApiError;
        if (err.code === 'NETWORK' || err.code?.startsWith('HTTP_5')) { set({ online: false }); break; }
        if (err.code === 'AUTH_REQUIRED') break; // login ulang dulu; antrian tetap aman
        set({ outbox: state.outbox.map((o) => (o.id === op.id ? { ...o, status: 'failed', error: err.message, tries: o.tries + 1 } : o)) });
      }
    }
    const now = new Date().toISOString();
    if (sent) writeJson(LAST_KEY, now);
    set({ syncing: false, lastSync: sent ? now : state.lastSync, notice: notices.join(' ') || state.notice });
    if (sent) afterSync.forEach((f) => f());
  },

  /** Ping server. navigator.onLine saja tidak cukup: WiFi bisa tersambung padahal internet mati. */
  async check() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) { set({ online: false, lastCheck: new Date().toISOString() }); return false; }
    try {
      await api('ping');
      const wasOffline = !state.online;
      set({ online: true, lastCheck: new Date().toISOString() });
      if (state.outbox.some((o) => o.status === 'pending')) void sync.flush();
      if (wasOffline) afterSync.forEach((f) => f());
      return true;
    } catch {
      set({ online: false, lastCheck: new Date().toISOString() });
      return false;
    }
  },

  /** Paksa status offline setelah request gagal karena jaringan. */
  markOffline() { set({ online: false }); },
};

let started = false;
export function startSync() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => void sync.check());
  window.addEventListener('offline', () => set({ online: false }));
  void sync.check();
  setInterval(() => void sync.check(), 30_000);
}

export function useSync() { return useSyncExternalStore(sync.subscribe, sync.get, sync.get); }

// ---------- cache data kasir ----------
export const posCache = {
  get: () => readJson<(PosBootstrap & { cached_at: string }) | null>(BOOT_KEY, null),
  set: (b: PosBootstrap) => writeJson(BOOT_KEY, { ...b, cached_at: new Date().toISOString() }),
};

/** Ambil data kasir dari server; bila offline pakai cache terakhir. */
export async function loadPos(): Promise<PosBootstrap & { fromCache?: boolean; cached_at?: string }> {
  try {
    const b = await api<PosBootstrap>('pos.bootstrap');
    posCache.set(b);
    return b;
  } catch (e) {
    const err = e as ApiError;
    if (err.code === 'NETWORK') {
      sync.markOffline();
      const c = posCache.get();
      if (c) return { ...c, fromCache: true };
      throw new ApiError('NETWORK', 'Belum ada data kasir tersimpan di perangkat ini. Buka Kasir sekali saat online supaya bisa dipakai offline.');
    }
    throw e;
  }
}

export const newClientId = (prefix: 'ord' | 'pmt') =>
  `${prefix}_${(crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '').slice(0, 24)}`;

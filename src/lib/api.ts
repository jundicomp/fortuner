import { getDeviceId } from '@/platform/device';

/** Alamat Apps Script: bawaan build (VITE_API_URL), atau diganti owner/admin lewat menu Koneksi server di aplikasi desktop. */
export const BUILD_API_URL: string = (import.meta.env.VITE_API_URL || '').trim();
const URL_KEY = 'fortuner-api-url';
export const apiUrlOverride = {
  get: () => { try { return (localStorage.getItem(URL_KEY) || '').trim(); } catch { return ''; } },
  set: (v: string) => { try { v ? localStorage.setItem(URL_KEY, v.trim()) : localStorage.removeItem(URL_KEY); } catch { /* abaikan */ } },
};
export const API_URL: string = apiUrlOverride.get() || BUILD_API_URL;
export const IS_DEMO = !API_URL;
export const isValidApiUrl = (u: string) => /^https:\/\/script\.google(usercontent)?\.com\/.+/.test(u.trim());

/**
 * Data lokal (antrian offline, cache harga, sesi, data demo) milik satu server.
 * Kalau server berganti — termasuk dari mode demo ke server asli — semuanya dibuang supaya
 * nota latihan tidak ikut terkirim ke Google Sheets. Pengaturan printer, tema, dan ID perangkat tetap.
 */
const MODE_KEY = 'fortuner-data-owner';
export const DATA_KEYS = ['fortuner-demo-db-v1', 'fortuner-demo-db-v2', 'fortuner-outbox', 'fortuner-pos-cache', 'fortuner-last-sync', 'fortuner-token', 'fortuner-session-cache', 'fortuner-kasir-queue', 'fortuner-sim-offline'];
export function purgeLocalData() {
  try {
    DATA_KEYS.forEach((k) => localStorage.removeItem(k));
    Object.keys(localStorage).filter((k) => k.startsWith('fortuner-counter:')).forEach((k) => localStorage.removeItem(k));
  } catch { /* abaikan */ }
}
export const dataOwner = IS_DEMO ? 'demo' : 'server:' + API_URL;
(function checkDataOwner() {
  try {
    const prev = localStorage.getItem(MODE_KEY);
    if (prev !== null && prev !== dataOwner) purgeLocalData();
    localStorage.setItem(MODE_KEY, dataOwner);
  } catch { /* abaikan */ }
})();

export class ApiError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

const TOKEN_KEY = 'fortuner-token';
export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } },
  set: (t: string) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* abaikan */ } },
};

let onAuthLost: (() => void) | null = null;
export const setOnAuthLost = (fn: () => void) => (onAuthLost = fn);

interface Envelope<T> { ok: boolean; data?: T; error?: { code: string; message: string }; version: number }

/** Satu-satunya pintu ke server. Mode demo memakai server tiruan di browser dengan logika yang sama. */
/** Simulasi internet mati (untuk uji mode offline). Hanya dipakai lewat tombol di panel sinkron. */
const SIM_KEY = 'fortuner-sim-offline';
export const simOffline = {
  get: () => { try { return localStorage.getItem(SIM_KEY) === '1'; } catch { return false; } },
  set: (v: boolean) => { try { v ? localStorage.setItem(SIM_KEY, '1') : localStorage.removeItem(SIM_KEY); } catch { /* abaikan */ } },
};

const OK_KEY = 'fortuner-server-ok';
/** Pernah berhasil terhubung ke server asli dari perangkat ini (mengunci pengubahan server sebelum login). */
export const serverEverOk = () => { try { return localStorage.getItem(OK_KEY) === API_URL; } catch { return false; } };

/** Tes alamat server lain (tanpa mengubah pengaturan). Mengembalikan nama usaha yang terhubung. */
export async function pingServer(url: string): Promise<{ nama_usaha: string; version: number }> {
  if (!isValidApiUrl(url)) throw new ApiError('VALIDATION', 'Alamat harus diawali https://script.google.com/… dan berakhiran /exec.');
  let r: Response;
  try { r = await fetch(url.trim(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'ping' }), redirect: 'follow' }); }
  catch { throw new ApiError('NETWORK', 'Tidak bisa menghubungi alamat itu. Cek internet dan alamatnya.'); }
  if (!r.ok) throw new ApiError('HTTP_' + r.status, `Server membalas ${r.status}. Pastikan deployment Apps Script diatur "Anyone".`);
  let j: Envelope<{ nama_usaha?: string; version?: number }>;
  try { j = await r.json(); } catch { throw new ApiError('BAD_SERVER', 'Alamat itu bukan server Fortuner POS (balasan tidak dikenali).'); }
  if (!j?.ok) throw new ApiError('BAD_SERVER', 'Alamat itu bukan server Fortuner POS.');
  return { nama_usaha: j.data?.nama_usaha || '(tanpa nama)', version: j.version };
}

export async function api<T = unknown>(action: string, payload?: unknown): Promise<T> {
  const req = { action, payload, token: tokenStore.get(), deviceId: getDeviceId() };
  if (simOffline.get()) { await new Promise((r) => setTimeout(r, 300)); throw new ApiError('NETWORK', 'Tidak bisa terhubung ke server (simulasi offline).'); }
  let res: Envelope<T>;
  if (IS_DEMO) {
    const { mockHandle } = await import('./mockServer');
    res = (await mockHandle(req)) as Envelope<T>;
  } else {
    let r: Response;
    try {
      // text/plain supaya browser tidak mengirim preflight CORS (Apps Script tidak melayani OPTIONS)
      r = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(req), redirect: 'follow' });
    } catch {
      throw new ApiError('NETWORK', 'Tidak bisa terhubung ke server. Periksa koneksi internet.');
    }
    if (!r.ok) throw new ApiError('HTTP_' + r.status, `Server membalas ${r.status}.`);
    res = await r.json();
    try { if (localStorage.getItem(OK_KEY) !== API_URL) localStorage.setItem(OK_KEY, API_URL); } catch { /* abaikan */ }
  }
  if (!res.ok) {
    const e = res.error || { code: 'UNKNOWN', message: 'Terjadi kesalahan.' };
    if (e.code === 'AUTH_REQUIRED' || ((e.code === 'DEVICE_NOT_ALLOWED' || e.code === 'ROLE_NOT_ALLOWED') && action !== 'auth.login')) { tokenStore.set(''); onAuthLost?.(); }
    throw new ApiError(e.code, e.message);
  }
  return res.data as T;
}

/**
 * Identitas perangkat.
 * - Web: ID acak di localStorage + IndexedDB (hilang kalau data situs dihapus).
 * - Aplikasi desktop: diturunkan dari ID mesin Windows (MachineGuid), jadi tetap sama walau aplikasi dipasang ulang.
 */
import { sha256 } from '@/server/sha256';
import { isTauri, machineInfo } from './desktop';

const KEY = 'fortuner-device-id';

function randomId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const a = new Uint8Array(16); crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

function idbGet(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('fortuner', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        try {
          const tx = req.result.transaction('kv', 'readonly');
          const g = tx.objectStore('kv').get(KEY);
          g.onsuccess = () => resolve((g.result as string) || null);
          g.onerror = () => resolve(null);
        } catch { resolve(null); }
      };
    } catch { resolve(null); }
  });
}
function idbSet(v: string) {
  try {
    const req = indexedDB.open('fortuner', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => { try { req.result.transaction('kv', 'readwrite').objectStore('kv').put(v, KEY); } catch { /* abaikan */ } };
  } catch { /* abaikan */ }
}

let cached: string | null = null;
export async function initDeviceId(): Promise<string> {
  if (cached) return cached;
  if (isTauri) {
    const m = await machineInfo();
    if (m?.id) { cached = 'pc-' + sha256('fortuner-pc:' + m.id).slice(0, 32); return cached; }
  }
  let id: string | null = null;
  try { id = localStorage.getItem(KEY); } catch { id = null; }
  if (!id) id = await idbGet(); // localStorage terhapus tapi IndexedDB masih ada
  if (!id) id = randomId();
  try { localStorage.setItem(KEY, id); } catch { /* abaikan */ }
  idbSet(id);
  cached = id;
  return id;
}
export const getDeviceId = () => cached || '';

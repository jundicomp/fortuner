import { handle, type Request } from '@/server/core';
import { MockStore, browserEnv } from '@/server/mockStore';
import { seedDemo } from '@/server/demoSeed';
import { sha256 } from '@/server/sha256';

const KEY = 'fortuner-demo-db-v10'; // v10: titip catat pengeluaran (v1.3.3)
try { ['fortuner-demo-db-v1', 'fortuner-demo-db-v2'].forEach((k) => localStorage.removeItem(k)); } catch { /* abaikan */ }
let store: MockStore | null = null;
function getStore() {
  if (!store) {
    store = new MockStore(KEY);
    const st = store;
    if (st.isEmpty) st.batch(() => seedDemo(st, browserEnv));
  }
  return store;
}

/** Server tiruan untuk mode demo: memanggil core yang sama dengan Apps Script, ditambah jeda kecil supaya terasa seperti jaringan. */
export async function mockHandle(req: Request) {
  await new Promise((r) => setTimeout(r, 120 + Math.random() * 180));
  // Demo: browser ini otomatis jadi perangkat kantor yang disetujui, supaya akun kasir & FO bisa langsung dicoba.
  const st = getStore();
  // Di pratinjau/artefak, ID perangkat kadang tidak terbaca (penyimpanan dibatasi): pakai ID demo tetap.
  if (!req.deviceId) req = { ...req, deviceId: 'demo-browser' };
  if (req.deviceId) {
    const hash = sha256('dev:' + req.deviceId);
    if (!st.all('devices').some((d) => d.device_hash === hash)) {
      const now = new Date().toISOString();
      st.insert('devices', { id: 'dev_demo' + String(req.deviceId).slice(0, 6), kode_pc: 'DM', nama: 'Browser demo (otomatis disetujui)', jenis: 'web', device_hash: hash, status: 'disetujui', printer_koneksi: '', printer_alamat: '', lebar_kertas: '',
        laci_otomatis: false, disetujui_oleh: 'demo', last_seen: now, role_izin: '', lokasi: 'Demo', nama_komputer: '', versi_app: '', created_at: now, created_by: 'demo', updated_at: now, updated_by: 'demo' });
    }
  }
  return handle(getStore(), browserEnv, JSON.parse(JSON.stringify(req)));
}

export function resetDemo() {
  const st = getStore();
  st.reset();
  st.batch(() => seedDemo(st, browserEnv));
}

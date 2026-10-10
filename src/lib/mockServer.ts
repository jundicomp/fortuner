import { handle, type Request } from '@/server/core';
import { MockStore, browserEnv } from '@/server/mockStore';
import { seedDemo } from '@/server/demoSeed';

const KEY = 'fortuner-demo-db-v3'; // v3: + produk kertas sendiri (v1.1.2)
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
  return handle(getStore(), browserEnv, JSON.parse(JSON.stringify(req)));
}

export function resetDemo() {
  const st = getStore();
  st.reset();
  st.batch(() => seedDemo(st, browserEnv));
}

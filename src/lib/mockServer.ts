import { handle, type Request } from '@/server/core';
import { MockStore, browserEnv } from '@/server/mockStore';
import { seedDemo } from '@/server/demoSeed';

const KEY = 'fortuner-demo-db-v1';
let store: MockStore | null = null;
function getStore() {
  if (!store) {
    store = new MockStore(KEY);
    if (store.isEmpty) seedDemo(store, browserEnv);
  }
  return store;
}

/** Server tiruan untuk mode demo: memanggil core yang sama dengan Apps Script, ditambah jeda kecil supaya terasa seperti jaringan. */
export async function mockHandle(req: Request) {
  await new Promise((r) => setTimeout(r, 120 + Math.random() * 180));
  return handle(getStore(), browserEnv, JSON.parse(JSON.stringify(req)));
}

export function resetDemo() {
  getStore().reset();
  seedDemo(getStore(), browserEnv);
}

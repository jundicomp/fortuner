import type { Row } from './schema';
import type { Env, Store } from './store';

/** Penyimpanan tiruan di localStorage untuk mode demo. */
export class MockStore implements Store {
  private db: Record<string, Row[]>;
  constructor(private key: string) {
    let parsed: Record<string, Row[]> | null = null;
    try { parsed = JSON.parse(localStorage.getItem(key) || 'null'); } catch { parsed = null; }
    this.db = parsed && typeof parsed === 'object' ? parsed : {};
  }
  get isEmpty() { return !this.db.users || this.db.users.length === 0; }
  private save() { try { localStorage.setItem(this.key, JSON.stringify(this.db)); } catch { /* penyimpanan penuh/diblokir: data hanya di memori */ } }
  private t(table: string) { return (this.db[table] ||= []); }
  all(table: string) { return this.t(table).map((r) => ({ ...r })); }
  insert(table: string, row: Row) { this.t(table).push({ ...row }); this.save(); return { ...row }; }
  update(table: string, keyCol: string, keyVal: string, patch: Row) {
    const r = this.t(table).find((x) => String(x[keyCol]) === String(keyVal));
    if (!r) return null;
    Object.assign(r, patch); this.save(); return { ...r };
  }
  remove(table: string, keyCol: string, keyVal: string) {
    this.db[table] = this.t(table).filter((x) => String(x[keyCol]) !== String(keyVal)); this.save();
  }
  withLock<T>(fn: () => T) { return fn(); }
  reset() { this.db = {}; this.save(); }
}

const pad = (n: number) => String(n).padStart(2, '0');
export const browserEnv: Env = {
  uuid: () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => { const r = (Math.random() * 16) | 0; return (ch === 'x' ? r : (r & 3) | 8).toString(16); })),
  now: () => new Date(),
  today: () => { const d = new Date(Date.now() + 7 * 3600e3); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; },
  timeHM: () => { const d = new Date(Date.now() + 7 * 3600e3); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; },
};

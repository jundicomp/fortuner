/* eslint-disable @typescript-eslint/no-explicit-any */
import { SCHEMA, type Row } from './schema';
import type { Env, Store } from './store';

declare const SpreadsheetApp: any, LockService: any, PropertiesService: any, Utilities: any;

const TZ = 'Asia/Jakarta';

function spreadsheet() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

/** Buat sheet yang belum ada dan tambahkan header yang kurang. Aman dijalankan berulang. */
export function ensureSheets() {
  const ss = spreadsheet();
  Object.keys(SCHEMA).forEach((name) => {
    const cols = Object.keys(SCHEMA[name]);
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const lastCol = Math.max(sh.getLastColumn(), 1);
    const existing: string[] = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String).filter((x: string) => x);
    const missing = cols.filter((c) => existing.indexOf(c) < 0);
    if (missing.length) sh.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
    const headers = existing.concat(missing);
    headers.forEach((h, i) => {
      const t = SCHEMA[name][h];
      // kolom teks dipaksa format teks supaya "2026-10-09" atau kode "001" tidak diubah Sheets jadi tanggal/angka
      if (t === 's' || t === 'j') sh.getRange(1, i + 1, sh.getMaxRows(), 1).setNumberFormat('@');
    });
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#111111').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  });
  const def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Lembar1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
}

interface TableCache { headers: string[]; rows: Row[]; sheet: any }

export class GasStore implements Store {
  private cache: Record<string, TableCache> = {};
  private lockDepth = 0;
  private ss = spreadsheet();

  private load(table: string): TableCache {
    if (this.cache[table]) return this.cache[table];
    const sheet = this.ss.getSheetByName(table);
    if (!sheet) throw new Error(`Sheet "${table}" belum ada. Jalankan setup() di Apps Script.`);
    const values: any[][] = sheet.getDataRange().getValues();
    const headers = (values[0] || []).map(String);
    const types = SCHEMA[table] || {};
    const rows: Row[] = [];
    for (let i = 1; i < values.length; i++) {
      const r: Row = {};
      let empty = true;
      headers.forEach((h, j) => {
        const v = values[i][j];
        if (v !== '' && v != null) empty = false;
        r[h] = this.fromCell(v, types[h]);
      });
      if (!empty) rows.push(r);
      else rows.push({ __empty: true });
    }
    return (this.cache[table] = { headers, rows, sheet });
  }

  private fromCell(v: any, t: string | undefined): unknown {
    if (v instanceof Date) {
      const hm = Utilities.formatDate(v, TZ, 'HH:mm:ss');
      return hm === '00:00:00' ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : v.toISOString();
    }
    switch (t) {
      case 'n': return v === '' || v == null ? null : Number(v);
      case 'b': return v === true || v === 'TRUE' || v === 'true';
      case 'j': if (!v) return null; try { return JSON.parse(String(v)); } catch { return null; }
      default: return v == null ? '' : String(v);
    }
  }

  private toCell(v: unknown, t: string | undefined): unknown {
    switch (t) {
      case 'n': return v == null || v === '' ? '' : Number(v);
      case 'b': return !!v;
      case 'j': return v == null ? '' : JSON.stringify(v);
      default: return v == null ? '' : String(v);
    }
  }

  all(table: string) {
    return this.load(table).rows.filter((r) => !r.__empty).map((r) => ({ ...r }));
  }

  insert(table: string, row: Row) {
    const c = this.load(table);
    const types = SCHEMA[table] || {};
    const arr = c.headers.map((h) => this.toCell(row[h], types[h]));
    c.sheet.getRange(c.rows.length + 2, 1, 1, c.headers.length).setValues([arr]);
    const stored: Row = {};
    c.headers.forEach((h) => (stored[h] = row[h] ?? (types[h] === 'n' ? null : types[h] === 'b' ? false : '')));
    c.rows.push(stored);
    return { ...stored };
  }

  update(table: string, keyCol: string, keyVal: string, patch: Row) {
    const c = this.load(table);
    const idx = c.rows.findIndex((r) => !r.__empty && String(r[keyCol]) === String(keyVal));
    if (idx < 0) return null;
    const merged = { ...c.rows[idx], ...patch };
    const types = SCHEMA[table] || {};
    c.sheet.getRange(idx + 2, 1, 1, c.headers.length).setValues([c.headers.map((h) => this.toCell(merged[h], types[h]))]);
    c.rows[idx] = merged;
    return { ...merged };
  }

  remove(table: string, keyCol: string, keyVal: string) {
    const c = this.load(table);
    const idx = c.rows.findIndex((r) => !r.__empty && String(r[keyCol]) === String(keyVal));
    if (idx < 0) return;
    c.sheet.deleteRow(idx + 2);
    c.rows.splice(idx, 1);
  }

  withLock<T>(fn: () => T): T {
    if (this.lockDepth > 0) return fn();
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    this.lockDepth++;
    this.cache = {}; // baca ulang setelah dapat kunci: request lain mungkin baru menulis
    try { return fn(); } finally { this.lockDepth--; lock.releaseLock(); }
  }
}

export const gasEnv: Env = {
  uuid: () => Utilities.getUuid(),
  now: () => new Date(),
  today: () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'),
  timeHM: () => Utilities.formatDate(new Date(), TZ, 'HH:mm'),
};

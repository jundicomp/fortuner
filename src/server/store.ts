import type { Row } from './schema';

/** Penyimpanan yang dipakai core. Ada dua implementasi: Google Sheets (gasStore) dan localStorage (mockStore). Semua sinkron. */
export interface Store {
  all(table: string): Row[];
  insert(table: string, row: Row): Row;
  update(table: string, keyCol: string, keyVal: string, patch: Row): Row | null;
  remove(table: string, keyCol: string, keyVal: string): void;
  /** Jalankan fn dalam kunci (LockService di Apps Script) supaya dua penulisan tidak bentrok. */
  withLock<T>(fn: () => T): T;
}

/** Hal yang berbeda antara Apps Script dan browser. */
export interface Env {
  uuid(): string;
  now(): Date;
  /** Tanggal hari ini di zona Asia/Jakarta, format YYYY-MM-DD. */
  today(): string;
  /** Waktu sekarang "HH:mm" di zona Asia/Jakarta. */
  timeHM(): string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Titik masuk Apps Script. File ini di-bundle menjadi apps-script/Code.gs (npm run build:gas).
 * Fungsi global yang tersedia di editor Apps Script: doPost, doGet, setup, backupSekarang, pasangTriggerBackup, onOpen.
 */
import { handle, seedBase, API_VERSION } from './core';
import { GasStore, gasEnv, ensureSheets } from './gasStore';

declare const ContentService: any, PropertiesService: any, SpreadsheetApp: any, DriveApp: any, ScriptApp: any, Logger: any, Utilities: any;

const json = (obj: unknown) => ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);

export function doPost(e: any) {
  let req: any;
  try { req = JSON.parse(e?.postData?.contents || '{}'); }
  catch { return json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Body bukan JSON.' }, version: API_VERSION }); }
  return json(handle(new GasStore(), gasEnv, req));
}

export function doGet() {
  return json({ ok: true, data: { app: 'Fortuner POS', version: API_VERSION, time: new Date().toISOString() }, version: API_VERSION });
}

/** Jalankan sekali dari editor: membuat semua sheet + data dasar + akun owner. */
export function setup() {
  ensureSheets();
  const props = PropertiesService.getScriptProperties();
  const pass = props.getProperty('OWNER_PASSWORD') || 'fortuner123';
  const store = new GasStore();
  store.withLock(() => seedBase(store, gasEnv, { username: 'owner', password: pass, nama: 'Owner' }));
  const msg = `Setup selesai. Login: owner / ${props.getProperty('OWNER_PASSWORD') ? '(OWNER_PASSWORD)' : 'fortuner123'} — wajib ganti password saat login pertama.`;
  Logger.log(msg);
  try { SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'Fortuner POS', 10); } catch { /* dijalankan tanpa spreadsheet aktif */ }
  return msg;
}

/** Salin spreadsheet database ke folder "Fortuner POS Backup" di Drive. */
export function backupSekarang() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SPREADSHEET_ID') || SpreadsheetApp.getActiveSpreadsheet().getId();
  const file = DriveApp.getFileById(id);
  const it = DriveApp.getFoldersByName('Fortuner POS Backup');
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder('Fortuner POS Backup');
  const name = `Backup ${file.getName()} ${Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HHmm')}`;
  file.makeCopy(name, folder);
  // simpan 30 backup terakhir
  const files: any[] = []; const fi = folder.getFiles();
  while (fi.hasNext()) files.push(fi.next());
  files.sort((a, b) => b.getDateCreated() - a.getDateCreated()).slice(30).forEach((f) => f.setTrashed(true));
  return name;
}

/** Pasang backup otomatis tiap hari sekitar jam 23.00. */
export function pasangTriggerBackup() {
  ScriptApp.getProjectTriggers().filter((t: any) => t.getHandlerFunction() === 'backupSekarang').forEach((t: any) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('backupSekarang').timeBased().everyDays(1).atHour(23).inTimezone('Asia/Jakarta').create();
  return 'Backup harian terpasang (sekitar 23.00 WIB).';
}

export function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('Fortuner POS')
      .addItem('Setup / perbarui sheet', 'setup')
      .addItem('Backup sekarang', 'backupSekarang')
      .addItem('Pasang backup harian', 'pasangTriggerBackup')
      .addToUi();
  } catch { /* bukan dari spreadsheet */ }
}

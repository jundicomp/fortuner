/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Titik masuk Apps Script. File ini di-bundle menjadi apps-script/Code.gs (npm run build:gas).
 * Fungsi global yang tersedia di editor Apps Script: doPost, doGet, setup, backupSekarang, pasangTriggerBackup, resetPasswordOwner, buatSuperadmin, tesEmail, onOpen.
 */
import { handle, seedBase, resetOwnerPassword, makeSuperadmin, API_VERSION } from './core';
import { GasStore, gasEnv, ensureSheets, backupSpreadsheet } from './gasStore';

declare const ContentService: any, MailApp: any, Session: any, PropertiesService: any, SpreadsheetApp: any, DriveApp: any, ScriptApp: any, Logger: any, Utilities: any;

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
  return backupSpreadsheet('Backup');
}

/** Pasang backup otomatis tiap hari sekitar jam 23.00. */
export function pasangTriggerBackup() {
  ScriptApp.getProjectTriggers().filter((t: any) => t.getHandlerFunction() === 'backupSekarang').forEach((t: any) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('backupSekarang').timeBased().everyDays(1).atHour(23).inTimezone('Asia/Jakarta').create();
  return 'Backup harian terpasang (sekitar 23.00 WIB).';
}

/**
 * Lupa password owner: isi Script Property OWNER_PASSWORD (password baru) lalu jalankan fungsi ini dari editor.
 * Opsional OWNER_RESET_USERNAME = username owner tertentu (kosong = semua owner). Owner wajib ganti password saat login.
 */
export function resetPasswordOwner() {
  const props = PropertiesService.getScriptProperties();
  const pass = String(props.getProperty('OWNER_PASSWORD') || '');
  const who = String(props.getProperty('OWNER_RESET_USERNAME') || '');
  const store = new GasStore();
  const names = store.withLock(() => resetOwnerPassword(store, gasEnv, pass, who));
  const msg = `Password owner direset: ${names.join(', ')}. Login dengan password dari OWNER_PASSWORD, lalu ganti password. Sebaiknya hapus/ubah OWNER_PASSWORD setelah ini.`;
  Logger.log(msg);
  try { SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'Fortuner POS', 10); } catch { /* tanpa spreadsheet aktif */ }
  return msg;
}

/**
 * Akun superadmin pengembang: isi Script Property SUPERADMIN_PASSWORD (opsional SUPERADMIN_USERNAME, bawaan "jundicomp";
 * SUPERADMIN_NAMA, bawaan "Pengembang"), lalu jalankan fungsi ini. Bila akun sudah ada, password-nya diatur ulang.
 */
export function buatSuperadmin() {
  const props = PropertiesService.getScriptProperties();
  const store = new GasStore();
  const r = store.withLock(() => makeSuperadmin(store, gasEnv, String(props.getProperty('SUPERADMIN_USERNAME') || 'jundicomp'), String(props.getProperty('SUPERADMIN_PASSWORD') || ''), String(props.getProperty('SUPERADMIN_NAMA') || 'Pengembang')));
  const msg = `Akun superadmin "${r.username}" ${r.baru ? 'dibuat' : 'diatur ulang'}. Login dengan password dari SUPERADMIN_PASSWORD, ganti password, lalu hapus SUPERADMIN_PASSWORD dari Script Properties.`;
  Logger.log(msg);
  try { SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'Fortuner POS', 10); } catch { /* tanpa spreadsheet aktif */ }
  return msg;
}

/** Uji kirim email (sekaligus memberi izin kirim email ke script). Email dikirim ke akun Google pemilik script. */
export function tesEmail() {
  const to = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({ to, subject: 'Tes email Fortuner POS', body: 'Email dari Fortuner POS berfungsi. Fitur lupa password bisa dipakai.', name: 'Fortuner POS' });
  const msg = `Email tes dikirim ke ${to}. Sisa kuota email hari ini: ${MailApp.getRemainingDailyQuota()}.`;
  Logger.log(msg);
  return msg;
}

export function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('Fortuner POS')
      .addItem('Setup / perbarui sheet', 'setup')
      .addItem('Backup sekarang', 'backupSekarang')
      .addItem('Pasang backup harian', 'pasangTriggerBackup')
      .addItem('Reset password owner (pakai OWNER_PASSWORD)', 'resetPasswordOwner')
      .addItem('Buat / reset akun superadmin (pengembang)', 'buatSuperadmin')
      .addItem('Tes kirim email', 'tesEmail')
      .addToUi();
  } catch { /* bukan dari spreadsheet */ }
}

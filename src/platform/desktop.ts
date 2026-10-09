/**
 * Jembatan ke aplikasi desktop (Tauri). Di browser biasa semua fungsi ini tidak aktif,
 * kecuali "Simulasi aplikasi desktop" (hanya mode demo) yang memakai printer virtual supaya fitur desktop bisa dicoba.
 */
import { escposToText } from '@/lib/escpos';

declare const __APP_VERSION__: string;
export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const SIM_KEY = 'fortuner-sim-desktop';
export const simDesktop = {
  get: () => { if (isTauri) return false; try { return localStorage.getItem(SIM_KEY) === '1'; } catch { return false; } },
  set: (v: boolean) => { try { v ? localStorage.setItem(SIM_KEY, '1') : localStorage.removeItem(SIM_KEY); } catch { /* abaikan */ } },
};
/** true di aplikasi desktop asli, atau saat simulasi desktop dinyalakan di mode demo. */
export const isDesktop = () => isTauri || simDesktop.get();

export interface MachineInfo { id: string; hostname: string; version: string; os: string }

// ---------------- printer virtual (simulasi) ----------------
export interface VirtualJob { id: number; waktu: string; target: string; text: string; drawer: boolean; cut: boolean; bytes: number }
let jobs: VirtualJob[] = [];
let jobSeq = 0;
const listeners = new Set<() => void>();
export const virtualPrinter = {
  jobs: () => jobs,
  clear: () => { jobs = []; listeners.forEach((f) => f()); },
  subscribe: (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; },
};
const SIM_PRINTERS = ['POS-80 Thermal (USB001)', 'POS-58 Thermal (USB002)', 'Microsoft Print to PDF'];

async function simInvoke<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  await new Promise((r) => setTimeout(r, 150));
  switch (cmd) {
    case 'machine_info': return { id: 'simulasi', hostname: 'DESKTOP-SIMULASI', version: APP_VERSION, os: 'windows (simulasi)' } as T;
    case 'list_printers': return SIM_PRINTERS as T;
    case 'print_raw':
    case 'print_tcp': {
      const target = cmd === 'print_raw' ? String(args.printer) : `${args.host}:${args.port}`;
      if (cmd === 'print_raw' && !SIM_PRINTERS.includes(String(args.printer))) throw new Error(`Printer "${args.printer}" tidak ditemukan.`);
      if (cmd === 'print_tcp' && !/^\d+\.\d+\.\d+\.\d+$/.test(String(args.host))) throw new Error(`Tidak bisa terhubung ke ${target}: alamat tidak valid.`);
      if (cmd === 'print_tcp' && String(args.host).endsWith('.0')) throw new Error(`Tidak bisa terhubung ke ${target}: waktu habis (printer mati atau IP salah).`);
      const data = Uint8Array.from(args.data as number[]);
      const t = escposToText(data);
      jobs = [{ id: ++jobSeq, waktu: new Date().toISOString(), target, text: t.text, drawer: t.drawer, cut: t.cut, bytes: data.length }, ...jobs].slice(0, 20);
      listeners.forEach((f) => f());
      return undefined as T;
    }
    default: throw new Error(`Perintah ${cmd} tidak tersedia di simulasi.`);
  }
}

/** Panggil perintah Rust di aplikasi desktop (atau tiruannya saat simulasi). */
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    try { return await tauriInvoke<T>(cmd, args); } catch (e) { throw new Error(typeof e === 'string' ? e : (e as Error)?.message || String(e)); }
  }
  if (simDesktop.get()) return simInvoke<T>(cmd, args);
  throw new Error('Fitur ini hanya ada di aplikasi desktop.');
}

let info: MachineInfo | null = null;
export async function machineInfo(): Promise<MachineInfo | null> {
  if (!isDesktop()) return null;
  if (!info) { try { info = await invoke<MachineInfo>('machine_info'); } catch { info = null; } }
  return info;
}

// ---------------- data pendaftaran PC (diisi di layar login desktop) ----------------
const REG_KEY = 'fortuner-pc-reg';
export interface PcReg { kode: string; lokasi: string }
export const pcReg = {
  get: (): PcReg => { try { return { kode: '', lokasi: '', ...JSON.parse(localStorage.getItem(REG_KEY) || '{}') }; } catch { return { kode: '', lokasi: '' }; } },
  set: (r: PcReg) => { try { localStorage.setItem(REG_KEY, JSON.stringify(r)); } catch { /* abaikan */ } },
};

/** Info yang ikut dikirim saat login supaya admin tahu PC mana yang minta izin. */
export async function deviceInfoForLogin() {
  const m = await machineInfo();
  if (!m) return { jenis: 'web' as const };
  const r = pcReg.get();
  return { jenis: 'desktop' as const, nama: m.hostname, versi: m.version, kode: r.kode, lokasi: r.lokasi };
}

// ---------------- jalan otomatis saat Windows menyala ----------------
export async function autostartGet(): Promise<boolean | null> {
  if (!isTauri) return null;
  try { const m = await import('@tauri-apps/plugin-autostart'); return await m.isEnabled(); } catch { return null; }
}
export async function autostartSet(on: boolean) {
  if (!isTauri) return;
  const m = await import('@tauri-apps/plugin-autostart');
  if (on) await m.enable(); else await m.disable();
}

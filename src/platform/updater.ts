/** Pembaruan aplikasi desktop dari rilis GitHub (plugin updater Tauri). Saat simulasi: pembaruan tiruan. */
import { APP_VERSION, isTauri, simDesktop } from './desktop';

export interface UpdateInfo {
  version: string;
  current: string;
  notes: string;
  date?: string;
  install: (onProgress: (pct: number | null) => void) => Promise<void>;
}

const bump = (v: string) => { const p = v.split('.').map(Number); p[2] = (p[2] || 0) + 1; return p.join('.'); };

/** null = tidak ada versi baru. Melempar error kalau pengecekan gagal (offline, updater belum dikonfigurasi). */
export async function checkUpdate(): Promise<UpdateInfo | null> {
  if (isTauri) {
    const { check } = await import('@tauri-apps/plugin-updater');
    const u = await check();
    if (!u) return null;
    return {
      version: u.version, current: u.currentVersion, notes: u.body || '', date: u.date,
      install: async (onProgress) => {
        let total = 0, got = 0;
        await u.downloadAndInstall((ev) => {
          if (ev.event === 'Started') { total = ev.data.contentLength || 0; onProgress(total ? 0 : null); }
          else if (ev.event === 'Progress') { got += ev.data.chunkLength; onProgress(total ? Math.min(100, Math.round((got / total) * 100)) : null); }
          else if (ev.event === 'Finished') onProgress(100);
        });
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
      },
    };
  }
  if (simDesktop.get()) {
    await new Promise((r) => setTimeout(r, 400));
    return {
      version: bump(APP_VERSION), current: APP_VERSION, notes: '(Simulasi) Perbaikan kecil dan peningkatan kecepatan.',
      install: async (onProgress) => {
        for (let p = 0; p <= 100; p += 20) { onProgress(p); await new Promise((r) => setTimeout(r, 120)); }
        location.reload();
      },
    };
  }
  return null;
}

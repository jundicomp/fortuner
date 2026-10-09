import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError, setOnAuthLost, tokenStore } from '@/lib/api';
import { can as canPerm } from '@/lib/modules';
import type { PermissionMap, Session, User } from '@/types';
import { deviceInfoForLogin } from '@/platform/desktop';

interface AuthState {
  user: User | null;
  perms: PermissionMap;
  ready: boolean;
  notice: string;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (key: string, op?: 'lihat' | 'tambah' | 'ubah' | 'hapus' | 'ekspor') => boolean;
}
const Ctx = createContext<AuthState>(null as unknown as AuthState);

// Salinan sesi terakhir supaya aplikasi tetap terbuka saat dibuka ulang tanpa internet (sesi masih berlaku).
const SES_KEY = 'fortuner-session-cache';
type Cached = { user: User; permissions: PermissionMap; expired_at?: string };
const sesCache = {
  get: (): Cached | null => { try { return JSON.parse(localStorage.getItem(SES_KEY) || 'null'); } catch { return null; } },
  set: (c: Cached | null) => { try { c ? localStorage.setItem(SES_KEY, JSON.stringify(c)) : localStorage.removeItem(SES_KEY); } catch { /* abaikan */ } },
};
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [perms, setPerms] = useState<PermissionMap>({});
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');

  const clear = useCallback((msg = '') => { setUser(null); setPerms({}); setNotice(msg); sesCache.set(null); qc.clear(); }, [qc]);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) { setReady(true); return; }
    try {
      const me = await api<{ user: User; permissions: PermissionMap }>('auth.me');
      setUser(me.user); setPerms(me.permissions);
      sesCache.set({ ...(sesCache.get() || {}), user: me.user, permissions: me.permissions });
    } catch (e) {
      // offline: pakai sesi tersimpan selama belum kedaluwarsa
      const c = sesCache.get();
      if ((e as ApiError).code === 'NETWORK' && c && (!c.expired_at || c.expired_at > new Date().toISOString())) { setUser(c.user); setPerms(c.permissions); }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    setOnAuthLost(() => clear('Sesi berakhir atau perangkat tidak diizinkan. Silakan login lagi.'));
    refresh();
  }, [refresh, clear]);

  const login = async (username: string, password: string) => {
    const s = await api<Session>('auth.login', { username, password, device: await deviceInfoForLogin() });
    tokenStore.set(s.token);
    setUser(s.user); setPerms(s.permissions); setNotice('');
    sesCache.set({ user: s.user, permissions: s.permissions, expired_at: s.expired_at });
  };
  const logout = async () => {
    try { await api('auth.logout'); } catch { /* tetap keluar */ }
    tokenStore.set('');
    clear();
  };

  return (
    <Ctx.Provider value={{ user, perms, ready, notice, login, logout, refresh, can: (k, op = 'lihat') => canPerm(perms, k, op) }}>
      {children}
    </Ctx.Provider>
  );
}

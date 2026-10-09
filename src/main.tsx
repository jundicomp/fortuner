import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { AuthProvider } from '@/auth/AuthContext';
import { ToastProvider } from '@/components/ui/Toast';
import { PrintHost } from '@/components/Receipt';
import { applyTheme, getThemePref } from '@/lib/theme';
import { initDeviceId } from '@/platform/device';
import { startSync } from '@/lib/offline';
import './fonts.css';
import './index.css';

applyTheme(getThemePref());
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => getThemePref() === 'system' && applyTheme('system'));

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30e3 } } });

initDeviceId().then(() => {
  startSync();
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <AuthProvider>
            <App />
            <PrintHost />
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  );
});

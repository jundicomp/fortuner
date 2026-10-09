import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Machine, Settings } from '@/types';

export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: () => api<Settings>('settings.get'), staleTime: 5 * 60e3 });
export const useMachines = (enabled = true) => useQuery({ queryKey: ['master', 'machines'], queryFn: () => api<Machine[]>('master.list', { table: 'machines' }), staleTime: 5 * 60e3, enabled });

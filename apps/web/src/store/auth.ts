import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PingResult, User } from '@youzhong/shared';

interface AuthState {
  user?: User;
  token?: string;
  serverUrl: string;
  ping?: PingResult;
  checked: boolean;
  setUser: (user?: User) => void;
  setToken: (token?: string) => void;
  setServerUrl: (url: string) => void;
  setPing: (ping?: PingResult) => void;
  setChecked: (value: boolean) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      serverUrl: '',
      checked: false,
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      setServerUrl: (serverUrl) => set({ serverUrl }),
      setPing: (ping) => set({ ping }),
      setChecked: (checked) => set({ checked }),
      logout: () => set({ user: undefined, token: undefined }),
    }),
    {
      name: 'youzhong-auth',
      partialize: (state) => ({ serverUrl: state.serverUrl, token: state.token, user: state.user }),
    },
  ),
);

export const currentToken = () => useAuth.getState().token;

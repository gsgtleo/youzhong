import type { AuthSession, Channel, PingResult, User, UserSettings } from '@youzhong/shared';
import { request } from './http';

export const authApi = {
  ping: (serverUrl?: string) => request<PingResult & { userCount: number }>('/ping', {}, { anonymous: true, ...(serverUrl ? {} : {}) }),

  login: (username: string, password: string) =>
    request<AuthSession>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }, { anonymous: true }),

  me: () => request<{ user: User }>('/auth/me'),

  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>('/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
};

export const adminApi = {
  list: () => request<{ users: User[]; limit: number }>('/admin/users'),
  create: (input: { username: string; displayName: string; password: string; role?: string }) =>
    request<{ user: User }>('/admin/users', { method: 'POST', body: JSON.stringify(input) }),
  resetPassword: (id: string, password: string) =>
    request<{ ok: boolean }>(`/admin/users/${id}/password`, { method: 'POST', body: JSON.stringify({ password }) }),
  setStatus: (id: string, status: 'active' | 'disabled') =>
    request<{ ok: boolean }>(`/admin/users/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
};

export const channelApi = {
  list: () => request<{ channels: Channel[] }>('/channels'),
  create: (input: Partial<Channel> & { webhook: string }) =>
    request<{ channel: Channel }>('/channels', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: Partial<Channel> & { webhook?: string }) =>
    request<{ channel: Channel }>(`/channels/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  remove: (id: string) => request<void>(`/channels/${id}`, { method: 'DELETE' }),
  test: (id: string) => request<{ ok: boolean; message: string }>(`/channels/${id}/test`, { method: 'POST' }, { timeoutMs: 20_000 }),
};

export const settingsApi = {
  get: () => request<{ settings: UserSettings; user: User }>('/settings'),
  save: (data: UserSettings) => request<{ settings: UserSettings }>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
};

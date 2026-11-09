/** 统一的服务器地址与请求封装：网页 / PWA 都可以指向任意服务器 */
const STORAGE_KEY = 'youzhong-server-url';
export const DEFAULT_SERVER = '';

export function getServerUrl(): string {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_SERVER;
}

export function setServerUrl(url: string): void {
  const normalized = url.trim().replace(/\/+$/, '');
  if (!normalized) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, normalized);
}

/** 构建时的部署子路径（默认 /，子路径部署时形如 /youzhong） */
const BASE_PATH = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');

export function buildUrl(path: string): string {
  const explicit = getServerUrl();
  // 手动填了服务器地址就按该地址的根路径调用；否则跟随当前部署子路径
  return explicit ? `${explicit}/api${path}` : `${BASE_PATH}/api${path}`;
}

let tokenGetter: () => string | undefined = () => undefined;
let unauthorizedHandler: (() => void) | undefined;

export function bindAuth(getToken: () => string | undefined, onUnauthorized: () => void): void {
  tokenGetter = getToken;
  unauthorizedHandler = onUnauthorized;
}

export class HttpError extends Error {
  status: number;
  code: string;
  retryable: boolean;

  constructor(message: string, status = 500, code = 'request_failed', retryable = false) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export async function request<T>(path: string, init: RequestInit = {}, options: { anonymous?: boolean; timeoutMs?: number } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
  const token = options.anonymous ? undefined : tokenGetter();

  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'youzhong-client',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = (error as Error).name === 'AbortError';
    throw new HttpError(
      aborted
        ? `请求超时：${path}（服务器未响应）`
        : `无法连接服务器：${getServerUrl() || window.location.origin}（请检查地址、端口与网络）`,
      0,
      aborted ? 'timeout' : 'network_error',
      true,
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const error = (payload as { error?: { message?: string; code?: string; retryable?: boolean } })?.error;
    if (response.status === 401 && !options.anonymous) unauthorizedHandler?.();
    throw new HttpError(error?.message ?? `请求失败（${response.status}）`, response.status, error?.code ?? 'request_failed', error?.retryable ?? false);
  }

  return payload as T;
}

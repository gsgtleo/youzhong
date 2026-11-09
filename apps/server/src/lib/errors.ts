import type { NextFunction, Request, Response } from 'express';

export class ApiError extends Error {
  status: number;
  code: string;
  retryable: boolean;

  constructor(message: string, options: { status?: number; code?: string; retryable?: boolean } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status ?? 500;
    this.code = options.code ?? 'internal_error';
    this.retryable = options.retryable ?? false;
  }
}

export function notFound(message = '资源不存在'): ApiError {
  return new ApiError(message, { status: 404, code: 'not_found' });
}

export function badRequest(message: string): ApiError {
  return new ApiError(message, { status: 400, code: 'bad_request' });
}

/** 统一错误中间件：只回传结构化错误，绝不带出 Cookie 等敏感信息 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const apiError = err instanceof ApiError ? err : new ApiError((err as Error)?.message ?? '未知错误');
  if (apiError.status >= 500) {
    console.error('[server] 请求失败', apiError.code, apiError.message);
  }
  res.status(apiError.status).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      retryable: apiError.retryable,
    },
  });
}

/** 异步路由包装，避免每个 handler 都写 try/catch */
export function handle<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: T, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

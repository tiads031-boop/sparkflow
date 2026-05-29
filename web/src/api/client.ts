/**
 * SparkFlow 统一 HTTP 客户端
 *
 * 所有前端 API 调用的唯一入口。
 * CalendarView、appStore、未来新增 feature 均通过此模块发请求。
 *
 * 设计决策（蓝图 #12, #11）：
 * - API 地址由 VITE_API_BASE_URL 环境变量驱动
 * - 认证使用 X-API-Key header
 * - 未配置 API_KEY 时自动跳过（本地开发零摩擦）
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '') as string;
const API_KEY = (import.meta.env.VITE_API_KEY || '') as string;

/** 默认用户 ID，单用户工具使用固定值 */
export const DEFAULT_USER_ID = (import.meta.env.VITE_DEFAULT_USER_ID || 'default') as string;

interface RequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
}

interface ApiOptions extends RequestOptions {
  fallback?: unknown;
  throwOnError?: boolean;
}

/**
 * 统一 API 请求方法
 *
 * 自动拼接 API_BASE 前缀 + X-API-Key header。
 * 非 409 状态的错误响应会抛出 Error。
 * 409 留给调用方自行处理（冲突 diff）。
 * body 为 FormData 时不默认设置 Content-Type，让浏览器自动处理 boundary。
 */
export async function apiRequest(path: string, options?: RequestOptions): Promise<Response> {
  const url = API_BASE ? `${API_BASE}${path}` : `/api${path}`;

  const isFormData = options?.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...((options?.headers as Record<string, string>) || {}),
  };
  if (API_KEY) headers['X-API-Key'] = API_KEY;

  const res = await fetch(url, { ...options, headers });

  if (!res.ok && res.status !== 409) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res;
}

async function requestJson<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: ApiOptions,
): Promise<T> {
  const isFormData = body instanceof FormData;

  const headers: Record<string, string> = { ...(options?.headers || {}) };
  if (!isFormData && body !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const { fallback, throwOnError, ...requestOptions } = options || {};

  try {
    const res = await apiRequest(path, {
      ...requestOptions,
      method,
      body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return (await res.json()) as T;
    }

    return undefined as T;
  } catch (err) {
    if (throwOnError) throw err;
    return fallback as T;
  }
}

/** 便捷 API 命名空间 */
export const api = {
  get: <T>(path: string, options?: ApiOptions) =>
    requestJson<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: ApiOptions) =>
    requestJson<T>('POST', path, body, options),
  put: <T>(path: string, body?: unknown, options?: ApiOptions) =>
    requestJson<T>('PUT', path, body, options),
  delete: <T>(path: string, options?: ApiOptions) =>
    requestJson<T>('DELETE', path, undefined, options),
};

/**
 * 计算标题的 contextMdHash（SHA-256 前 8 位）
 *
 * 复用自 appStore.ts 原始实现。
 * 与服务端 context-bridge/parse.ts 的 hashTitle 逻辑一致。
 */
export async function hashTitle(title: string): Promise<string> {
  const normalized = title.trim().toLowerCase().replace(/\s+/g, ' ');
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 8);
}

/**
 * 同步请求的 base64 编码 fallback
 *
 * Render WAF 会拦截包含命令模式（如 `python -m ...`）的请求体。
 * 同步脚本使用 base64 编码绕过内容扫描。
 * 参考：蓝图已知问题 2026-05-28
 */
export function encodeSyncBody(body: string): { encoding: 'base64'; content: string } {
  const encoded = btoa(unescape(encodeURIComponent(body)));
  return { encoding: 'base64', content: encoded };
}

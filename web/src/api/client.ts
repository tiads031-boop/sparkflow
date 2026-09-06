/**
 * SparkFlow 统一 HTTP 客户端
 *
 * 所有前端 API 调用的唯一入口。
 * CalendarView、appStore、未来新增 feature 均通过此模块发请求。
 *
 * 设计决策（蓝图 #12, #11）：
 * - API 地址由 VITE_API_BASE_URL 环境变量驱动
 * - 认证使用 Supabase access token，后端从令牌中确定用户身份
 * - Capacitor 环境（APK）没有 Vite proxy，自动使用 VITE_API_BASE_URL 直连
 */

import { getAccessToken } from './supabase';

const RAW_API_BASE = (import.meta.env.VITE_API_BASE_URL || '') as string;

/** 兼容旧调用参数；服务端会忽略该值并使用令牌中的用户 ID。 */
export const DEFAULT_USER_ID = (import.meta.env.VITE_DEFAULT_USER_ID || 'default') as string;

const API_BASE = RAW_API_BASE.replace(/\/+$/, '').replace(/\/api$/i, '');

/**
 * 检测当前是否运行在 Capacitor 原生环境
 *
 * 不能 import 来自 capacitor/index.ts（那里面引了 @capacitor/push-notifications，
 * PWA 环境会报错），所以内联一份轻量检测。
 */
function isCapacitorNative(): boolean {
  try {
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/**
 * 解析 API 请求的完整 URL
 *
 * PWA 开发环境：Vite proxy 将 /api/* 转发到 localhost:3001，用相对路径即可
 * Capacitor APP 环境：APK 内无 proxy，直接拼接 VITE_API_BASE_URL + path
 */
function resolveApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  // Capacitor 原生环境：必须用完整后端 URL，NestJS 后端有 /api 全局前缀
  if (isCapacitorNative() && API_BASE) {
    return `${API_BASE}/api${normalizedPath}`;
  }
  // PWA 环境：VITE_API_BASE_URL 有值则用，否则走相对路径由 Vite proxy 兜底
  if (API_BASE) {
    return `${API_BASE}/api${normalizedPath}`;
  }
  return `/api${normalizedPath}`;
}

interface RequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

interface ApiOptions extends RequestOptions {
  fallback?: unknown;
  throwOnError?: boolean;
}

/**
 * 统一 API 请求方法
 *
 * 自动拼接 API_BASE 前缀并附带 Supabase Bearer token。
 * 非 409 状态的错误响应会抛出 Error。
 * 409 留给调用方自行处理（冲突 diff）。
 * body 为 FormData 时不默认设置 Content-Type，让浏览器自动处理 boundary。
 */
export async function apiRequest(path: string, options?: RequestOptions): Promise<Response> {
  const url = resolveApiUrl(path);

  const isFormData = options?.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...((options?.headers as Record<string, string>) || {}),
  };
  const accessToken = await getAccessToken();
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

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

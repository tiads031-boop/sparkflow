export class ApiError extends Error {
  readonly status: number;
  readonly serverMessage: string;

  constructor(status: number, serverMessage = '') {
    super(defaultApiErrorMessage(status));
    this.name = 'ApiError';
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

function defaultApiErrorMessage(status: number): string {
  if (status === 0) return '无法连接服务器，请检查网络或稍后重试';
  if (status === 400) return '提交内容无效，请检查后重试';
  if (status === 401) return '登录状态已失效，请重新登录';
  if (status === 403) return '当前账号无权执行此操作';
  if (status === 404) return '请求的内容不存在或已失效';
  if (status === 408) return '请求超时，请检查网络后重试';
  if (status === 409) return '数据状态已变化，请刷新后重试';
  if (status === 413) return '提交的数据过大，请减少内容后重试';
  if (status === 429) return '操作过于频繁，请稍后再试';
  if (status >= 500) return '服务暂时不可用，请稍后重试';
  return '请求失败，请稍后重试';
}

export function parseApiServerMessage(responseText: string): string {
  if (!responseText.trim()) return '';
  try {
    const body = JSON.parse(responseText) as { message?: unknown };
    if (Array.isArray(body.message)) {
      return body.message.filter((item): item is string => typeof item === 'string').join('；');
    }
    return typeof body.message === 'string' ? body.message : '';
  } catch {
    return '';
  }
}

export function apiErrorContext(error: unknown): string {
  if (error instanceof ApiError) return error.serverMessage || error.message;
  return error instanceof Error ? error.message : String(error ?? '');
}

export function courseImportErrorMessage(error: unknown, phase: 'preview' | 'import'): string {
  const context = apiErrorContext(error).toLowerCase();
  if (error instanceof ApiError) {
    if (error.status === 400) {
      if (context.includes('课表备份格式无效') || context.includes('课程导入请求格式无效')) {
        return '课程导入服务与当前 App 版本不匹配，请更新服务后重试';
      }
      return '课程数据未通过服务器校验，请返回检查学期、作息和课程内容';
    }
    if (error.status === 409) {
      if (context.includes('正在处理')) return '这次导入仍在处理，请稍后再查看结果';
      if (context.includes('请求标识')) return '导入请求已失效，请返回上一步后重试';
      return '课表数据已变化，请重新预览后再导入';
    }
    if (error.status === 401) return '登录状态已失效，请重新登录后导入';
    if (error.status === 413) return '课表数据过大，请减少导入内容后重试';
    if (error.status === 429) return '导入请求过于频繁，请稍后重试';
    if (error.status >= 500) return '课程导入服务暂时不可用，请稍后重试';
  }
  if (context.includes('fetch') || context.includes('network') || context.includes('网络')) {
    return phase === 'preview'
      ? '本地预览已生成，但无法连接课程导入服务，请检查网络后重试'
      : '无法连接课程导入服务，请检查网络后重试';
  }
  return phase === 'preview'
    ? '本地预览已生成，但重复与冲突检查失败，请稍后重试'
    : '课表导入失败，请稍后重试';
}

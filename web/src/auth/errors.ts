import type { AuthMethod } from './credentials.ts';

export function authErrorMessage(message: string, method: AuthMethod = 'email'): string {
  const lower = message.toLowerCase();
  if (lower.includes('rate_limited') || lower.includes('429')) {
    return '操作过于频繁，请稍后再试';
  }
  if (lower.includes('nickname_taken')) return '这个昵称已经被使用';
  if (lower.includes('email_taken')) return '该邮箱已经注册';
  if (lower.includes('invalid_nickname')) return '昵称只能包含 2–24 个文字、数字、点、横线或下划线';
  if (lower.includes('invalid_email')) return '请输入有效邮箱地址';
  if (lower.includes('invalid_current_password')) return '当前密码不正确';
  if (lower.includes('invalid_credentials') || lower.includes('401')) {
    return `${method === 'nickname' ? '昵称' : '邮箱'}或密码不正确`;
  }
  if (lower.includes('fetch') || lower.includes('network')) return '连接认证服务失败，请检查网络后重试';
  if (lower.includes('method must be one') || lower.includes('must be a string')) {
    return '提交内容无效，请刷新页面后重试';
  }
  if (lower.includes('password must be longer than or equal to 6')) return '密码至少需要 6 个字符';
  if (lower.includes('password must be shorter than or equal to 128')) return '密码不能超过 128 个字符';
  return '认证服务暂时不可用';
}

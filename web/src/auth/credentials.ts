export type AuthMethod = 'email' | 'nickname';

const NICKNAME_PATTERN = /^[\p{L}\p{N}_.-]+$/u;

export function normalizeNickname(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('und');
}

export function validateNickname(value: string): string | null {
  const normalized = normalizeNickname(value);
  const length = Array.from(normalized).length;
  if (length < 2 || length > 24) return '昵称需要 2–24 个字符';
  if (!NICKNAME_PATTERN.test(normalized)) return '昵称只能包含文字、数字、点、横线或下划线';
  return null;
}

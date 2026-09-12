export type AuthMethod = 'email' | 'nickname';

const NICKNAME_ALIAS_DOMAIN = 'users.fish-life.cc.cd';
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

export async function nicknameToEmail(value: string): Promise<string> {
  const normalized = normalizeNickname(value);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  const alias = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 52);
  return `n_${alias}@${NICKNAME_ALIAS_DOMAIN}`;
}


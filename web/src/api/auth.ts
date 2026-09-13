const TOKEN_KEY = 'sparkflow.authToken.v1';

export interface AuthUser {
  id: string;
  email?: string | null;
  nickname?: string | null;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken() {
  localStorage.removeItem(TOKEN_KEY);
}

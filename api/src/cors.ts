const DEFAULT_WEB_ORIGINS = ['http://localhost:5173', 'http://localhost:3000'];
const CAPACITOR_ORIGINS = ['https://localhost', 'capacitor://localhost'];

export function resolveCorsOrigins(configuredOrigins?: string): string[] {
  const webOrigins = configuredOrigins
    ? configuredOrigins
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : DEFAULT_WEB_ORIGINS;

  return [...new Set([...webOrigins, ...CAPACITOR_ORIGINS])];
}

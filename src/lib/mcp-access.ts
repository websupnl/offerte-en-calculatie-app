import { timingSafeEqual } from 'node:crypto';

export function validMcpKey(authorization: string | null, key: string | undefined): boolean {
  if (!key || !authorization?.startsWith('Bearer ')) return false;
  const actual = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(key);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function matchMcpRoute(path: string, method: string, catalog: { path: string; methods: string[] }[]) {
  // Reject ambiguous paths before URL normalization can change their meaning.
  if (!/^\/api\/[A-Za-z0-9_/-]+$/.test(path) || path.includes('//') || path.endsWith('/')) return null;
  const segments = path.split('/');
  return catalog.find(route => route.methods.includes(method) && route.path.split('/').length === segments.length
    && route.path.split('/').every((part, i) => /^\[[^\]]+\]$/.test(part) ? Boolean(segments[i]) : part === segments[i])) ?? null;
}

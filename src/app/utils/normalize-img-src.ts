import { environment } from '../../environments/environment';

function asStr(v: any) {
  return String(v ?? '').trim();
}

export function normalizeImgSrc(src: string | null | undefined): string | null {
  const s = asStr(src);
  if (!s) return null;

  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) return s;

  const base = String(environment.apiUrl ?? '').replace(/\/$/, '');
  const path = s.startsWith('/') ? s : `/${s}`;

  if (!base) return path;

  return `${base}${path}`;
}

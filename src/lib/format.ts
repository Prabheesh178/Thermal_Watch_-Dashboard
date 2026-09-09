export const nf = (v: number, digits = 1) =>
  v.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const int = (v: number) => Math.round(v).toLocaleString('en-IN');

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export const hoursSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 3600_000;

export function utc(iso: string): string {
  const d = new Date(iso);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 19)}Z`;
}

export function clock(date = new Date()): string {
  return date.toISOString().slice(11, 19);
}

export const coords = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lon).toFixed(4)}°${lon >= 0 ? 'E' : 'W'}`;

export const humanFeature = (f: string) => f.replace(/_/g, ' ');

export const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`;

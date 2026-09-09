import snapshot from './snapshot.json';
import type { EventDetail, EventSummary, FacilitySeries, Health } from './types';

/** The only thing that changes when the real service lands. */
export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000';

/**
 * A hosted build with no service configured. The bundled snapshot is then the
 * intended source, not a failure — a browser on https cannot reach a mock on
 * localhost anyway, so we skip the doomed fetch and label the state honestly.
 */
export const DEMO_MODE = import.meta.env.PROD && !import.meta.env.VITE_API_BASE;

const snap = snapshot as unknown as {
  generated_at: string;
  events: EventSummary[];
  risk: any;
  facilities: any;
  details: Record<string, EventDetail>;
  facility_history: Record<string, FacilitySeries>;
};

async function get<T>(path: string, timeout = 6000): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export const fetchHealth = () => get<Health>('/health', 2500);

export async function fetchEvents(params: { priority?: string; type?: string; limit?: number } = {}) {
  const q = new URLSearchParams();
  if (params.priority) q.set('priority', params.priority);
  if (params.type) q.set('type', params.type);
  q.set('limit', String(params.limit ?? 300));
  return get<EventSummary[]>(`/events?${q}`);
}

export const fetchEventDetail = (id: string) => get<EventDetail>(`/events/${id}`);
export const fetchFacilityHistory = (id: string, days = 45) =>
  get<FacilitySeries>(`/facility/${id}/history?days=${days}`);
export const fetchRisk = () => get<any>('/risk');
export const fetchFacilities = () => get<any>('/facilities');

export async function startReplay(speed = 600) {
  const res = await fetch(`${API_BASE}/replay/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ speed }),
  });
  if (!res.ok) throw new Error('replay start failed');
  return res.json();
}

export async function stopReplay() {
  const res = await fetch(`${API_BASE}/replay/stop`, { method: 'POST' });
  if (!res.ok) throw new Error('replay stop failed');
  return res.json();
}

/**
 * Cached synthetic snapshot, bundled at build time. Used when the service is
 * unreachable so the console degrades to a labelled last-known view instead of
 * a white screen. Same wire format — no second code path.
 */
export const cached = {
  generatedAt: snap.generated_at,
  events: () => snap.events,
  risk: () => snap.risk,
  facilities: () => snap.facilities,
  detail: (id: string): EventDetail | null => {
    const known = snap.details[id];
    if (known) return known;
    const summary = snap.events.find((e) => e.event_id === id);
    return summary ? synthesiseDetail(summary) : null;
  },
  facilityHistory: (id: string): FacilitySeries | null => snap.facility_history[id] ?? null,
};

/** Deterministic client-side stand-in so every one of the 208 events opens offline. */
function synthesiseDetail(e: EventSummary): EventDetail {
  const base = Math.max(6, e.observed.frp_total_mw * 0.12);
  const now = Date.now();
  const frp_series = Array.from({ length: 40 }, (_, i) => {
    const step = 40 - i;
    const anomalous = e.inferred.anomaly_flag && step <= 2;
    const frp = anomalous
      ? e.observed.frp_total_mw * (step === 2 ? 0.65 : 1)
      : Math.max(2, base + Math.sin(step * 0.45) * base * 0.22);
    return {
      ts: new Date(now - step * 12 * 3600_000).toISOString(),
      frp_mw: Math.round(frp * 10) / 10,
      satellite: step % 2 === 0 ? 'N20' : 'SNPP',
      daynight: step % 2 === 0 ? 'N' : 'D',
      anomalous,
    };
  });
  return {
    ...e,
    frp_series,
    baseline:
      e.inferred.novelty_flag && !e.observed.nearest_industrial
        ? null
        : {
            median_mw: Math.round(base * 10) / 10,
            band_low_mw: Math.round(base * 7.2) / 10,
            band_high_mw: Math.round(base * 13.4) / 10,
            n_history: e.observed.nearest_industrial ? 84 : 22,
            source: e.observed.nearest_industrial ? 'facility' : 'regional',
          },
    pixels: [{ lat: e.centroid.lat, lon: e.centroid.lon, frp_mw: e.observed.frp_max_mw, temp_k: e.observed.bright_ti4_max_k }],
    wind: { speed_kmh: 12, bearing_deg: 290, downwind_cone: [] },
    population_5km_exposure: 0,
    imagery: null,
    timeline: [
      { ts: e.first_seen, event: 'first_detection' },
      { ts: e.last_seen, event: `classified_${e.inferred.event_type}` },
    ],
  };
}

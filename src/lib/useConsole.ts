import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  API_BASE,
  cached,
  DEMO_MODE,
  fetchEventDetail,
  fetchEvents,
  fetchFacilities,
  fetchHealth,
  fetchRisk,
  startReplay,
  stopReplay,
} from './api';
import type { EventDetail, EventStatus, EventSummary, Health, LinkState } from './types';
import { hoursSince } from './format';

export interface Filters {
  types: string[];
  priorities: string[];
  noveltyOnly: boolean;
  anomalyOnly: boolean;
  windowHours: number;
  query: string;
}

export const DEFAULT_FILTERS: Filters = {
  types: [],
  priorities: [],
  noveltyOnly: false,
  anomalyOnly: false,
  windowHours: 48,
  query: '',
};

export interface ReplayState {
  active: boolean;
  speed: number;
  virtualTime: string | null;
  progress: number;
}

export function useConsole() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [risk, setRisk] = useState<any>(null);
  const [facilities, setFacilities] = useState<any>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [link, setLink] = useState<LinkState>('connecting');
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const [statusOverrides, setStatusOverrides] = useState<Record<string, EventStatus>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [replay, setReplay] = useState<ReplayState>({ active: false, speed: 600, virtualTime: null, progress: 0 });

  const esRef = useRef<EventSource | null>(null);

  /** One load path for live and cached — the cached branch is a fallback, not a second contract. */
  const load = useCallback(async () => {
    setLoading(true);
    if (DEMO_MODE) {
      setEvents(cached.events());
      setRisk(cached.risk());
      setFacilities(cached.facilities());
      setLink('cached');
      setLastSync(cached.generatedAt);
      setLoading(false);
      return;
    }
    try {
      const [h, evts, riskGrid, fac] = await Promise.all([
        fetchHealth(),
        fetchEvents({ limit: 300 }),
        fetchRisk().catch(() => cached.risk()),
        fetchFacilities().catch(() => cached.facilities()),
      ]);
      setHealth(h);
      setEvents(evts);
      setRisk(riskGrid);
      setFacilities(fac);
      setLink('live');
      setLastSync(new Date().toISOString());
    } catch {
      setEvents(cached.events());
      setRisk(cached.risk());
      setFacilities(cached.facilities());
      setHealth(null);
      setLink('cached');
      setLastSync(cached.generatedAt);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Live push. `event_update` is a full EventSummary — upsert by id, never append. */
  useEffect(() => {
    if (link !== 'live') return;
    const es = new EventSource(`${API_BASE}/stream`);
    esRef.current = es;

    es.addEventListener('ping', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setLastSync(data.server_time);
    });

    es.addEventListener('event_update', (e) => {
      const incoming = JSON.parse((e as MessageEvent).data) as EventSummary;
      setEvents((prev) => {
        const idx = prev.findIndex((x) => x.event_id === incoming.event_id);
        if (idx === -1) return [incoming, ...prev];
        const next = [...prev];
        next[idx] = { ...next[idx], ...incoming };
        return next;
      });
    });

    es.addEventListener('replay_tick', (e) => {
      const t = JSON.parse((e as MessageEvent).data);
      setReplay({ active: true, speed: t.speed, virtualTime: t.virtual_time, progress: t.progress_pct });
    });

    es.addEventListener('replay_end', () => {
      setReplay((r) => ({ ...r, active: false, progress: 100 }));
    });

    es.onerror = () => {
      es.close();
      setLink('cached');
    };

    return () => es.close();
  }, [link]);

  // Detail fetch, with the cached snapshot as fallback so every event opens offline.
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    (link === 'live' ? fetchEventDetail(selectedId) : Promise.reject(new Error('offline')))
      .catch(() => {
        const fallback = cached.detail(selectedId);
        if (!fallback) throw new Error('unknown event');
        return fallback;
      })
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, link]);

  const withStatus = useMemo(
    () => events.map((e) => (statusOverrides[e.event_id] ? { ...e, status: statusOverrides[e.event_id] } : e)),
    [events, statusOverrides],
  );

  const visible = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return withStatus.filter((e) => {
      if (e.status === 'dismissed' && !filters.query) return false;
      if (filters.types.length && !filters.types.includes(e.inferred.event_type)) return false;
      if (filters.priorities.length && !filters.priorities.includes(e.inferred.priority)) return false;
      if (filters.noveltyOnly && !e.inferred.novelty_flag) return false;
      if (filters.anomalyOnly && !e.inferred.anomaly_flag) return false;
      if (hoursSince(e.last_seen) > filters.windowHours) return false;
      if (q) {
        const hay = `${e.event_id} ${e.inferred.event_type} ${e.observed.nearest_industrial?.name ?? 'no known facility'}`;
        if (!hay.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [withStatus, filters]);

  const setStatus = useCallback((id: string, status: EventStatus) => {
    setStatusOverrides((prev) => ({ ...prev, [id]: status }));
  }, []);

  const toggleReplay = useCallback(
    async (speed: number) => {
      if (replay.active) {
        setReplay((r) => ({ ...r, active: false }));
        if (link === 'live') await stopReplay().catch(() => {});
        return;
      }
      setReplay({ active: true, speed, virtualTime: new Date(Date.now() - 864e5).toISOString(), progress: 0 });
      if (link === 'live') await startReplay(speed).catch(() => {});
    },
    [replay.active, link],
  );

  // Offline replay clock, so the demo still walks the timeline without the service.
  useEffect(() => {
    if (!replay.active || link === 'live') return;
    const id = setInterval(() => {
      setReplay((r) => {
        if (!r.active) return r;
        const progress = Math.min(100, r.progress + (r.speed / 600) * 2.2);
        const virtual = new Date(Date.now() - 864e5 + (progress / 100) * 864e5).toISOString();
        return { ...r, progress, virtualTime: virtual, active: progress < 100 };
      });
    }, 400);
    return () => clearInterval(id);
  }, [replay.active, link]);

  const stats = useMemo(() => {
    const total = withStatus.length;
    const critical = withStatus.filter((e) => e.inferred.anomaly_flag && Math.abs(e.inferred.anomaly_z) > 3).length;
    const novelty = withStatus.filter((e) => e.inferred.novelty_flag).length;
    const frp = withStatus.reduce((sum, e) => sum + e.observed.frp_total_mw, 0);
    const peak = withStatus.reduce(
      (best, e) => (e.observed.frp_total_mw > best.value ? { value: e.observed.frp_total_mw, event: e } : best),
      { value: 0, event: undefined as EventSummary | undefined },
    );
    const high = withStatus.filter((e) => e.inferred.priority === 'HIGH' && e.status === 'new').length;
    const byType = withStatus.reduce<Record<string, number>>((acc, e) => {
      acc[e.inferred.event_type] = (acc[e.inferred.event_type] ?? 0) + 1;
      return acc;
    }, {});
    return { total, critical, novelty, frp, peak, high, byType };
  }, [withStatus]);

  const stale = lastSync ? hoursSince(lastSync) > 6 : false;

  return {
    events: withStatus,
    visible,
    risk,
    facilities,
    health,
    link,
    loading,
    lastSync,
    stale,
    stats,
    filters,
    setFilters,
    selectedId,
    setSelectedId,
    detail,
    detailLoading,
    setStatus,
    replay,
    toggleReplay,
    reload: load,
  };
}

export type ConsoleState = ReturnType<typeof useConsole>;

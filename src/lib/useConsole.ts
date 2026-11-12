import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  cached,
  DEMO_MODE,
  fetchEventDetail,
  fetchEvents,
  fetchFacilities,
  fetchHealth,
  fetchRegions,
} from './api';
import { DISPLAY_THRESHOLDS } from './displayThresholds';
import { hoursSince } from './format';
import type {
  EventDetail,
  EventStatus,
  EventSummary,
  Health,
  LinkState,
  RegionInfo,
} from './types';

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
  windowHours: 168,
  query: '',
};

export interface ReplayState {
  active: boolean;
  speed: number;
  virtualTime: string | null;
  progress: number;
}

const DEFAULT_REGIONS: RegionInfo[] = [
  {
    name: 'gujarat',
    label: 'Gujarat Industrial Belt (Hazira, Dahej, Jamnagar, Surat)',
    bbox: { west: 69.5, south: 20.5, east: 73.8, north: 23.0 },
    description: 'Petrochemical refineries, LNG terminals, ports, and heavy chemical clusters in Gujarat.',
  },
  {
    name: 'maharashtra',
    label: 'Maharashtra Industrial Belt (Mumbai, MMR, Pune, Raigad, Tarapur)',
    bbox: { west: 72.6, south: 18.3, east: 74.5, north: 20.0 },
    description: 'Chemical corridors, manufacturing MIDCs, and energy installations in Maharashtra.',
  },
  {
    name: 'odisha',
    label: 'Odisha Industrial Belt (Angul, Jharsuguda, Paradip, Kalinganagar)',
    bbox: { west: 83.5, south: 19.8, east: 87.0, north: 22.2 },
    description: 'Steel plants, aluminum smelters, coal mining complexes, and deep-water ports in Odisha.',
  },
  {
    name: 'chhattisgarh_jharkhand',
    label: 'East-Central Mining & Steel Belt (Bhilai, Korba, Dhanbad, Jamshedpur)',
    bbox: { west: 81.0, south: 21.0, east: 86.8, north: 24.2 },
    description: 'Coal fields, thermal power plants, and integrated steelworks in CG & JH.',
  },
  {
    name: 'all_india',
    label: 'All India Coverage',
    bbox: { west: 68.0, south: 6.5, east: 97.5, north: 37.5 },
    description: 'Nationwide active fire and thermal anomaly coverage across the Indian subcontinent.',
  },
];

export function useConsole() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [risk, setRisk] = useState<any>(null);
  const [facilities, setFacilities] = useState<any>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [regions, setRegions] = useState<RegionInfo[]>(DEFAULT_REGIONS);
  const [selectedRegion, setSelectedRegion] = useState<string>('all_india');
  const [link, setLink] = useState<LinkState>('connecting');
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const [statusOverrides, setStatusOverrides] = useState<Record<string, EventStatus>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [replay, setReplay] = useState<ReplayState>({
    active: false,
    speed: 600,
    virtualTime: null,
    progress: 0,
  });

  const modelArtifactLabel = useMemo(() => {
    const ma = health?.model_artifacts?.model_a;
    if (ma?.exists) {
      const mtime = ma.modified_at ? ` (${ma.modified_at.slice(0, 10)})` : '';
      return `${ma.filename}${mtime}`;
    }
    return health?.model_versions?.model_a || 'model_a.joblib';
  }, [health]);

  const load = useCallback(
    async (regionOverride?: string) => {
      const targetRegion = regionOverride ?? selectedRegion;
      setLoading(true);
      setApiError(null);

      if (DEMO_MODE) {
        setEvents(cached.events());
        setRisk(cached.risk());
        setFacilities(cached.facilities());
        setHealth(null);
        setLink('cached');
        setLastSync(cached.generatedAt);
        setLoading(false);
        return;
      }

      const handleWaking = () => {
        setLink((prev) => (prev === 'connecting' ? 'waking' : prev));
      };

      try {
        const [h, regList, fac] = await Promise.all([
          fetchHealth(handleWaking),
          fetchRegions().catch(() => DEFAULT_REGIONS),
          fetchFacilities().catch(() => ({ type: 'FeatureCollection', features: [] })),
        ]);

        if (regList && regList.length > 0) {
          setRegions(regList);
        }

        if (h.status !== 'ok') {
          throw new Error(h.error || 'Model artifacts not loaded on API server');
        }

        const artifactLbl =
          h.model_versions?.model_a || 'model_a.joblib';

        const evts = await fetchEvents({
          region: targetRegion,
          modelArtifactLabel: artifactLbl,
          onWaking: handleWaking,
        });

        setHealth(h);
        setEvents(evts);
        // Decision B.2: Skip /risk when connected to real API; hide that map layer when absent.
        setRisk(null);
        setFacilities(fac);
        setLink('live');
        setLastSync(h.data_as_of || new Date().toISOString());
        console.log(`[ThermalWatch] Successfully connected to API. Loaded ${evts.length} events from ${h.data_as_of}`);
      } catch (err: any) {
        console.error('[ThermalWatch] API connection failed:', err);
        setApiError(err?.message ? String(err.message) : 'API unreachable');
        setEvents(cached.events());
        setRisk(cached.risk());
        setFacilities(cached.facilities());
        setHealth(null);
        setLink('cached');
        setLastSync(cached.generatedAt);
      } finally {
        setLoading(false);
      }
    },
    [selectedRegion],
  );

  useEffect(() => {
    void load(selectedRegion);
  }, [load, selectedRegion]);

  /**
   * Decision B.3: Poll `/hotspots` on an interval when connected to the real API.
   * Never open EventSource(`/stream`) against the real API and never flip `link` to `'cached'` due to missing SSE.
   */
  useEffect(() => {
    if (link !== 'live') return;
    const timer = setInterval(async () => {
      try {
        const [h, evts] = await Promise.all([
          fetchHealth(),
          fetchEvents({
            region: selectedRegion,
            modelArtifactLabel,
          }),
        ]);
        if (h.status === 'ok') {
          setHealth(h);
          setEvents(evts);
          setLastSync(h.data_as_of || new Date().toISOString());
        }
      } catch {
        // Keep current live view on transient poll hiccup
      }
    }, DISPLAY_THRESHOLDS.API_POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [link, selectedRegion, modelArtifactLabel]);

  // Detail fetch, with the cached snapshot as fallback only in offline demo mode.
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    (link === 'live'
      ? fetchEventDetail(selectedId, modelArtifactLabel)
      : Promise.reject(new Error('offline')))
      .catch(() => {
        if (link === 'live') {
          // Synthesise basic detail from the live summary if /hotspot/{id} fails transiently
          const liveSummary = events.find((e) => e.event_id === selectedId);
          if (liveSummary) {
            return {
              ...liveSummary,
              frp_series: [],
              baseline: null,
              pixels: [
                {
                  lat: liveSummary.centroid.lat,
                  lon: liveSummary.centroid.lon,
                  frp_mw: liveSummary.observed.frp_max_mw,
                  temp_k: liveSummary.observed.bright_ti4_max_k,
                },
              ],
              wind: { speed_kmh: null, bearing_deg: null },
              dist_to_populated_m: null,
              dist_to_infra_m: null,
              population_5km_exposure: null,
              imagery: null,
              timeline: [
                { ts: liveSummary.first_seen, event: 'first_detection' },
                { ts: liveSummary.last_seen, event: `classified_${liveSummary.inferred.event_type}` },
              ],
            } as EventDetail;
          }
        }
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
  }, [selectedId, link, modelArtifactLabel, events]);

  const withStatus = useMemo(
    () =>
      events.map((e) =>
        statusOverrides[e.event_id] ? { ...e, status: statusOverrides[e.event_id] } : e,
      ),
    [events, statusOverrides],
  );

  /**
   * Dataset currency timestamp (`dataAsOf`):
   * Decision B.4: Filter time windows relative to `data_as_of` from `/health` (or max `last_seen` in dataset),
   * never `Date.now()`.
   */
  const dataAsOf = useMemo(() => {
    if (link === 'live' && health?.data_as_of) {
      return health.data_as_of;
    }
    if (withStatus.length > 0) {
      let maxTs = withStatus[0].last_seen;
      for (const e of withStatus) {
        if (e.last_seen > maxTs) maxTs = e.last_seen;
      }
      return maxTs;
    }
    return link === 'cached' ? cached.generatedAt : null;
  }, [link, health, withStatus]);

  const visible = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return withStatus.filter((e) => {
      if (e.status === 'dismissed' && !filters.query) return false;
      if (filters.types.length && !filters.types.includes(e.inferred.event_type)) return false;
      if (filters.priorities.length && !filters.priorities.includes(e.inferred.priority))
        return false;
      if (filters.noveltyOnly && !e.inferred.novelty_flag) return false;
      if (filters.anomalyOnly && !e.inferred.anomaly_flag) return false;
      if (hoursSince(e.last_seen, dataAsOf) > filters.windowHours) return false;
      if (q) {
        const hay = `${e.event_id} ${e.inferred.event_type} ${e.observed.nearest_industrial?.name ?? 'no known facility'} ${e.location_key ?? ''}`;
        if (!hay.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [withStatus, filters, dataAsOf]);

  const setStatus = useCallback((id: string, status: EventStatus) => {
    setStatusOverrides((prev) => ({ ...prev, [id]: status }));
  }, []);

  /**
   * Decision B.3: Replay controls are only active in offline demo mode (`link === 'cached'`).
   */
  const toggleReplay = useCallback(
    async (speed: number) => {
      if (link === 'live') return;
      if (replay.active) {
        setReplay((r) => ({ ...r, active: false }));
        return;
      }
      const refMs = dataAsOf ? new Date(dataAsOf).getTime() : Date.now();
      setReplay({
        active: true,
        speed,
        virtualTime: new Date(refMs - 864e5).toISOString(),
        progress: 0,
      });
    },
    [replay.active, link, dataAsOf],
  );

  // Offline replay clock for demo mode only.
  useEffect(() => {
    if (!replay.active || link === 'live') return;
    const refMs = dataAsOf ? new Date(dataAsOf).getTime() : Date.now();
    const id = setInterval(() => {
      setReplay((r) => {
        if (!r.active) return r;
        const progress = Math.min(100, r.progress + (r.speed / 600) * 2.2);
        const virtual = new Date(refMs - 864e5 + (progress / 100) * 864e5).toISOString();
        return { ...r, progress, virtualTime: virtual, active: progress < 100 };
      });
    }, 400);
    return () => clearInterval(id);
  }, [replay.active, link, dataAsOf]);

  const stats = useMemo(() => {
    const total = withStatus.length;
    const critical = withStatus.filter(
      (e) => e.inferred.anomaly_flag && Math.abs(e.inferred.anomaly_z) > 3,
    ).length;
    const novelty = withStatus.filter((e) => e.inferred.novelty_flag).length;
    const frp = withStatus.reduce((sum, e) => sum + e.observed.frp_total_mw, 0);
    const peak = withStatus.reduce(
      (best, e) =>
        e.observed.frp_total_mw > best.value ? { value: e.observed.frp_total_mw, event: e } : best,
      { value: 0, event: undefined as EventSummary | undefined },
    );
    const high = withStatus.filter((e) => e.inferred.priority === 'HIGH' && e.status === 'new').length;
    const byType = withStatus.reduce<Record<string, number>>((acc, e) => {
      acc[e.inferred.event_type] = (acc[e.inferred.event_type] ?? 0) + 1;
      return acc;
    }, {});
    return { total, critical, novelty, frp, peak, high, byType };
  }, [withStatus]);

  const currentRegionInfo = useMemo(
    () => regions.find((r) => r.name === selectedRegion) ?? regions[0] ?? DEFAULT_REGIONS[0],
    [regions, selectedRegion],
  );

  return {
    events: withStatus,
    visible,
    risk,
    facilities,
    health,
    regions,
    selectedRegion,
    setSelectedRegion,
    currentRegionInfo,
    dataAsOf,
    apiError,
    link,
    loading,
    lastSync,
    stale: false,
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
    reload: () => load(selectedRegion),
  };
}

export type ConsoleState = ReturnType<typeof useConsole>;

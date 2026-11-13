import snapshot from './snapshot.json';
import { DISPLAY_THRESHOLDS } from './displayThresholds';
import type {
  ArtifactInfo,
  Baseline,
  EventDetail,
  EventSummary,
  Facility,
  FacilitySeries,
  FrpPoint,
  Health,
  Limitation,
  Priority,
  RegionInfo,
  ShapFactor,
} from './types';

const envMeta = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};

/**
 * Base URL of the FastAPI backend, configured via VITE_API_URL (or VITE_API_BASE).
 * Defaults directly to your live production Render deployment.
 */
export const API_BASE: string = (
  envMeta.VITE_API_URL ||
  envMeta.VITE_API_BASE ||
  'https://thermal-watch-model.onrender.com'
).replace(/\/+$/, '');

/**
 * Never force demo mode when a valid API_BASE exists.
 */
export const DEMO_MODE: boolean = false;


const snap = snapshot as unknown as {
  generated_at: string;
  events: EventSummary[];
  risk: any;
  facilities: any;
  details: Record<string, EventDetail>;
  facility_history: Record<string, FacilitySeries>;
};

// --- Raw API wire types matching OUTPUT_SCHEMA.md & api/schemas.py ---

export interface ApiShapDriver {
  feature: string;
  direction: '+' | '-' | string;
  weight: number;
}

export interface ApiHotspotPixel {
  lat: number;
  lon: number;
  frp: number;
  brightness_ti4: number;
  acq_date: string;
  acq_time: string;
}

export interface ApiObservedData {
  frp: number;
  frp_total?: number;
  frp_max?: number;
  brightness_ti4?: number;
  confidence: number;
  acq_date: string;
  acq_time?: string;
  daynight?: string;
  satellite?: string;
  land_cover?: string;
  nearest_industrial_type: string;
  nearest_industrial_name?: string | null;
  dist_to_industrial_m: number;
}

export interface ApiInferredData {
  event_type: string;
  event_type_confidence: number;
  z_score?: number;
  is_anomalous?: boolean;
  anomaly_score_normalized: number;
  hazard_weight: number;
  exposure_factor: number;
  final_risk_score: number;
  escalating_24h: boolean;
  risk_24h: number | null;
  needs_manual_review: boolean;
  top_shap_features: string[];
  top_shap_factors?: ApiShapDriver[];
}

export interface ApiHotspotResponse {
  event_id: string;
  location_key?: string;
  lat: number;
  lon: number;
  bbox?: [number, number, number, number];
  pixel_count?: number;
  first_seen?: string;
  last_seen?: string;
  observed: ApiObservedData;
  inferred: ApiInferredData;
}

export interface ApiHotspotDetailResponse extends ApiHotspotResponse {
  pixels?: ApiHotspotPixel[];
  full_feature_vector: Record<string, any>;
  class_probabilities: Record<string, number>;
}

export interface ApiFacilityHistoryPoint {
  date: string;
  time: string;
  frp: number;
  confidence: number;
  daynight: string;
}

export interface ApiFacilityHistoryResponse {
  location_key: string;
  median_frp: number;
  mad_frp: number;
  upper_3sigma_threshold: number;
  lower_3sigma_threshold: number;
  sample_count: number;
  history: ApiFacilityHistoryPoint[];
}

export interface ApiHealthResponse {
  status: string;
  mode?: string;
  error?: string | null;
  missing_artifacts?: string[];
  data_as_of?: string | null;
  last_refresh_at?: string | null;
  refresh_status?: string;
  active_events_count: number;
  model_artifacts?: Record<string, ArtifactInfo>;
}

// --- Pure Adapter Mapping Functions ---

function formatIsoUtc(acqDate?: string, acqTime?: string): string {
  const d = (acqDate || '2026-09-04').trim();
  const rawT = String(acqTime ?? '0000').trim().split('.')[0].padStart(4, '0');
  const hh = rawT.slice(0, 2);
  const mm = rawT.slice(2, 4);
  return `${d}T${hh}:${mm}:00Z`;
}

function mapConfidenceLabel(confPct: number): 'high' | 'nominal' | 'low' {
  if (confPct >= DISPLAY_THRESHOLDS.CONFIDENCE_HIGH_PCT) return 'high';
  if (confPct >= DISPLAY_THRESHOLDS.CONFIDENCE_LOW_PCT) return 'nominal';
  return 'low';
}

function derivePriority(inf: ApiInferredData): Priority {
  const finalRisk = inf.final_risk_score ?? 0;
  const risk24h = inf.risk_24h ?? 0;
  const zScore = Math.abs(inf.z_score ?? 0);

  if (
    finalRisk >= DISPLAY_THRESHOLDS.PRIORITY_HIGH_FINAL_RISK ||
    inf.event_type === 'industrial_accident' ||
    (inf.escalating_24h && risk24h >= DISPLAY_THRESHOLDS.PRIORITY_HIGH_RISK_24H)
  ) {
    return 'HIGH';
  }

  if (
    finalRisk >= DISPLAY_THRESHOLDS.PRIORITY_MEDIUM_FINAL_RISK ||
    inf.needs_manual_review ||
    (inf.is_anomalous && zScore >= DISPLAY_THRESHOLDS.PRIORITY_MEDIUM_Z_SCORE) ||
    risk24h >= DISPLAY_THRESHOLDS.PRIORITY_MEDIUM_RISK_24H
  ) {
    return 'MEDIUM';
  }

  return 'LOW';
}

function deriveLimitations(
  obs: ApiObservedData,
  ti4K: number,
  sampleCount?: number,
): Limitation[] {
  const lims: Limitation[] = [];
  if (obs.confidence < DISPLAY_THRESHOLDS.CONFIDENCE_LOW_PCT) {
    lims.push('low_confidence');
  }
  if (ti4K >= DISPLAY_THRESHOLDS.VIIRS_I4_SATURATION_KELVIN) {
    lims.push('bright_ti4_saturated');
  }
  if (
    obs.nearest_industrial_type === 'none' ||
    obs.dist_to_industrial_m > DISPLAY_THRESHOLDS.FACILITY_ASSOCIATION_MAX_DIST_M
  ) {
    lims.push('no_facility_match');
  }
  if (
    typeof sampleCount === 'number' &&
    sampleCount > 0 &&
    sampleCount < DISPLAY_THRESHOLDS.MIN_FACILITY_HISTORY_SAMPLES
  ) {
    lims.push('sparse_history');
  }
  return lims;
}

function buildNearestFacility(
  obs: ApiObservedData,
  locationKey?: string,
): Facility | null {
  if (
    !obs.nearest_industrial_type ||
    obs.nearest_industrial_type === 'none' ||
    obs.dist_to_industrial_m > DISPLAY_THRESHOLDS.FACILITY_ASSOCIATION_MAX_DIST_M
  ) {
    return null;
  }
  const facId = locationKey || `osm_${obs.nearest_industrial_type}`;
  const prettyType = obs.nearest_industrial_type.replace(/_/g, ' ');
  const name =
    obs.nearest_industrial_name ||
    `${prettyType.charAt(0).toUpperCase() + prettyType.slice(1)} (${facId})`;
  return {
    facility_id: facId,
    name,
    type: obs.nearest_industrial_type,
    distance_m: Math.round(obs.dist_to_industrial_m),
  };
}

function buildExplanation(
  obs: ApiObservedData,
  inf: ApiInferredData,
  facility: Facility | null,
): string {
  const confPct = Math.round(inf.event_type_confidence * 100);
  const clsLabel = inf.event_type.replace(/_/g, ' ');
  const locPhrase = facility
    ? `${facility.distance_m} m from ${facility.name} (${facility.type.replace(/_/g, ' ')})`
    : `${Math.round(obs.dist_to_industrial_m)} m from nearest mapped industrial boundary`;
  const zScore = typeof inf.z_score === 'number' ? inf.z_score : inf.anomaly_score_normalized * 6;
  const riskPct = Math.round(inf.final_risk_score * 100);
  const drivers = (inf.top_shap_features || []).slice(0, 3).join(', ');
  return `Classified as ${clsLabel} (${confPct}% confidence) at ${locPhrase}. Baseline deviation ${zScore >= 0 ? '+' : ''}${zScore.toFixed(1)}σ; combined risk score ${riskPct}/100.${drivers ? ` Key SHAP drivers: ${drivers}.` : ''}`;
}

export function adaptHealthResponse(raw: ApiHealthResponse): Health {
  const modelVersions: Record<string, string> = {};
  if (raw.model_artifacts) {
    for (const [key, info] of Object.entries(raw.model_artifacts)) {
      if (info.exists) {
        const tsShort = info.modified_at ? info.modified_at.slice(0, 16).replace('T', ' ') + 'Z' : 'loaded';
        modelVersions[key] = `${info.filename} (${tsShort})`;
      } else {
        modelVersions[key] = `${info.filename} (missing)`;
      }
    }
  }
  return {
    status: raw.status,
    mode: raw.mode || 'snapshot',
    engine: 'LightGBM + Robust MAD + ScoreCombiner',
    server_time: raw.data_as_of || new Date().toISOString(),
    data_as_of: raw.data_as_of ?? null,
    last_refresh_at: raw.last_refresh_at ?? null,
    refresh_status: raw.refresh_status ?? 'ok',
    error: raw.error ?? null,
    missing_artifacts: raw.missing_artifacts ?? [],
    active_events_count: raw.active_events_count ?? 0,
    model_versions: modelVersions,
    model_artifacts: raw.model_artifacts,
    firms_latency: raw.data_as_of ? `Data as of ${raw.data_as_of.slice(0, 16).replace('T', ' ')}Z` : 'Snapshot',
  };
}

export function adaptHotspotToEventSummary(
  raw: ApiHotspotResponse,
  modelArtifactLabel = 'model_a.joblib',
): EventSummary {
  const obs = raw.observed;
  const inf = raw.inferred;

  const frpMax = obs.frp_max ?? obs.frp ?? 0;
  const frpTotal = obs.frp_total ?? obs.frp ?? 0;
  const ti4K = obs.brightness_ti4 ?? 325.0;
  const pixelCount = raw.pixel_count ?? 1;
  const firstSeen = raw.first_seen || formatIsoUtc(obs.acq_date, obs.acq_time);
  const lastSeen = raw.last_seen || formatIsoUtc(obs.acq_date, obs.acq_time);
  const bbox: [number, number, number, number] = raw.bbox ?? [
    raw.lon - 0.002,
    raw.lat - 0.002,
    raw.lon + 0.002,
    raw.lat + 0.002,
  ];

  const facility = buildNearestFacility(obs, raw.location_key);
  const zScore =
    typeof inf.z_score === 'number'
      ? inf.z_score
      : Number((inf.anomaly_score_normalized * 6.0).toFixed(2));
  const isAnom =
    typeof inf.is_anomalous === 'boolean'
      ? inf.is_anomalous
      : inf.anomaly_score_normalized > 0.5;
  const noveltyFlag =
    inf.event_type === 'unknown_source' || inf.needs_manual_review;

  // Use genuine signed SHAP factors from TreeExplainer when present; never fabricate weights.
  const topFactors: ShapFactor[] =
    inf.top_shap_factors && inf.top_shap_factors.length > 0
      ? inf.top_shap_factors.map((f) => ({
          feature: f.feature,
          direction: f.direction,
          weight: f.weight,
        }))
      : [];

  const priority = derivePriority(inf);
  const severity = Math.max(1, Math.min(100, Math.round(inf.final_risk_score * 100)));
  const limitations = deriveLimitations(obs, ti4K);

  return {
    event_id: raw.event_id,
    location_key: raw.location_key,
    centroid: { lat: raw.lat, lon: raw.lon },
    bbox,
    pixel_count: pixelCount,
    first_seen: firstSeen,
    last_seen: lastSeen,
    status: 'new',
    observed: {
      frp_total_mw: frpTotal,
      frp_max_mw: frpMax,
      bright_ti4_max_k: ti4K,
      bright_ti4_saturated: ti4K >= DISPLAY_THRESHOLDS.VIIRS_I4_SATURATION_KELVIN,
      confidence: mapConfidenceLabel(obs.confidence),
      confidence_pct: obs.confidence,
      acq_date: obs.acq_date,
      acq_time: obs.acq_time,
      daynight: obs.daynight || 'D',
      sensor: 'VIIRS 375m',
      satellite: obs.satellite || 'SNPP',
      detection_count: pixelCount,
      land_cover: obs.land_cover || 'unknown',
      cloud_cover_pct: null, // API does not provide cloud cover; UI renders "n/a"
      nearest_industrial: facility,
    },
    inferred: {
      event_type: inf.event_type,
      event_type_confidence: inf.event_type_confidence,
      anomaly_z: zScore,
      anomaly_flag: isAnom,
      novelty_flag: noveltyFlag,
      risk_24h: inf.risk_24h,
      escalating_24h: inf.escalating_24h,
      needs_manual_review: inf.needs_manual_review,
      hazard_weight: inf.hazard_weight,
      anomaly_score_normalized: inf.anomaly_score_normalized,
      exposure_factor: inf.exposure_factor,
      final_risk_score: inf.final_risk_score,
      severity,
      priority,
      top_factors: topFactors,
      explanation: buildExplanation(obs, inf, facility),
      model_version: modelArtifactLabel,
    },
    limitations,
  };
}

export function adaptHotspotDetailToEventDetail(
  detailRaw: ApiHotspotDetailResponse,
  historyRaw?: ApiFacilityHistoryResponse | null,
  modelArtifactLabel = 'model_a.joblib',
): EventDetail {
  const fv = detailRaw.full_feature_vector || {};
  const mergedRaw: ApiHotspotResponse = {
    ...detailRaw,
    observed: {
      ...detailRaw.observed,
      brightness_ti4:
        detailRaw.observed.brightness_ti4 ??
        Number(fv.bright_ti4 ?? fv.brightness_ti4 ?? 325.0),
      daynight: detailRaw.observed.daynight || String(fv.daynight || 'D'),
      land_cover:
        detailRaw.observed.land_cover && detailRaw.observed.land_cover !== 'unknown'
          ? detailRaw.observed.land_cover
          : String(fv.land_cover ?? fv.land_cover_class ?? 'unknown'),
    },
    inferred: {
      ...detailRaw.inferred,
      z_score:
        detailRaw.inferred.z_score ??
        (typeof fv.frp_zscore_vs_facility_baseline === 'number'
          ? Number(fv.frp_zscore_vs_facility_baseline)
          : undefined),
    },
  };

  const summary = adaptHotspotToEventSummary(mergedRaw, modelArtifactLabel);
  if (detailRaw.class_probabilities) {
    summary.inferred.class_probabilities = detailRaw.class_probabilities;
  }

  // Update limitations if facility history sample_count is known
  if (historyRaw) {
    summary.limitations = deriveLimitations(
      mergedRaw.observed,
      summary.observed.bright_ti4_max_k,
      historyRaw.sample_count,
    );
  }

  const upperThresh = historyRaw?.upper_3sigma_threshold ?? Infinity;
  const frpSeries: FrpPoint[] = (historyRaw?.history || []).map((h) => ({
    ts: formatIsoUtc(h.date, h.time),
    frp_mw: h.frp,
    satellite: summary.observed.satellite || 'SNPP',
    daynight: h.daynight || 'D',
    anomalous: h.frp > upperThresh,
  }));

  const baseline: Baseline | null =
    historyRaw && historyRaw.sample_count > 0
      ? {
          median_mw: historyRaw.median_frp,
          band_low_mw: historyRaw.lower_3sigma_threshold,
          band_high_mw: historyRaw.upper_3sigma_threshold,
          n_history: historyRaw.sample_count,
          source:
            historyRaw.sample_count >= DISPLAY_THRESHOLDS.MIN_FACILITY_HISTORY_SAMPLES
              ? 'facility'
              : 'regional',
        }
      : null;

  const pixels =
    detailRaw.pixels && detailRaw.pixels.length > 0
      ? detailRaw.pixels.map((p) => ({
          lat: p.lat,
          lon: p.lon,
          frp_mw: p.frp,
          temp_k: p.brightness_ti4,
        }))
      : [
          {
            lat: summary.centroid.lat,
            lon: summary.centroid.lon,
            frp_mw: summary.observed.frp_max_mw,
            temp_k: summary.observed.bright_ti4_max_k,
          },
        ];

  const windSpeedKmh =
    typeof fv.wind_speed === 'number' ? Math.round(fv.wind_speed * 10) / 10 : null;
  const distPopM =
    typeof fv.dist_to_populated_area_m === 'number'
      ? Math.round(fv.dist_to_populated_area_m)
      : null;
  const distInfraM =
    typeof fv.dist_to_critical_infra_m === 'number'
      ? Math.round(fv.dist_to_critical_infra_m)
      : null;

  const timeline: { ts: string; event: string }[] = [
    { ts: summary.first_seen, event: 'first_detection' },
    {
      ts: summary.last_seen,
      event: `classified_${summary.inferred.event_type} (${Math.round(summary.inferred.event_type_confidence * 100)}%)`,
    },
  ];
  if (summary.inferred.anomaly_flag) {
    timeline.push({
      ts: summary.last_seen,
      event: `anomaly_z_${summary.inferred.anomaly_z >= 0 ? '+' : ''}${summary.inferred.anomaly_z.toFixed(1)}σ`,
    });
  }
  if (summary.inferred.needs_manual_review) {
    timeline.push({
      ts: summary.last_seen,
      event: 'routed_to_manual_review',
    });
  }

  return {
    ...summary,
    frp_series: frpSeries,
    baseline,
    pixels,
    wind: {
      speed_kmh: windSpeedKmh,
      bearing_deg: null, // Wind direction is not provided by the model pipeline; downwind cone is hidden
    },
    dist_to_populated_m: distPopM,
    dist_to_infra_m: distInfraM,
    population_5km_exposure: null,
    imagery: null,
    timeline,
  };
}

export function adaptFacilityHistoryResponse(
  raw: ApiFacilityHistoryResponse,
  facilityName?: string,
): FacilitySeries {
  const sigmaDenom = Math.max(1.4826 * raw.mad_frp, 0.1 * raw.median_frp, 1.0);
  return {
    facility_id: raw.location_key,
    facility_name: facilityName || raw.location_key,
    n_history: raw.sample_count,
    source:
      raw.sample_count >= DISPLAY_THRESHOLDS.MIN_FACILITY_HISTORY_SAMPLES
        ? 'facility'
        : 'regional',
    baseline:
      raw.sample_count > 0
        ? {
            median_mw: raw.median_frp,
            band_low_mw: raw.lower_3sigma_threshold,
            band_high_mw: raw.upper_3sigma_threshold,
          }
        : null,
    history: (raw.history || []).map((h) => ({
      timestamp: formatIsoUtc(h.date, h.time),
      frp_mw: h.frp,
      z_score: Number(((h.frp - raw.median_frp) / sigmaDenom).toFixed(2)),
      median_mw: raw.median_frp,
      band_low_mw: raw.lower_3sigma_threshold,
      band_high_mw: raw.upper_3sigma_threshold,
      satellite: 'SNPP',
    })),
  };
}

// --- Network Fetch Helpers with Render Cold-Start Handling ---

async function getJson<T>(
  path: string,
  options: { timeoutMs?: number; onWaking?: () => void } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DISPLAY_THRESHOLDS.API_COLD_START_TIMEOUT_MS;
  let wakingTimer: ReturnType<typeof setTimeout> | undefined;

  if (options.onWaking) {
    wakingTimer = setTimeout(() => {
      options.onWaking?.();
    }, DISPLAY_THRESHOLDS.API_WAKING_NOTICE_MS);
  }

  // Dual-target resilience: try same-origin proxy (/api/backend) first,
  // which works both on Vercel and local Vite dev, then direct Render backend.
  // This bypasses browser ad-blockers, network firewalls, and CORS restrictions.
  const targets: string[] = [];
  if (typeof window !== 'undefined') {
    targets.push(`/api/backend${path}`);
  }
  if (!targets.includes(`${API_BASE}${path}`)) {
    targets.push(`${API_BASE}${path}`);
  }
  const directRender = `https://thermal-watch-model.onrender.com${path}`;
  if (!targets.includes(directRender)) {
    targets.push(directRender);
  }

  let lastError: any = null;
  try {
    for (const url of targets) {
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) {
          let detail = `${res.status}`;
          try {
            const errBody = await res.json();
            if (errBody?.detail) detail = String(errBody.detail);
          } catch {
            // ignore JSON parse failure
          }
          throw new Error(`${url} -> ${detail}`);
        }
        return (await res.json()) as T;
      } catch (err: any) {
        lastError = err;
        console.warn(`[ThermalWatch] Fetch failed for ${url}:`, err);
      }
    }
    throw lastError || new Error(`${path} -> Failed to fetch`);
  } finally {
    if (wakingTimer) clearTimeout(wakingTimer);
  }
}

export async function fetchHealth(onWaking?: () => void): Promise<Health> {
  const raw = await getJson<ApiHealthResponse>('/health', {
    timeoutMs: DISPLAY_THRESHOLDS.API_COLD_START_TIMEOUT_MS,
    onWaking,
  });
  return adaptHealthResponse(raw);
}

export async function fetchRegions(): Promise<RegionInfo[]> {
  return getJson<RegionInfo[]>('/regions', { timeoutMs: 15000 });
}

export async function fetchFacilities(): Promise<any> {
  return getJson<any>('/facilities', { timeoutMs: 15000 });
}

export async function fetchEvents(
  params: {
    region?: string;
    bbox?: string;
    sinceHours?: number;
    modelArtifactLabel?: string;
    onWaking?: () => void;
  } = {},
): Promise<EventSummary[]> {
  const q = new URLSearchParams();
  if (params.region) q.set('region', params.region);
  else if (params.bbox) q.set('bbox', params.bbox);
  // Request an initial 48h lookback for fast first-render (< 2.5s) on Render free tier
  q.set('since_hours', String(params.sinceHours ?? 48));

  const rawList = await getJson<ApiHotspotResponse[]>(`/hotspots?${q.toString()}`, {
    timeoutMs: DISPLAY_THRESHOLDS.API_COLD_START_TIMEOUT_MS,
    onWaking: params.onWaking,
  });

  return rawList.map((item) =>
    adaptHotspotToEventSummary(item, params.modelArtifactLabel || 'model_a.joblib'),
  );
}

export async function fetchEventDetail(
  id: string,
  modelArtifactLabel = 'model_a.joblib',
): Promise<EventDetail> {
  const detailRaw = await getJson<ApiHotspotDetailResponse>(
    `/hotspot/${encodeURIComponent(id)}`,
    { timeoutMs: 20000 },
  );

  let historyRaw: ApiFacilityHistoryResponse | null = null;
  if (detailRaw.location_key) {
    try {
      historyRaw = await getJson<ApiFacilityHistoryResponse>(
        `/facility/${encodeURIComponent(detailRaw.location_key)}/history`,
        { timeoutMs: 15000 },
      );
    } catch {
      historyRaw = null;
    }
  }

  return adaptHotspotDetailToEventDetail(detailRaw, historyRaw, modelArtifactLabel);
}

export async function fetchFacilityHistory(id: string, _days?: number): Promise<FacilitySeries> {
  const raw = await getJson<ApiFacilityHistoryResponse>(
    `/facility/${encodeURIComponent(id)}/history`,
    { timeoutMs: 15000 },
  );
  return adaptFacilityHistoryResponse(raw);
}

/**
 * Bundled offline demo snapshot (`snapshot.json`).
 * Used ONLY when the API is unreachable or in offline DEMO_MODE, and always accompanied
 * by the explicit "Demo data, API not connected" banner.
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

/** Deterministic client-side stand-in for offline demo mode only. */
function synthesiseDetail(e: EventSummary): EventDetail {
  const base = Math.max(6, e.observed.frp_total_mw * 0.12);
  const refMs = new Date(snap.generated_at || e.last_seen).getTime() || Date.now();
  const frp_series = Array.from({ length: 40 }, (_, i) => {
    const step = 40 - i;
    const anomalous = e.inferred.anomaly_flag && step <= 2;
    const frp = anomalous
      ? e.observed.frp_total_mw * (step === 2 ? 0.65 : 1)
      : Math.max(2, base + Math.sin(step * 0.45) * base * 0.22);
    return {
      ts: new Date(refMs - step * 12 * 3600_000).toISOString(),
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
    pixels: [
      {
        lat: e.centroid.lat,
        lon: e.centroid.lon,
        frp_mw: e.observed.frp_max_mw,
        temp_k: e.observed.bright_ti4_max_k,
      },
    ],
    wind: { speed_kmh: 12, bearing_deg: 290, downwind_cone: [] },
    population_5km_exposure: 0,
    imagery: null,
    timeline: [
      { ts: e.first_seen, event: 'first_detection' },
      { ts: e.last_seen, event: `classified_${e.inferred.event_type}` },
    ],
  };
}

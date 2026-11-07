export type EventStatus = 'new' | 'acknowledged' | 'dismissed';
export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Canonical 7 classes produced by Model A in live mode, plus the 2 legacy aliases
 * ('industrial_incident' and 'persistent_flare') retained only for offline demo mode.
 */
export type CanonicalEventType =
  | 'industrial_accident'
  | 'industrial_flare'
  | 'stockpile_combustion'
  | 'wildfire'
  | 'agricultural_burn'
  | 'known_false_positive'
  | 'unknown_source';

export type DemoEventType =
  | 'industrial_incident'
  | 'persistent_flare'
  | 'wildfire'
  | 'agricultural_burn'
  | 'known_false_positive'
  | 'unknown_source';

export type EventType = CanonicalEventType | DemoEventType;

export type Limitation =
  | 'cloud_cover_moderate'
  | 'cloud_cover_high'
  | 'low_confidence'
  | 'bright_ti4_saturated'
  | 'sparse_history'
  | 'no_facility_match';

export interface RegionBBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface RegionInfo {
  name: string;
  label: string;
  bbox: RegionBBox;
  description?: string;
}

export interface Facility {
  facility_id: string;
  name: string;
  type: string;
  distance_m: number;
}

/** Satellite measurement. Never merge with `inferred` — the problem statement grades on it. */
export interface Observed {
  frp_total_mw: number;
  frp_max_mw: number;
  bright_ti4_max_k: number;
  bright_ti4_saturated: boolean;
  confidence: 'low' | 'nominal' | 'high' | string;
  confidence_pct?: number;
  acq_date?: string;
  acq_time?: string;
  daynight: 'D' | 'N' | string;
  sensor: string;
  satellite: string;
  detection_count: number;
  land_cover: string;
  /** null when connected to the real API (which does not ingest cloud cover). Render "n/a". */
  cloud_cover_pct: number | null;
  /** null for every unknown_source and agricultural burn outside search radius. */
  nearest_industrial: Facility | null;
}

export interface ShapFactor {
  feature: string;
  direction: '+' | '-' | string;
  weight: number;
}

/** Model output. Rendered in its own visually distinct section. */
export interface Inferred {
  event_type: EventType | string;
  event_type_confidence: number;
  anomaly_z: number;
  anomaly_flag: boolean;
  novelty_flag: boolean;
  /** null until Model C ships — render "not available", never 0%. */
  risk_24h: number | null;
  escalating_24h?: boolean;
  needs_manual_review?: boolean;
  hazard_weight?: number;
  anomaly_score_normalized?: number;
  exposure_factor?: number;
  final_risk_score?: number;
  class_probabilities?: Record<string, number>;
  severity: number;
  priority: Priority | string;
  top_factors: ShapFactor[];
  explanation: string;
  model_version: string;
}

export interface EventSummary {
  event_id: string;
  location_key?: string;
  centroid: { lat: number; lon: number };
  bbox: [number, number, number, number];
  pixel_count: number;
  first_seen: string;
  last_seen: string;
  status: EventStatus;
  observed: Observed;
  inferred: Inferred;
  limitations: string[];
}

export interface FrpPoint {
  ts: string;
  frp_mw: number;
  satellite: string;
  daynight: string;
  anomalous: boolean;
}

export interface Baseline {
  median_mw: number;
  band_low_mw: number;
  band_high_mw: number;
  n_history: number;
  /** "regional" means a fallback average, not this facility's own history. Say so in the chart. */
  source: 'facility' | 'regional' | string;
}

export interface Pixel {
  lat: number;
  lon: number;
  frp_mw: number;
  temp_k: number;
}

export interface EventDetail extends EventSummary {
  frp_series: FrpPoint[];
  baseline: Baseline | null;
  pixels: Pixel[];
  wind: {
    speed_kmh: number | null;
    bearing_deg: number | null;
    downwind_cone?: [number, number][];
  };
  /** Real geodesic distance in meters to nearest populated area (replaces synthetic population count). */
  dist_to_populated_m?: number | null;
  /** Real geodesic distance in meters to nearest critical infrastructure. */
  dist_to_infra_m?: number | null;
  /** Only populated in offline demo snapshot. */
  population_5km_exposure?: number | null;
  imagery: { before_url?: string | null; after_url?: string | null; acquired_at?: string | null } | null;
  timeline: { ts: string; event: string }[];
}

export interface FacilitySeries {
  facility_id: string;
  facility_name: string;
  n_history: number;
  source: string;
  baseline: { median_mw: number; band_low_mw: number; band_high_mw: number; iqr_mw?: number } | null;
  duty_cycle_30d?: number;
  days_active_last_30?: number;
  history: {
    timestamp: string;
    frp_mw: number;
    z_score: number;
    median_mw?: number;
    band_low_mw?: number;
    band_high_mw?: number;
    satellite?: string;
  }[];
}

export interface ArtifactInfo {
  filename: string;
  exists: boolean;
  loaded: boolean;
  size_bytes: number | null;
  modified_at: string | null;
}

export interface Health {
  status: string;
  mode: string;
  engine: string;
  server_time: string;
  data_as_of?: string | null;
  error?: string | null;
  missing_artifacts?: string[];
  active_events_count: number;
  model_versions: Record<string, string>;
  model_artifacts?: Record<string, ArtifactInfo>;
  firms_latency: string;
}

export type LinkState = 'connecting' | 'waking' | 'live' | 'cached';

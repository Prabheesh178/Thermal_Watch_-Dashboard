/**
 * Adapter Contract Verification Suite
 * ===================================
 * Feeds sample payloads matching `OUTPUT_SCHEMA.md` (`api/schemas.py`) into the
 * dashboard data adapter (`src/lib/api.ts`) and asserts that it produces valid
 * `EventSummary`, `EventDetail`, `FacilitySeries`, and `Health` objects without throwing,
 * while strictly preserving the observed vs. inferred split.
 */

import {
  adaptFacilityHistoryResponse,
  adaptHealthResponse,
  adaptHotspotDetailToEventDetail,
  adaptHotspotToEventSummary,
  type ApiFacilityHistoryResponse,
  type ApiHealthResponse,
  type ApiHotspotDetailResponse,
  type ApiHotspotResponse,
} from '../api';
import { CANONICAL_EVENT_TYPES, typeMeta } from '../design';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Contract assertion failed: ${message}`);
  }
}

export function runAdapterContractTests(): void {
  // 1. Sample /hotspots payload shaped like OUTPUT_SCHEMA.md
  const sampleHotspot: ApiHotspotResponse = {
    event_id: 'evt_20260904_0032',
    location_key: 'osm_way_1001',
    lat: 21.17,
    lon: 72.83,
    bbox: [72.828, 21.168, 72.832, 21.172],
    pixel_count: 2,
    first_seen: '2026-09-04T01:30:00Z',
    last_seen: '2026-09-04T13:30:00Z',
    observed: {
      frp: 42.3,
      frp_total: 78.4,
      frp_max: 42.3,
      brightness_ti4: 368.1,
      confidence: 87.0,
      acq_date: '2026-09-04',
      acq_time: '1330',
      daynight: 'N',
      satellite: 'SNPP',
      land_cover: 'built_up',
      nearest_industrial_type: 'refinery',
      nearest_industrial_name: 'Hazira Petrochemical Refinery',
      dist_to_industrial_m: 210.0,
    },
    inferred: {
      event_type: 'stockpile_combustion',
      event_type_confidence: 0.91,
      z_score: 3.45,
      is_anomalous: true,
      anomaly_score_normalized: 0.58,
      hazard_weight: 0.6,
      exposure_factor: 0.85,
      final_risk_score: 0.296,
      escalating_24h: false,
      risk_24h: 0.24,
      needs_manual_review: true,
      top_shap_features: [
        'dist_to_nearest_industrial_m',
        'night_detection_fraction',
        'daynight',
      ],
      top_shap_factors: [
        { feature: 'dist_to_nearest_industrial_m', direction: '+', weight: 0.42 },
        { feature: 'night_detection_fraction', direction: '+', weight: 0.31 },
        { feature: 'daynight', direction: '-', weight: 0.18 },
      ],
    },
  };

  const summary = adaptHotspotToEventSummary(sampleHotspot, 'model_a.joblib (2026-11-07)');

  assert(summary.event_id === 'evt_20260904_0032', 'event_id must match');
  assert(summary.location_key === 'osm_way_1001', 'location_key must match');
  assert(summary.pixel_count === 2, 'pixel_count must match');
  assert(summary.observed.frp_total_mw === 78.4, 'observed.frp_total_mw must match');
  assert(summary.observed.frp_max_mw === 42.3, 'observed.frp_max_mw must match');
  assert(summary.observed.bright_ti4_saturated === true, 'TI4 >= 367K must flag saturation');
  assert(summary.observed.cloud_cover_pct === null, 'cloud_cover_pct must be null (never fabricated)');
  assert(
    summary.observed.nearest_industrial?.name === 'Hazira Petrochemical Refinery',
    'nearest_industrial.name must map from observed',
  );
  assert(
    summary.inferred.event_type === 'stockpile_combustion',
    'canonical class stockpile_combustion must be preserved',
  );
  assert(summary.inferred.anomaly_z === 3.45, 'signed z_score must be preserved');
  assert(summary.inferred.anomaly_flag === true, 'is_anomalous must map to anomaly_flag');
  assert(summary.inferred.top_factors.length === 3, 'signed SHAP factors must map cleanly');
  assert(summary.inferred.top_factors[2].direction === '-', 'negative SHAP direction must be preserved');

  // Verify all 7 canonical classes have dedicated TypeMeta entries
  for (const cls of CANONICAL_EVENT_TYPES) {
    const meta = typeMeta(cls);
    assert(!meta.label.startsWith('Unrecognised'), `Class ${cls} must have explicit TypeMeta`);
  }

  // 2. Sample /hotspot/{event_id} + /facility/{location_key}/history payload shaped like OUTPUT_SCHEMA.md
  const sampleDetail: ApiHotspotDetailResponse = {
    ...sampleHotspot,
    pixels: [
      {
        lat: 21.169,
        lon: 72.829,
        frp: 42.3,
        brightness_ti4: 368.1,
        acq_date: '2026-09-04',
        acq_time: '1330',
      },
      {
        lat: 21.171,
        lon: 72.831,
        frp: 36.1,
        brightness_ti4: 352.4,
        acq_date: '2026-09-04',
        acq_time: '0130',
      },
    ],
    full_feature_vector: {
      frp: 42.3,
      bright_ti4: 368.1,
      bright_ti5: 305.1,
      confidence: 87.0,
      daynight: 'N',
      dist_to_nearest_industrial_m: 210.0,
      nearest_industrial_type: 'refinery',
      land_cover: 'built_up',
      temperature: 28.5,
      humidity: 68.0,
      wind_speed: 11.2,
      days_active_last_30: 14,
      night_detection_fraction: 0.58,
      month: 9,
      is_agri_burn_season: 0,
      frp_zscore_vs_facility_baseline: 3.45,
      dist_to_populated_area_m: 1200.0,
      dist_to_critical_infra_m: 350.0,
      cluster_growth_rate: 0.12,
    },
    class_probabilities: {
      industrial_flare: 0.03,
      industrial_accident: 0.02,
      stockpile_combustion: 0.91,
      known_false_positive: 0.0,
      wildfire: 0.01,
      agricultural_burn: 0.01,
      unknown_source: 0.02,
    },
  };

  const sampleHistory: ApiFacilityHistoryResponse = {
    location_key: 'osm_way_1001',
    median_frp: 22.0,
    mad_frp: 3.5,
    upper_3sigma_threshold: 37.57,
    lower_3sigma_threshold: 6.43,
    sample_count: 18,
    history: [
      { date: '2026-08-25', time: '0130', frp: 21.4, confidence: 85.0, daynight: 'N' },
      { date: '2026-09-04', time: '1330', frp: 42.3, confidence: 87.0, daynight: 'N' },
    ],
  };

  const detail = adaptHotspotDetailToEventDetail(sampleDetail, sampleHistory);

  assert(detail.pixels.length === 2, 'detail.pixels must contain constituent cluster pixels');
  assert(detail.frp_series.length === 2, 'detail.frp_series must map from facility history');
  assert(detail.frp_series[1].anomalous === true, 'FRP above upper_3sigma_threshold must flag anomalous');
  assert(detail.baseline !== null && detail.baseline.median_mw === 22.0, 'baseline must map median_frp');
  assert(detail.wind.speed_kmh === 11.2, 'wind.speed_kmh must map from full_feature_vector.wind_speed');
  assert(detail.wind.bearing_deg === null, 'wind.bearing_deg must be null when absent');
  assert(detail.dist_to_populated_m === 1200, 'dist_to_populated_m must map from full_feature_vector');
  assert(detail.population_5km_exposure === null, 'population_5km_exposure must not be fabricated');

  // 3. Sample /facility/{location_key}/history standalone adapter
  const facSeries = adaptFacilityHistoryResponse(sampleHistory, 'Hazira Petrochemical Refinery');
  assert(facSeries.facility_id === 'osm_way_1001', 'facility_id must match location_key');
  assert(facSeries.n_history === 18, 'n_history must match sample_count');

  // 4. Sample /health payload
  const sampleHealth: ApiHealthResponse = {
    status: 'ok',
    error: null,
    missing_artifacts: [],
    data_as_of: '2026-09-04T20:42:00Z',
    active_events_count: 12,
    model_artifacts: {
      model_a: {
        filename: 'model_a.joblib',
        exists: true,
        loaded: true,
        size_bytes: 418920,
        modified_at: '2026-11-07T12:30:00Z',
      },
    },
  };

  const health = adaptHealthResponse(sampleHealth);
  assert(health.status === 'ok', 'health.status must be ok');
  assert(health.data_as_of === '2026-09-04T20:42:00Z', 'health.data_as_of must be preserved');
  console.log('[Contract Test] PASS: All adapter contract assertions succeeded (EventSummary, EventDetail, FacilitySeries, Health).');
}

// Execute when run directly as a standalone test script
runAdapterContractTests();


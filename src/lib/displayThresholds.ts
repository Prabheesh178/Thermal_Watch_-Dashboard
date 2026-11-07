/**
 * UI DISPLAY & TRIAGE THRESHOLDS
 * ==============================
 * IMPORTANT: All constants in this file are frontend display and analyst triage
 * thresholds used by the dashboard adapter (`src/lib/api.ts`) to derive UI priority
 * badges, severity bars, and sensor limitation notices from real API fields.
 *
 * They are NOT machine-learning model parameters or model decision thresholds.
 */

export const DISPLAY_THRESHOLDS = {
  /**
   * Combined risk score (`inferred.final_risk_score`, 0.0 - 1.0) cutoffs for UI priority badges.
   */
  PRIORITY_HIGH_FINAL_RISK: 0.45,
  PRIORITY_MEDIUM_FINAL_RISK: 0.18,

  /**
   * 24h escalation probability (`inferred.risk_24h`, 0.0 - 1.0) cutoffs for UI priority badges.
   */
  PRIORITY_HIGH_RISK_24H: 0.65,
  PRIORITY_MEDIUM_RISK_24H: 0.35,

  /**
   * Model B robust z-score (`inferred.z_score`) cutoff for promoting an event to MEDIUM display priority.
   */
  PRIORITY_MEDIUM_Z_SCORE: 2.5,

  /**
   * VIIRS I4 band detector saturation temperature in Kelvin (`observed.brightness_ti4`).
   */
  VIIRS_I4_SATURATION_KELVIN: 367.0,

  /**
   * FIRMS confidence percentage (`observed.confidence`, 0 - 100) cutoffs for nominal vs high confidence.
   */
  CONFIDENCE_HIGH_PCT: 85.0,
  CONFIDENCE_LOW_PCT: 50.0,

  /**
   * Minimum historical observations at a `location_key` before Model B switches from
   * regional fallback baseline to facility-specific Median/MAD baseline.
   */
  MIN_FACILITY_HISTORY_SAMPLES: 10,

  /**
   * Maximum boundary distance in meters (`observed.dist_to_industrial_m`) to associate
   * a hotspot cluster with a named nearest industrial facility in the UI.
   */
  FACILITY_ASSOCIATION_MAX_DIST_M: 2000.0,

  /**
   * Cold-start timeout and waking indicator timings for Render free-tier instances.
   */
  API_WAKING_NOTICE_MS: 2500,
  API_COLD_START_TIMEOUT_MS: 55000,
  API_POLL_INTERVAL_MS: 30000,
} as const


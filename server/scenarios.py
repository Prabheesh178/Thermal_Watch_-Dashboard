"""
Thermal Watch // synthetic scenario bank.

Ported verbatim from the team's FastAPI mock
(Industrial-Fire-Persistent-Thermal-Source-Detection/mock_server.py) so the console
and the draft speak to identical data. Stdlib only — no pip install.

Scenarios: Jamnagar 11.3-sigma incident (hero), Jamnagar routine flare (suppression),
Odisha + Rajasthan unknown sources (NTRO novelty), Similipal wildfire, Korba/Mundra
industrial, Bhadla solar false positive, 200-event Punjab stubble stress test.
"""

import math
import random
from datetime import datetime, timedelta, timezone

JAMNAGAR_EVENT = {
    "event_id": "evt_jamnagar_incident_02",
    "centroid": {"lat": 22.4707, "lon": 70.0577},
    "bbox": [70.0489, 22.4639, 70.0625, 22.4775],
    "pixel_count": 3,
    "first_seen": (datetime.now(timezone.utc) - timedelta(hours=14)).isoformat(),
    "last_seen": datetime.now(timezone.utc).isoformat(),
    "status": "new",
    "observed": {
        "frp_total_mw": 412.6,
        "frp_max_mw": 268.1,
        "bright_ti4_max_k": 367.0,
        "bright_ti4_saturated": True,
        "confidence": "high",
        "daynight": "N",
        "sensor": "VIIRS",
        "satellite": "N20",
        "detection_count": 7,
        "land_cover": "built_up",
        "cloud_cover_pct": 12,
        "nearest_industrial": {
            "facility_id": "osm_w_123456",
            "name": "Jamnagar Refinery Complex",
            "type": "refinery",
            "distance_m": 0,
        },
    },
    "inferred": {
        "event_type": "industrial_incident",
        "event_type_confidence": 0.87,
        "anomaly_z": 11.3,
        "anomaly_flag": True,
        "novelty_flag": False,
        "risk_24h": 0.75,
        "severity": 84,
        "priority": "HIGH",
        "top_factors": [
            {"feature": "frp_zscore_vs_facility_baseline", "direction": "+", "weight": 0.34},
            {"feature": "delta_bt", "direction": "+", "weight": 0.21},
            {"feature": "dist_to_nearest_industrial_m", "direction": "-", "weight": 0.18},
            {"feature": "pixel_expansion_rate", "direction": "+", "weight": 0.14},
        ],
        "explanation": "FRP is 11.3 sigma above this facility's own 90-day baseline, at a site that normally flares steadily.",
        "model_version": "A:1.0.2 B:1.0.0 C:1.0.1",
    },
    "limitations": ["bright_ti4_saturated"],
    "pixels": [
        {"lat": 22.4707, "lon": 70.0577, "frp_mw": 268.1, "temp_k": 367.0},
        {"lat": 22.4721, "lon": 70.0592, "frp_mw": 89.3, "temp_k": 348.2},
        {"lat": 22.4695, "lon": 70.0560, "frp_mw": 55.2, "temp_k": 339.5},
    ],
    "wind": {
        "speed_kmh": 18.5,
        "bearing_deg": 65,
        "downwind_cone": [
            [70.0577, 22.4707],
            [70.0850, 22.4820],
            [70.0750, 22.4950],
            [70.0577, 22.4707],
        ],
    },
    "population_5km_exposure": 14200,
    "imagery": None,  # Defensively null: Awaiting tasked optical pass
}

NOVELTY_EVENT = {
    "event_id": "evt_ntro_novelty_01",
    "centroid": {"lat": 24.1840, "lon": 73.6890},
    "bbox": [73.6790, 24.1740, 73.6990, 24.1940],
    "pixel_count": 2,
    "first_seen": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
    "last_seen": datetime.now(timezone.utc).isoformat(),
    "status": "new",
    "observed": {
        "frp_total_mw": 184.2,
        "frp_max_mw": 132.0,
        "bright_ti4_max_k": 352.4,
        "bright_ti4_saturated": False,
        "confidence": "nominal",
        "daynight": "N",
        "sensor": "VIIRS",
        "satellite": "SNPP",
        "detection_count": 4,
        "land_cover": "sparse_vegetation",
        "cloud_cover_pct": 5,
        "nearest_industrial": None,  # Null facility
    },
    "inferred": {
        "event_type": "unknown_source",
        "event_type_confidence": 0.62,
        "anomaly_z": 7.8,
        "anomaly_flag": True,
        "novelty_flag": True,  # NTRO Novelty Radar trigger!
        "risk_24h": None,  # Model C deferred / null test
        "severity": 92,
        "priority": "HIGH",
        "top_factors": [
            {"feature": "absence_of_prior_thermal_history", "direction": "+", "weight": 0.45},
            {"feature": "non_industrial_isolated_coords", "direction": "+", "weight": 0.31},
            {"feature": "frp_spike_magnitude", "direction": "+", "weight": 0.24},
        ],
        "explanation": "Unregistered high-energy persistent thermal signature detected in remote corridor with zero historical baseline.",
        "model_version": "A:1.0.2 B:1.0.0 C:1.0.1",
    },
    "limitations": [],
    "pixels": [
        {"lat": 24.1840, "lon": 73.6890, "frp_mw": 132.0, "temp_k": 352.4},
        {"lat": 24.1852, "lon": 73.6905, "frp_mw": 52.2, "temp_k": 331.0},
    ],
    "wind": {
        "speed_kmh": 11.2,
        "bearing_deg": 135,
        "downwind_cone": [
            [73.6890, 24.1840],
            [73.7120, 24.1680],
            [73.7020, 24.1550],
            [73.6890, 24.1840],
        ],
    },
    "population_5km_exposure": 450,
    "imagery": None,
}

MUNDRA_FLARE = {
    "event_id": "evt_mundra_flare_03",
    "centroid": {"lat": 22.8396, "lon": 69.7042},
    "bbox": [69.6950, 22.8300, 69.7150, 22.8480],
    "pixel_count": 1,
    "first_seen": (datetime.now(timezone.utc) - timedelta(days=5)).isoformat(),
    "last_seen": datetime.now(timezone.utc).isoformat(),
    "status": "acknowledged",
    "observed": {
        "frp_total_mw": 48.5,
        "frp_max_mw": 48.5,
        "bright_ti4_max_k": 334.2,
        "bright_ti4_saturated": False,
        "confidence": "nominal",
        "daynight": "D",
        "sensor": "VIIRS",
        "satellite": "N20",
        "detection_count": 12,
        "land_cover": "industrial",
        "cloud_cover_pct": 20,
        "nearest_industrial": {
            "facility_id": "osm_w_987654",
            "name": "Mundra Thermal Power Plant",
            "type": "power_plant",
            "distance_m": 45,
        },
    },
    "inferred": {
        "event_type": "persistent_flare",
        "event_type_confidence": 0.94,
        "anomaly_z": 0.4,
        "anomaly_flag": False,
        "novelty_flag": False,
        "risk_24h": 0.08,
        "severity": 25,
        "priority": "LOW",
        "top_factors": [
            {"feature": "continuous_multi_day_signature", "direction": "+", "weight": 0.42},
            {"feature": "nominal_zscore_fit", "direction": "-", "weight": 0.38},
        ],
        "explanation": "Consistent flare operation aligned with 90-day facility historical bounds.",
        "model_version": "A:1.0.2 B:1.0.0 C:1.0.1",
    },
    "limitations": [],
    "pixels": [
        {"lat": 22.8396, "lon": 69.7042, "frp_mw": 48.5, "temp_k": 334.2},
    ],
    "wind": {"speed_kmh": 8.0, "bearing_deg": 220, "downwind_cone": []},
    "population_5km_exposure": 8200,
    "imagery": None,
}

KORBA_SUPER = {
    "event_id": "evt_korba_plant_04",
    "centroid": {"lat": 22.3595, "lon": 82.7501},
    "bbox": [82.7400, 22.3500, 82.7600, 22.3700],
    "pixel_count": 2,
    "first_seen": (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat(),
    "last_seen": datetime.now(timezone.utc).isoformat(),
    "status": "new",
    "observed": {
        "frp_total_mw": 112.4,
        "frp_max_mw": 84.0,
        "bright_ti4_max_k": 348.0,
        "bright_ti4_saturated": False,
        "confidence": "high",
        "daynight": "N",
        "sensor": "VIIRS",
        "satellite": "N20",
        "detection_count": 5,
        "land_cover": "industrial",
        "cloud_cover_pct": 35,
        "nearest_industrial": {
            "facility_id": "osm_w_554433",
            "name": "Korba Super Thermal Power Station",
            "type": "power_plant",
            "distance_m": 120,
        },
    },
    "inferred": {
        "event_type": "industrial_incident",
        "event_type_confidence": 0.79,
        "anomaly_z": 4.8,
        "anomaly_flag": True,
        "novelty_flag": False,
        "risk_24h": 0.58,
        "severity": 68,
        "priority": "MEDIUM",
        "top_factors": [
            {"feature": "frp_zscore_vs_facility_baseline", "direction": "+", "weight": 0.28},
            {"feature": "cloud_adjusted_intensity", "direction": "+", "weight": 0.19},
        ],
        "explanation": "Elevated thermal bloom 4.8 sigma above seasonal boiler baseline.",
        "model_version": "A:1.0.2 B:1.0.0 C:1.0.1",
    },
    "limitations": ["cloud_cover_high"],
    "pixels": [
        {"lat": 22.3595, "lon": 82.7501, "frp_mw": 84.0, "temp_k": 348.0},
        {"lat": 22.3610, "lon": 82.7520, "frp_mw": 28.4, "temp_k": 329.0},
    ],
    "wind": {"speed_kmh": 14.0, "bearing_deg": 40, "downwind_cone": []},
    "population_5km_exposure": 23000,
    "imagery": None,
}

SOLAR_FARM_FP = {
    "event_id": "evt_bhadla_solar_fp_01",
    "centroid": {"lat": 27.5385, "lon": 71.9174},
    "bbox": [71.9000, 27.5200, 71.9300, 27.5500],
    "pixel_count": 1,
    "first_seen": (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat(),
    "last_seen": datetime.now(timezone.utc).isoformat(),
    "status": "dismissed",
    "observed": {
        "frp_total_mw": 14.2,
        "frp_max_mw": 14.2,
        "bright_ti4_max_k": 321.0,
        "bright_ti4_saturated": False,
        "confidence": "low",
        "daynight": "D",
        "sensor": "VIIRS",
        "satellite": "SNPP",
        "detection_count": 2,
        "land_cover": "barren",
        "cloud_cover_pct": 0,
        "nearest_industrial": {
            "facility_id": "osm_w_solar_bhadla",
            "name": "Bhadla Solar Park",
            "type": "solar_farm",
            "distance_m": 0,
        },
    },
    "inferred": {
        "event_type": "known_false_positive",
        "event_type_confidence": 0.98,
        "anomaly_z": -0.2,
        "anomaly_flag": False,
        "novelty_flag": False,
        "risk_24h": 0.0,
        "severity": 0,
        "priority": "LOW",
        "top_factors": [
            {"feature": "photovoltaic_glint_spectral_profile", "direction": "-", "weight": 0.65},
            {"feature": "known_solar_array_geometry", "direction": "-", "weight": 0.28},
        ],
        "explanation": "Known false positive: specular solar reflection confirmed on photovoltaic array during midday pass.",
        "model_version": "A:1.0.2 B:1.0.0 C:1.0.1",
    },
    "limitations": [],
    "pixels": [{"lat": 27.5385, "lon": 71.9174, "frp_mw": 14.2, "temp_k": 321.0}],
    "wind": {"speed_kmh": 6.0, "bearing_deg": 180, "downwind_cone": []},
    "population_5km_exposure": 120,
    "imagery": None,
}

JAMNAGAR_FLARE_BASELINE = {
    "event_id": "evt_jamnagar_flare_baseline",
    "centroid": {"lat": 22.4680, "lon": 70.0540},
    "bbox": [70.0450, 22.4600, 70.0600, 22.4720],
    "pixel_count": 1,
    "first_seen": (datetime.now(timezone.utc) - timedelta(days=90)).isoformat(),
    "last_seen": datetime.now(timezone.utc).isoformat(),
    "status": "acknowledged",
    "observed": {
        "frp_total_mw": 34.2,
        "frp_max_mw": 34.2,
        "bright_ti4_max_k": 332.1,
        "bright_ti4_saturated": False,
        "confidence": "high",
        "daynight": "N",
        "sensor": "VIIRS",
        "satellite": "N20",
        "detection_count": 14,
        "land_cover": "built_up",
        "cloud_cover_pct": 8,
        "nearest_industrial": {
            "facility_id": "osm_w_123456",
            "name": "Jamnagar Refinery Complex",
            "type": "refinery",
            "distance_m": 0,
        },
    },
    "inferred": {
        "event_type": "persistent_flare",
        "event_type_confidence": 0.96,
        "anomaly_z": -0.1,
        "anomaly_flag": False,
        "novelty_flag": False,
        "risk_24h": 0.04,
        "severity": 6,
        "priority": "LOW",
        "top_factors": [
            {"feature": "90d_stable_emission_profile", "direction": "-", "weight": 0.52},
            {"feature": "refinery_elevated_stack_match", "direction": "-", "weight": 0.36},
        ],
        "explanation": "Normal operational flare stack emission within facility 90-day IQR bounds. Suppressed routine baseline.",
        "model_version": "A:1.0.2 B:1.0.0 C:1.0.1",
    },
    "limitations": [],
    "pixels": [{"lat": 22.4680, "lon": 70.0540, "frp_mw": 34.2, "temp_k": 332.1}],
    "wind": {"speed_kmh": 12.0, "bearing_deg": 80, "downwind_cone": []},
    "population_5km_exposure": 14200,
    "imagery": None,
}

ODISHA_UNKNOWN = {
    "event_id": "evt_odisha_unknown_01",
    "centroid": {"lat": 21.4820, "lon": 84.1450},
    "bbox": [84.1350, 21.4720, 84.1550, 21.4920],
    "pixel_count": 2,
    "first_seen": (datetime.now(timezone.utc) - timedelta(hours=4)).isoformat(),
    "last_seen": datetime.now(timezone.utc).isoformat(),
    "status": "new",
    "observed": {
        "frp_total_mw": 196.5,
        "frp_max_mw": 142.8,
        "bright_ti4_max_k": 356.2,
        "bright_ti4_saturated": False,
        "confidence": "high",
        "daynight": "N",
        "sensor": "VIIRS",
        "satellite": "N20",
        "detection_count": 4,
        "land_cover": "mixed_forest",
        "cloud_cover_pct": 14,
        "nearest_industrial": None,  # Null facility
    },
    "inferred": {
        "event_type": "unknown_source",
        "event_type_confidence": 0.74,
        "anomaly_z": 8.4,
        "anomaly_flag": True,
        "novelty_flag": True,
        "risk_24h": None,  # Model C awaiting
        "severity": 88,
        "priority": "HIGH",
        "top_factors": [
            {"feature": "unregistered_high_heat_flux", "direction": "+", "weight": 0.44},
            {"feature": "absence_of_prior_thermal_history", "direction": "+", "weight": 0.38},
            {"feature": "non_industrial_isolated_coords", "direction": "+", "weight": 0.22},
        ],
        "explanation": "NTRO Novelty Radar Alert: Unauthorized persistent thermal emission detected in remote Odisha corridor with zero registered facility footprint.",
        "model_version": "A:1.0.2 B:1.0.0 C:1.0.1",
    },
    "limitations": ["sparse_history", "no_facility_match"],
    "pixels": [
        {"lat": 21.4820, "lon": 84.1450, "frp_mw": 142.8, "temp_k": 356.2},
        {"lat": 21.4835, "lon": 84.1465, "frp_mw": 53.7, "temp_k": 338.0},
    ],
    "wind": {
        "speed_kmh": 15.0,
        "bearing_deg": 110,
        "downwind_cone": [
            [84.1450, 21.4820],
            [84.1720, 21.4710],
            [84.1610, 21.4580],
            [84.1450, 21.4820],
        ],
    },
    "population_5km_exposure": 840,
    "imagery": None,
}

SIMILIPAL_WILDFIRE = {
    "event_id": "evt_similipal_wildfire_12",
    "centroid": {"lat": 21.8840, "lon": 86.3420},
    "bbox": [86.3100, 21.8500, 86.3700, 21.9100],
    "pixel_count": 18,
    "first_seen": (datetime.now(timezone.utc) - timedelta(hours=18)).isoformat(),
    "last_seen": datetime.now(timezone.utc).isoformat(),
    "status": "new",
    "observed": {
        "frp_total_mw": 284.6,
        "frp_max_mw": 68.2,
        "bright_ti4_max_k": 344.5,
        "bright_ti4_saturated": False,
        "confidence": "high",
        "daynight": "D",
        "sensor": "VIIRS",
        "satellite": "SNPP",
        "detection_count": 18,
        "land_cover": "dense_forest",
        "cloud_cover_pct": 28,
        "nearest_industrial": None,
    },
    "inferred": {
        "event_type": "wildfire",
        "event_type_confidence": 0.91,
        "anomaly_z": 3.9,
        "anomaly_flag": True,
        "novelty_flag": False,
        "risk_24h": 0.62,
        "severity": 37,
        "priority": "MEDIUM",
        "top_factors": [
            {"feature": "cluster_growth_3_to_18_px", "direction": "+", "weight": 0.46},
            {"feature": "canopy_thermal_spread_vector", "direction": "+", "weight": 0.35},
        ],
        "explanation": "Similipal National Park wildfire perimeter expanding rapidly (cluster growth 3 -> 18 pixels over last two orbital overpasses).",
        "model_version": "A:1.0.2 B:1.0.0 C:1.0.1",
    },
    "limitations": ["cloud_cover_high"],
    "pixels": [
        {"lat": 21.8840, "lon": 86.3420, "frp_mw": 68.2, "temp_k": 344.5},
        {"lat": 21.8860, "lon": 86.3450, "frp_mw": 52.1, "temp_k": 339.0},
        {"lat": 21.8820, "lon": 86.3390, "frp_mw": 44.3, "temp_k": 336.2},
    ],
    "wind": {
        "speed_kmh": 22.0,
        "bearing_deg": 240,
        "downwind_cone": [
            [86.3420, 21.8840],
            [86.3100, 21.8650],
            [86.2950, 21.8800],
            [86.3420, 21.8840],
        ],
    },
    "population_5km_exposure": 3100,
    "imagery": None,
}

# Generate 200 Punjab agricultural stress-test events
PUNJAB_EVENTS = []
random.seed(42)
for i in range(1, 201):
    lat = 30.2 + random.uniform(0.0, 1.6)
    lon = 74.5 + random.uniform(0.0, 1.8)
    frp_mw = round(random.uniform(12.0, 78.0), 1)
    peak_mw = round(frp_mw * random.uniform(0.6, 0.95), 1)
    temp_k = round(random.uniform(315.0, 348.0), 1)
    priority = "LOW" if frp_mw < 45 else ("MEDIUM" if frp_mw < 70 else "HIGH")
    severity = int(frp_mw * 0.7 + random.randint(0, 15))
    severity = min(max(severity, 12), 78)

    p_evt = {
        "event_id": f"evt_punjab_agri_{i:03d}",
        "centroid": {"lat": round(lat, 4), "lon": round(lon, 4)},
        "bbox": [round(lon - 0.005, 4), round(lat - 0.005, 4), round(lon + 0.005, 4), round(lat + 0.005, 4)],
        "pixel_count": random.randint(1, 4),
        "first_seen": (datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 36))).isoformat(),
        "last_seen": datetime.now(timezone.utc).isoformat(),
        "status": "new",
        "observed": {
            "frp_total_mw": frp_mw,
            "frp_max_mw": peak_mw,
            "bright_ti4_max_k": temp_k,
            "bright_ti4_saturated": False,
            "confidence": "nominal" if frp_mw < 40 else "high",
            "daynight": random.choice(["D", "N"]),
            "sensor": "VIIRS",
            "satellite": random.choice(["N20", "SNPP"]),
            "detection_count": random.randint(1, 6),
            "land_cover": "cropland",
            "cloud_cover_pct": random.randint(0, 25),
            "nearest_industrial": None,  # Tests 98% null industrial facility rule!
        },
        "inferred": {
            "event_type": "agricultural_burn",
            "event_type_confidence": round(random.uniform(0.82, 0.98), 2),
            "anomaly_z": round(random.uniform(0.5, 2.8), 1),
            "anomaly_flag": False,
            "novelty_flag": False,
            "risk_24h": round(random.uniform(0.05, 0.35), 2) if i % 5 != 0 else None,  # Test null risk
            "severity": severity,
            "priority": priority,
            "top_factors": [
                {"feature": "cropland_seasonal_burn_pattern", "direction": "+", "weight": 0.48},
                {"feature": "rapid_cooling_diurnal_cycle", "direction": "+", "weight": 0.32},
            ],
            "explanation": f"Crop residue burning detected in Sangrur/Patiala agricultural belt with typical diurnal cooling.",
            "model_version": "A:1.0.2 B:1.0.0 C:1.0.1",
        },
        "limitations": [],
        "pixels": [{"lat": round(lat, 4), "lon": round(lon, 4), "frp_mw": peak_mw, "temp_k": temp_k}],
        "wind": {"speed_kmh": 12.0, "bearing_deg": 290, "downwind_cone": []},
        "population_5km_exposure": random.randint(1200, 8500),
        "imagery": None,
    }
    PUNJAB_EVENTS.append(p_evt)

# Master database of events
ALL_EVENTS = [
    JAMNAGAR_EVENT,
    JAMNAGAR_FLARE_BASELINE,
    ODISHA_UNKNOWN,
    SIMILIPAL_WILDFIRE,
    NOVELTY_EVENT,
    KORBA_SUPER,
    MUNDRA_FLARE,
    SOLAR_FARM_FP,
    *PUNJAB_EVENTS,
]

EVENTS_MAP = {e["event_id"]: e for e in ALL_EVENTS}

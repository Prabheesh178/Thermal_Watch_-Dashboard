"""
Thermal Watch // tactical telemetry mock API  (stdlib only — `python3 server/mock_api.py`)

Routes
  GET  /health                              service + model versions + FIRMS latency
  GET  /events?priority=&type=&since_hours=&limit=&bbox=
  GET  /events/{event_id}                   EventDetail (+ frp_series, baseline, wind, pixels)
  GET  /facility/{facility_id}/history?days=30
  GET  /risk?horizon=24h                    GeoJSON FeatureCollection
  POST /replay/start {speed, from_time, to_time}
  POST /replay/stop
  GET  /stream                              Server-Sent Events: ping | replay_tick | event_update

Data comes from server/scenarios.py, ported from the team's FastAPI mock so the wire
format is identical. Swapping to the real service = changing VITE_API_BASE, nothing else.
"""

import json
import math
import random
import sys
import time
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from scenarios import ALL_EVENTS, EVENTS_MAP  # noqa: E402

HOST, PORT = "127.0.0.1", 8000

REPLAY = {
    "active": False,
    "replay_id": None,
    "speed": 600,
    "start_time": time.time(),
    "virtual_time": (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat(),
}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def summary_of(event):
    return {k: v for k, v in event.items() if k not in ("pixels", "wind", "population_5km_exposure", "imagery")}


def frp_series_for(event, passes=60):
    """Deterministic VIIRS-cadence series (~01:30 / 13:30 local) for the drawer chart."""
    rng = random.Random(event["event_id"])
    base = max(6.0, event["observed"]["frp_total_mw"] * 0.12)
    spike = event["inferred"]["anomaly_flag"]
    now = datetime.now(timezone.utc)
    series = []
    for i in range(passes, 0, -1):
        ts = now - timedelta(hours=i * 12)
        jitter = math.sin(i * 0.45) * base * 0.22 + rng.uniform(-base * 0.12, base * 0.12)
        frp = max(2.0, base + jitter)
        anomalous = False
        if spike and i <= 2:
            frp = event["observed"]["frp_total_mw"] * (0.65 if i == 2 else 1.0)
            anomalous = True
        series.append({
            "ts": ts.isoformat(),
            "frp_mw": round(frp, 1),
            "satellite": "N20" if i % 2 == 0 else "SNPP",
            "daynight": "N" if i % 2 == 0 else "D",
            "anomalous": anomalous,
        })
    return series, base


def baseline_for(event, base):
    """Null when history is sparse — the frontend must still draw the series."""
    if event["observed"]["nearest_industrial"] is None and event["inferred"]["novelty_flag"]:
        return None
    facility = event["observed"]["nearest_industrial"] is not None
    return {
        "median_mw": round(base, 1),
        "band_low_mw": round(base * 0.72, 1),
        "band_high_mw": round(base * 1.34, 1),
        "n_history": 84 if facility else 22,
        "source": "facility" if facility else "regional",
    }


def detail_of(event):
    series, base = frp_series_for(event)
    detail = dict(event)
    detail["frp_series"] = series
    detail["baseline"] = baseline_for(event, base)
    detail["timeline"] = [
        {"ts": event["first_seen"], "event": "first_detection"},
        {"ts": event["first_seen"], "event": "clustered_dbscan_750m"},
        {"ts": event["last_seen"], "event": "classified_" + event["inferred"]["event_type"]},
        {"ts": event["last_seen"], "event": "severity_scored_%d" % event["inferred"]["severity"]},
    ]
    return detail


def facility_history(facility_id, days=30):
    if facility_id == "insufficient_baseline_facility":
        return {
            "facility_id": facility_id,
            "facility_name": "Newly Commissioned Site",
            "n_history": 4,
            "source": "Regional Fallback",
            "baseline": None,
            "history": [
                {"timestamp": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(), "frp_mw": 14.2, "z_score": 0.1},
                {"timestamp": now_iso(), "frp_mw": 28.5, "z_score": 1.1},
            ],
        }
    rng = random.Random(facility_id)
    is_jamnagar = "123456" in facility_id or "jamnagar" in facility_id.lower()
    base = 35.0 if is_jamnagar else 42.0
    now = datetime.now(timezone.utc)
    points = []
    for i in range(days * 2, 0, -1):
        ts = now - timedelta(hours=i * 12)
        frp = max(5.0, base + math.sin(i * 0.4) * 8.0 + rng.uniform(-4, 4))
        z = round((frp - base) / 12.0, 2)
        if is_jamnagar and i <= 2:
            frp = 268.1 if i == 2 else 412.6
            z = 11.3
        points.append({
            "timestamp": ts.isoformat(),
            "frp_mw": round(frp, 1),
            "median_mw": base,
            "band_low_mw": round(base - 12.0, 1),
            "band_high_mw": round(base + 15.0, 1),
            "z_score": z,
            "satellite": "VIIRS N20" if i % 2 == 0 else "VIIRS SNPP",
        })
    name = "Jamnagar Refinery Complex" if is_jamnagar else "Mundra Thermal Station"
    return {
        "facility_id": facility_id,
        "facility_name": name,
        "n_history": len(points),
        "source": "Facility Baseline",
        "baseline": {
            "median_mw": base, "iqr_mw": 18.5,
            "band_low_mw": round(base - 12.0, 1), "band_high_mw": round(base + 15.0, 1),
            "mean_mw": round(base + 2.0, 1), "std_mw": 14.1,
        },
        "duty_cycle_30d": 0.93 if is_jamnagar else 0.71,
        "days_active_last_30": 28 if is_jamnagar else 21,
        "history": points,
    }


RISK_GRID = {
    "type": "FeatureCollection",
    "features": [
        {"type": "Feature",
         "properties": {"zone_id": "zone_gujarat_petro", "name": "Jamnagar–Hazira Petrochemical Corridor",
                        "p_hotspot_24h": 0.82, "risk_score": 0.82, "risk_level": "HIGH", "active_sources": 4},
         "geometry": {"type": "Polygon", "coordinates": [[[69.8, 22.2], [70.5, 22.2], [70.6, 22.8], [69.9, 22.9], [69.8, 22.2]]]}},
        {"type": "Feature",
         "properties": {"zone_id": "zone_chhattisgarh_coal", "name": "Korba–Raigarh Thermal Belt",
                        "p_hotspot_24h": 0.64, "risk_score": 0.64, "risk_level": "MEDIUM", "active_sources": 7},
         "geometry": {"type": "Polygon", "coordinates": [[[82.3, 22.1], [83.4, 22.1], [83.3, 22.8], [82.4, 22.8], [82.3, 22.1]]]}},
        {"type": "Feature",
         "properties": {"zone_id": "zone_punjab_agri", "name": "Malwa Agri-Thermal Cluster",
                        "p_hotspot_24h": 0.41, "risk_score": 0.41, "risk_level": "LOW", "active_sources": 180},
         "geometry": {"type": "Polygon", "coordinates": [[[74.3, 30.0], [76.5, 30.0], [76.5, 31.5], [74.3, 31.5], [74.3, 30.0]]]}},
        {"type": "Feature",
         "properties": {"zone_id": "zone_odisha_corridor", "name": "Angul–Similipal Corridor",
                        "p_hotspot_24h": 0.57, "risk_score": 0.57, "risk_level": "MEDIUM", "active_sources": 3},
         "geometry": {"type": "Polygon", "coordinates": [[[84.0, 21.2], [86.6, 21.2], [86.6, 22.2], [84.0, 22.2], [84.0, 21.2]]]}},
    ],
}

FACILITIES = {
    "type": "FeatureCollection",
    "features": [
        {"type": "Feature", "properties": {"facility_id": "osm_w_123456", "name": "Jamnagar Refinery Complex", "type": "refinery", "duty_cycle_30d": 0.93},
         "geometry": {"type": "Point", "coordinates": [70.0577, 22.4707]}},
        {"type": "Feature", "properties": {"facility_id": "osm_w_987654", "name": "Mundra Thermal Power Plant", "type": "power_plant", "duty_cycle_30d": 0.71},
         "geometry": {"type": "Point", "coordinates": [69.7042, 22.8396]}},
        {"type": "Feature", "properties": {"facility_id": "osm_w_554433", "name": "Korba Super Thermal Power Station", "type": "power_plant", "duty_cycle_30d": 0.88},
         "geometry": {"type": "Point", "coordinates": [82.7501, 22.3595]}},
        {"type": "Feature", "properties": {"facility_id": "osm_w_solar_bhadla", "name": "Bhadla Solar Park", "type": "solar_farm", "duty_cycle_30d": 0.44},
         "geometry": {"type": "Point", "coordinates": [71.9174, 27.5385]}},
    ],
}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):  # quieter console
        pass

    # -- helpers ---------------------------------------------------------
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")

    def _json(self, payload, code=200):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    # -- routes ----------------------------------------------------------
    def do_GET(self):
        url = urlparse(self.path)
        path, q = url.path.rstrip("/") or "/", parse_qs(url.query)

        if path == "/health":
            return self._json({
                "status": "HEALTHY", "mode": "tactical_surveillance",
                "engine": "Thermal Watch Anomaly Detection Service",
                "server_time": now_iso(), "active_events_count": len(ALL_EVENTS),
                "model_versions": {"Model_A_Clustering": "1.0.2", "Model_B_Classification": "1.0.0", "Model_C_EscalationRisk": "1.0.1"},
                "firms_latency": "3h sync window",
            })

        if path == "/events":
            results = list(ALL_EVENTS)
            if "priority" in q:
                results = [e for e in results if e["inferred"]["priority"].upper() == q["priority"][0].upper()]
            if "type" in q:
                results = [e for e in results if e["inferred"]["event_type"] == q["type"][0]]
            if "bbox" in q:
                try:
                    w, s, e_, n = [float(v) for v in q["bbox"][0].split(",")]
                    results = [e for e in results if w <= e["centroid"]["lon"] <= e_ and s <= e["centroid"]["lat"] <= n]
                except ValueError:
                    pass
            limit = int(q.get("limit", ["300"])[0])
            return self._json([summary_of(e) for e in results[:limit]])

        if path.startswith("/events/"):
            eid = path.split("/events/", 1)[1]
            if eid not in EVENTS_MAP:
                return self._json({"detail": "Event %s not found" % eid}, 404)
            return self._json(detail_of(EVENTS_MAP[eid]))

        if path.startswith("/facility/") and path.endswith("/history"):
            fid = path[len("/facility/"):-len("/history")]
            return self._json(facility_history(fid, int(q.get("days", ["30"])[0])))

        if path == "/facilities":
            return self._json(FACILITIES)

        if path == "/risk":
            return self._json(RISK_GRID)

        if path == "/stream":
            return self._stream()

        return self._json({"detail": "not found"}, 404)

    def do_POST(self):
        url = urlparse(self.path)
        length = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            body = {}

        if url.path.rstrip("/") == "/replay/start":
            REPLAY.update({
                "active": True,
                "replay_id": "rep_%d" % int(time.time()),
                "speed": int(body.get("speed", 600)),
                "start_time": time.time(),
                "virtual_time": body.get("from_time") or (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat(),
            })
            return self._json({"replay_id": REPLAY["replay_id"], "speed": REPLAY["speed"],
                               "status": "RUNNING", "virtual_time": REPLAY["virtual_time"]})

        if url.path.rstrip("/") == "/replay/stop":
            REPLAY["active"] = False
            return self._json({"status": "STOPPED"})

        return self._json({"detail": "not found"}, 404)

    # -- SSE -------------------------------------------------------------
    def _stream(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self._cors()
        self.end_headers()
        step = 0
        rng = random.Random()
        try:
            while True:
                step += 1
                self._sse("ping", {"type": "ping", "server_time": now_iso()})

                if REPLAY["active"]:
                    elapsed = (time.time() - REPLAY["start_time"]) * REPLAY["speed"]
                    virtual = datetime.fromisoformat(REPLAY["virtual_time"].replace("Z", "+00:00")) + timedelta(seconds=elapsed)
                    progress = min(100.0, (elapsed / 86400.0) * 100.0)
                    self._sse("replay_tick", {
                        "type": "replay_tick", "replay_id": REPLAY["replay_id"], "speed": REPLAY["speed"],
                        "virtual_time": virtual.isoformat(), "progress_pct": progress,
                    })
                    if progress >= 100.0:
                        REPLAY["active"] = False
                        self._sse("replay_end", {"type": "replay_end"})

                if step % 2 == 0:
                    live = EVENTS_MAP["evt_jamnagar_incident_02"]
                    payload = summary_of(live)
                    payload = json.loads(json.dumps(payload))
                    payload["observed"]["frp_total_mw"] = round(412.6 + rng.uniform(-6.0, 9.0), 1)
                    payload["last_seen"] = now_iso()
                    self._sse("event_update", payload)

                time.sleep(2)
        except (BrokenPipeError, ConnectionResetError):
            return

    def _sse(self, name, data):
        chunk = ("event: %s\ndata: %s\n\n" % (name, json.dumps(data))).encode()
        self.wfile.write(chunk)
        self.wfile.flush()


if __name__ == "__main__":
    print("Thermal Watch mock API  ->  http://%s:%d   (%d synthetic events)" % (HOST, PORT, len(ALL_EVENTS)))
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()

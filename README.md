# Thermal Watch — National Thermal Anomaly Console

Operations console for **SIH26162 — AI-Based Detection and Classification of Industrial Fires and
Persistent Thermal Sources Using NASA FIRMS, OSM & Satellite Data** (NTRO).

It consumes the team's frozen event contract (`PRD_FRONTEND.md`, kept with the project docs), runs
against a zero-dependency mock of that contract, and switches to the real service by changing one
base URL.

```bash
python3 server/mock_api.py     # terminal 1 — http://127.0.0.1:8000, 208 synthetic events
npm install && npm run dev     # terminal 2 — http://127.0.0.1:3000
```

If the service is not running the console still opens: it falls back to a bundled snapshot of the
same payloads and says so in a banner. There is no second code path — the fallback is the same
wire format, served from `src/lib/snapshot.json`.

---

## What is on screen

| Zone | Contents |
|---|---|
| Classification strip | UNCLASSIFIED // FOUO marking, issuing organisation, UTC clock |
| Command bar | search, replay deck (1× / 10× / 60× / 600× + split-flap virtual clock), link state, **"FIRMS ≈ 3 h behind"**, model versions |
| Map canvas | severity-coloured events, novelty radar rings, FRP heat field, 24 h risk grid, OSM facilities, six basemaps |
| Left dock | layer toggles, classification mix, severity legend, basemap switcher |
| Triage queue | HIGH / MEDIUM / LOW groups sorted by severity, filters, acknowledge / dismiss, paginates at 40 rows |
| Detail drawer | header → **satellite evidence (observed)** → **model inference (inferred)** → FRP vs baseline → footprint → imagery → limitations → processing trail → export brief |

### The two rules from the PRD, enforced in code

1. **Events, not pixels.** One `event_id` is one marker and one queue row. Raw 375 m detections
   appear only inside the drawer's footprint mini-map (`FootprintMap.tsx`).
2. **`observed` and `inferred` never mix.** They are separate sections with different surfaces,
   different accents and different labels — neutral slate for what the satellite measured, violet
   for what the models estimated. A screenshot alone should make the split obvious.

### States that are actually built

Loading skeletons · empty queue · service unreachable (cached snapshot banner) · stale sync
(> 6 h) · cloud-obscured limitation badges · `nearest_industrial: null` → "No known facility" +
novelty badge · `baseline: null` → series drawn with an explicit "insufficient history" note ·
`risk_24h: null` → "n/a", never `0%` · unrecognised `event_type` → visible pink "unrecognised"
state, never a blank cell.

---

## Maps

MapLibre GL (open source, WebGL vector rendering). Six basemaps, all key-free:

| Basemap | Source | Note |
|---|---|---|
| Hybrid *(default)* | Esri World Imagery + CARTO dark labels | reads instantly at national zoom |
| Satellite | Esri World Imagery | optical truth, graded down for night-desk use |
| Obsidian | CARTO Dark Matter (vector), recoloured into the console palette | classic operations picture |
| Terrain | Esri World Topo | relief and contours |
| Streets | CARTO Voyager (vector) | infrastructure detail |
| Briefing | CARTO Positron (vector) | light basemap for printed briefs |

Vector styles are the better-looking option but some networks block CARTO's vector tile hosts, so
each carries a raster twin. `MapView.tsx` probes one vector tile at startup and silently swaps
every vector basemap to its raster twin if the probe fails — the console never shows a black
canvas. Attribution is rendered by the map's own control; do not remove it.

---

## Layout of the code

```
server/
  mock_api.py        stdlib HTTP + SSE server, 8 routes, no pip install
  scenarios.py       the 208-event synthetic bank, ported from the team's FastAPI mock
src/
  lib/
    types.ts         the wire contract
    api.ts           fetchers + cached-snapshot fallback
    useConsole.ts    single store: events, SSE, replay, filters, selection, stats
    design.ts        severity ramp, class metadata, limitation copy
    basemaps.ts      basemap definitions, vector→raster fallback, style tinting
    snapshot.json    generated offline snapshot (regenerate with the script below)
  components/        CommandBar · KpiStrip · MapView · MapControls · ClassMix
                     TriageRail · DetailDrawer · FrpChart · FootprintMap · Backdrop · BootSplash
  reactbits/         SplitFlapText · RotatingText · CountUp · CursorGrid · StrokeText
```

Regenerate the offline snapshot after changing scenarios:

```bash
python3 server/mock_api.py &
python3 - <<'PY'
import json, urllib.request
B = "http://127.0.0.1:8000"
get = lambda p: json.load(urllib.request.urlopen(B + p))
ids = ["evt_jamnagar_incident_02","evt_jamnagar_flare_baseline","evt_odisha_unknown_01",
       "evt_similipal_wildfire_12","evt_ntro_novelty_01","evt_korba_plant_04",
       "evt_mundra_flare_03","evt_bhadla_solar_fp_01"]
snap = {"generated_at": get("/health")["server_time"], "events": get("/events?limit=300"),
        "risk": get("/risk"), "facilities": get("/facilities"),
        "details": {i: get("/events/" + i) for i in ids},
        "facility_history": {f: get(f"/facility/{f}/history?days=45")
                             for f in ["osm_w_123456","osm_w_987654","osm_w_554433"]}}
open("src/lib/snapshot.json","w").write(json.dumps(snap, separators=(",", ":")))
PY
```

## Hosted build

The deployed build ships with the synthetic snapshot baked in and says so in the header
("SNAPSHOT DEMO" + a banner) — a page on https cannot reach a mock on localhost, so it does not
pretend to. Set `VITE_API_BASE` in the deployment's environment to point it at a live service and
the same build streams from that instead.

## Pointing at the real service

```bash
echo 'VITE_API_BASE=https://thermal-watch.onrender.com' > .env.local
```

Nothing else changes. `src/lib/api.ts` is the only file that knows the base URL exists.

---

## Design system

Glass over a moving dark ground: `rgba(255,255,255,0.045)` panels, 22 px backdrop blur, 1 px
hairline borders, 2xl radii. Neon is used as signal, never as decoration — cyan for system and
live state, violet for model inference and novelty, amber → ember → crimson for the severity ramp.
Inter for interface text, JetBrains Mono for every number, coordinate and timestamp.

Motion: drifting aurora and a cursor-reactive lattice in the background, a single scanline, split-
flap clocks, count-up KPIs, staggered panel entrances, pulsing halos on high-severity markers and a
conic radar sweep on unmapped sources. Everything respects `prefers-reduced-motion` through the
React Bits components' own guards.

React Bits components used, unmodified except for typing shims: `SplitFlapText` (status board and
replay clock), `StrokeText` (boot wordmark), `RotatingText` (mission subtitle), `CountUp` (KPI
tiles), `CursorGrid` (background lattice).

---

## Data provenance

Every number on screen is synthetic, generated by `server/scenarios.py` — the same bank the team's
FastAPI mock serves, covering the six demo scenarios: Jamnagar routine flare (suppressed),
Jamnagar 11.3σ incident, 200-event Punjab stubble stress test, Odisha and Rajasthan unmapped
sources, Similipal wildfire and the Bhadla solar false positive. The live ML pipeline is still in
development; the contract is what connects them.

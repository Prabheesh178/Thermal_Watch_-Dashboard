# Thermal Watch Dashboard — Model API Integration Guide (`INTEGRATION.md`)

This document describes how the **Thermal Watch** frontend console connects to the **Industrial Fire & Persistent Thermal Source Detection** FastAPI backend (`Prabheesh178/Industrial-Fire-Persistent-Thermal-Source-Detection`).

---

## 1. Architecture & Single Data Adapter (`src/lib/api.ts`)

All communication with the Model API is centralized in [`src/lib/api.ts`](./src/lib/api.ts), keeping UI components clean and strictly preserving the **Observed (Satellite Evidence)** vs. **Inferred (Model Predictions)** separation:

| Dashboard Call | Model API Endpoint | Purpose |
| :--- | :--- | :--- |
| `fetchHealth()` | `GET /health` | Checks model artifact readiness (`model_a.joblib`, `facility_baselines.json`, `model_c.joblib`), reads dynamic artifact filenames & modified timestamps, and retrieves `data_as_of` (max acquisition timestamp in the dataset). |
| `fetchRegions()` | `GET /regions` | Populates the Indian industrial region picker dropdown (`gujarat`, `maharashtra`, `odisha`, `chhattisgarh_jharkhand`, `all_india`) and flies the map camera to the selected region's bounding box. |
| `fetchFacilities()` | `GET /facilities` | Loads cached OpenStreetMap industrial, refinery, solar, landfill, and power facilities as a GeoJSON `FeatureCollection`. |
| `fetchEvents({ region })` | `GET /hotspots?region={region}&since_hours=...` | Loads aggregated thermal hotspot clusters (one record per unique `event_id`) with `observed` and `inferred` separation and signed SHAP attributions. |
| `fetchEventDetail(id)` | `GET /hotspot/{event_id}` + `GET /facility/{location_key}/history` | Populates the right-hand detail drawer: 375 m VIIRS pixel footprints, 19-feature vector values (`wind_speed`, `dist_to_populated_area_m`, `dist_to_critical_infra_m`), 7-class probabilities, signed SHAP drivers, and FRP vs. Median/MAD baseline chart. |
| `fetchFacilityHistory(id)` | `GET /facility/{location_key}/history` | Populates the standalone Facility History modal (`FacilityView.tsx`). |

### Display Thresholds (`src/lib/displayThresholds.ts`)
All UI triage and display cutoffs (priority badge thresholds, 367 K VIIRS I4 saturation flag, confidence labels, sparse history cutoff) are isolated in [`src/lib/displayThresholds.ts`](./src/lib/displayThresholds.ts) and documented as frontend display thresholds rather than ML model parameters.

### Canonical 7 Event Classes (`src/lib/design.ts`)
When connected to the real Model API (`link === 'live'`), the dashboard uses the 7 canonical classes produced by Model A:
1. `industrial_accident` (`Industrial Accident`, `#FF3B4E`)
2. `industrial_flare` (`Industrial Flare`, `#FBBF24`)
3. `stockpile_combustion` (`Stockpile Combustion`, `#F97316`)
4. `wildfire` (`Wildfire`, `#FF6B2C`)
5. `agricultural_burn` (`Agricultural Burn`, `#34D399`)
6. `known_false_positive` (`Known False Positive`, `#64748B`)
7. `unknown_source` (`Unknown Source`, `#C084FC`)

Legacy class names (`industrial_incident`, `persistent_flare`) are retained only for the offline demo fallback (`snapshot.json`).

---

## 2. Running Locally (Model API + Dashboard)

### Step 1: Start the Model API (`industrial-fire-detection`)
Ensure you have trained the model artifacts (`python -m models.train_all --region gujarat --days 30`) so `artifacts/model_a.joblib`, `artifacts/facility_baselines.json`, and `artifacts/model_c.joblib` exist. Then run:

```bash
cd ../industrial-fire-detection
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

Verify the API is healthy at `http://localhost:8000/health`.

### Step 2: Configure & Start the Dashboard (`Thermal-Watch-SIH-2026`)
1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Confirm `VITE_API_URL=http://localhost:8000` is set.
2. Install dependencies and start Vite:
   ```bash
   npm install
   npm run dev
   ```
3. Open `http://localhost:5173`.
   - The top bar will show **`MODEL API CONNECTED`** and **`Data as of <timestamp>`**.
   - Use the **Region Picker** dropdown in the top command bar to switch between `Gujarat`, `Maharashtra`, `Odisha`, `Chhattisgarh & Jharkhand`, and `All India`.

---

## 3. Deploying to Vercel (Dashboard) + Render (Model API)

1. **Deploy the Model API to Render** following `DEPLOY_RENDER.md` in the model repository. Copy your Render URL (e.g. `https://industrial-fire-detection-api.onrender.com`).
2. **Import the Dashboard Repository into Vercel**:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Environment Variable:
     ```ini
     VITE_API_URL=https://industrial-fire-detection-api.onrender.com
     ```
3. **Update `CORS_ORIGINS` on Render**:
   - In your Render service's Environment tab, set:
     ```ini
     CORS_ORIGINS=https://your-dashboard.vercel.app,http://localhost:5173
     ```

### Cold-Start & Offline Fallback Behavior
- **Render Free-Tier Cold Start (`Waking the API...`)**: Free Render instances sleep after 15 minutes of inactivity and take 30–60 seconds to wake. If the initial fetch takes longer than 2.5 seconds, the dashboard shows a visible **`Waking the API...`** banner and waits up to 55 seconds before timing out.
- **Offline Fallback (`Demo data, API not connected`)**: If the API is unreachable or model artifacts have not been trained yet (`HTTP 503`), the dashboard falls back to `src/lib/snapshot.json` and displays a prominent banner reading **`Demo data, API not connected`**.

---

## 4. Summary of Hardcoded Values Removed / Replaced

| File | Removed Hardcoded Value | Replacement |
| :--- | :--- | :--- |
| `src/components/CommandBar.tsx` | `"Synthetic demonstration data"` in top classification strip | Dynamic: shows `"Data as of <timestamp>"` from `/health` in live mode and `"Demo data, API not connected"` in offline mode |
| `src/components/CommandBar.tsx` | `'models A 1.0.2 · B 1.0.0 · C 1.0.1'` | Dynamic artifact filenames and UTC modified timestamps read from `GET /health` (`model_artifacts`) |
| `src/components/CommandBar.tsx` | `"FIRMS ≈ 3 h behind"` | Dynamic `"Data as of <timestamp>"` currency badge from `/health` |
| `src/App.tsx` | `"Hosted demo — bundled synthetic snapshot, 208 events"` and `"python3 server/mock_api.py"` | Required banner text `"Demo data, API not connected"` with dynamic event count (`state.events.length`) or API error diagnostic |
| `src/components/MobileShell.tsx` | `'models A 1.0.2 · B 1.0.0 · C 1.0.1'` and `"Hosted demo — bundled synthetic snapshot"` | Dynamic artifact metadata from `/health` and `"Demo data, API not connected"` banner |
| `src/components/DetailDrawer.tsx` | `THERMAL WATCH — EVENT BRIEF (synthetic demonstration data)` in downloaded brief | Dynamic provenance (`model API · data as of ...` vs `Demo data, API not connected`) |
| `src/components/DetailDrawer.tsx` | `cloud_cover_pct` (`%`) and `population_5km_exposure` (`people within 5 km`) | Renders `"n/a"` when `cloud_cover_pct` is `null`; renders real geodesic distance to nearest populated area (`dist_to_populated_m`) from `full_feature_vector` |
| `src/components/FootprintMap.tsx` | `wind ... @ <bearing_deg>°` and downwind cone | Hides downwind cone and bearing degree when `bearing_deg` is `null` |


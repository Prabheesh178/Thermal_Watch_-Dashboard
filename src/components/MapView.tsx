import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { Map as MLMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { EventSummary } from '../lib/types';
import { severityColor } from '../lib/design';
import { tintVectorStyle, VECTOR_BASEMAP_IDS, VECTOR_PROBE, type Basemap } from '../lib/basemaps';

const INDIA_VIEW = { center: [79.2, 22.6] as [number, number], zoom: 4.15 };

interface Props {
  events: EventSummary[];
  risk: any;
  facilities: any;
  basemap: Basemap;
  layers: { events: boolean; risk: boolean; facilities: boolean; heat: boolean };
  selectedId: string | null;
  onSelect: (id: string) => void;
  focus: { lat: number; lon: number; zoom?: number } | null;
}

function eventsGeoJSON(events: EventSummary[]) {
  return {
    type: 'FeatureCollection',
    features: events.map((e) => ({
      type: 'Feature',
      id: e.event_id,
      properties: {
        event_id: e.event_id,
        severity: e.inferred.severity,
        tone: severityColor(e.inferred.severity),
        frp: e.observed.frp_total_mw,
        type: e.inferred.event_type,
        novelty: e.inferred.novelty_flag ? 1 : 0,
        priority: e.inferred.priority,
        facility: e.observed.nearest_industrial?.name ?? 'No known facility',
      },
      geometry: { type: 'Point', coordinates: [e.centroid.lon, e.centroid.lat] },
    })),
  } as GeoJSON.FeatureCollection;
}

export default function MapView({
  events,
  risk,
  facilities,
  basemap,
  layers,
  selectedId,
  onSelect,
  focus,
}: Props) {
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const ready = useRef(false);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const basemapRef = useRef(basemap);
  basemapRef.current = basemap;
  // Basemaps whose primary (vector) tiles failed; they run on their raster twin instead.
  const [degradedIds, setDegradedIds] = useState<string[]>([]);
  const appliedStyle = useRef<unknown>(null);

  const effectiveStyle =
    degradedIds.includes(basemap.id) && basemap.fallback ? basemap.fallback : basemap.style;

  const data = useMemo(() => eventsGeoJSON(events), [events]);

  // Only the handful worth animating get DOM markers; the other ~200 stay on GPU circles.
  const notable = useMemo(
    () => events.filter((e) => e.inferred.novelty_flag || e.inferred.severity >= 68).slice(0, 24),
    [events],
  );

  /* ---------- vector reachability probe ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(VECTOR_PROBE, { signal: AbortSignal.timeout(4500) });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        if (!cancelled) setDegradedIds((prev) => Array.from(new Set([...prev, ...VECTOR_BASEMAP_IDS])));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------- init ---------- */
  useEffect(() => {
    if (!holder.current || map.current) return;
    const m = new maplibregl.Map({
      container: holder.current,
      style: basemap.style as any,
      center: INDIA_VIEW.center,
      zoom: INDIA_VIEW.zoom,
      attributionControl: { compact: true },
      maxZoom: 17,
      minZoom: 2.6,
      dragRotate: true,
      pitchWithRotate: true,
    });
    map.current = m;
    appliedStyle.current = basemap.style;
    if (import.meta.env.DEV) (window as any).__map = m;
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    m.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-left');

    const paint = () => {
      ready.current = true;
      if (basemapRef.current.tint) tintVectorStyle(m as any);
      addLayers(m);
      pushData(m);
    };
    m.on('style.load', paint);

    // Some networks block CARTO's vector tile hosts. Rather than showing a black
    // canvas, drop to the basemap's raster twin the first time tiles fail.
    m.on('error', () => {
      const current = basemapRef.current;
      if (!current.fallback) return;
      setDegradedIds((prev) => (prev.includes(current.id) ? prev : [...prev, current.id]));
    });

    return () => {
      markers.current.forEach((mk) => mk.remove());
      markers.current = [];
      m.remove();
      map.current = null;
      ready.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- basemap switching ---------- */
  useEffect(() => {
    const m = map.current;
    if (!m || appliedStyle.current === effectiveStyle) return;
    appliedStyle.current = effectiveStyle;
    ready.current = false;
    m.setStyle(effectiveStyle as any, { diff: false });
  }, [effectiveStyle]);

  /* ---------- sources + layers ---------- */
  function addLayers(m: MLMap) {
    if (!m.getSource('events')) {
      m.addSource('events', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    }
    if (!m.getSource('risk')) {
      m.addSource('risk', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    }
    if (!m.getSource('facilities')) {
      m.addSource('facilities', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    }

    if (!m.getLayer('risk-fill')) {
      m.addLayer({
        id: 'risk-fill',
        type: 'fill',
        source: 'risk',
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'p_hotspot_24h'],
            0, '#1E3A8A',
            0.45, '#0EA5E9',
            0.7, '#F59E0B',
            1, '#FF3B4E',
          ],
          'fill-opacity': 0.14,
        },
      });
      m.addLayer({
        id: 'risk-line',
        type: 'line',
        source: 'risk',
        paint: { 'line-color': '#38BDF8', 'line-width': 1, 'line-opacity': 0.5, 'line-dasharray': [3, 2] },
      });
    }

    if (!m.getLayer('events-heat')) {
      m.addLayer({
        id: 'events-heat',
        type: 'heatmap',
        source: 'events',
        maxzoom: 11,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'frp'], 0, 0.05, 400, 1],
          'heatmap-intensity': 0.9,
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 3, 18, 10, 46],
          'heatmap-opacity': 0.55,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.2, 'rgba(56,189,248,0.35)',
            0.45, 'rgba(250,204,21,0.5)',
            0.7, 'rgba(255,107,44,0.65)',
            1, 'rgba(255,59,78,0.85)',
          ],
        },
      });
    }

    if (!m.getLayer('events-glow')) {
      m.addLayer({
        id: 'events-glow',
        type: 'circle',
        source: 'events',
        paint: {
          'circle-color': ['get', 'tone'],
          'circle-radius': ['interpolate', ['linear'], ['get', 'severity'], 0, 6, 50, 12, 100, 22],
          'circle-opacity': 0.22,
          'circle-blur': 1,
        },
      });
      m.addLayer({
        id: 'events-core',
        type: 'circle',
        source: 'events',
        paint: {
          'circle-color': ['get', 'tone'],
          'circle-radius': ['interpolate', ['linear'], ['get', 'severity'], 0, 2.6, 50, 4.4, 100, 6.5],
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(4,6,11,0.85)',
          'circle-opacity': 0.95,
        },
      });
      m.addLayer({
        id: 'events-selected',
        type: 'circle',
        source: 'events',
        filter: ['==', ['get', 'event_id'], '___none___'],
        paint: {
          'circle-color': 'rgba(0,0,0,0)',
          'circle-radius': 13,
          'circle-stroke-width': 1.6,
          'circle-stroke-color': '#F8FAFC',
        },
      });
    }

    if (!m.getLayer('facility-dot')) {
      m.addLayer({
        id: 'facility-dot',
        type: 'circle',
        source: 'facilities',
        paint: {
          'circle-color': 'rgba(125,211,252,0.18)',
          'circle-radius': 7,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#7DD3FC',
        },
      });
    }

    // Hover + click affordances
    const hit = ['events-core', 'events-glow'];
    hit.forEach((id) => {
      m.on('mouseenter', id, () => (m.getCanvas().style.cursor = 'pointer'));
      m.on('mouseleave', id, () => (m.getCanvas().style.cursor = ''));
      m.on('click', id, (e) => {
        const f = e.features?.[0];
        if (f) selectRef.current(String(f.properties?.event_id));
      });
    });
  }

  function pushData(m: MLMap) {
    (m.getSource('events') as maplibregl.GeoJSONSource | undefined)?.setData(data);
    if (risk) (m.getSource('risk') as maplibregl.GeoJSONSource | undefined)?.setData(risk);
    if (facilities) (m.getSource('facilities') as maplibregl.GeoJSONSource | undefined)?.setData(facilities);
  }

  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    pushData(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, risk, facilities]);

  /* ---------- layer visibility ---------- */
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    const set = (id: string, on: boolean) => {
      if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    };
    set('events-glow', layers.events);
    set('events-core', layers.events);
    set('events-selected', layers.events);
    set('events-heat', layers.heat);
    set('risk-fill', layers.risk);
    set('risk-line', layers.risk);
    set('facility-dot', layers.facilities);
    markers.current.forEach((mk) => {
      mk.getElement().style.display = layers.events ? '' : 'none';
    });
  }, [layers, basemap, data]);

  /* ---------- animated markers for the events that matter ---------- */
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current = [];

    notable.forEach((e) => {
      const tone = severityColor(e.inferred.severity);
      const el = document.createElement('div');
      el.className = 'tw-marker';
      el.dataset.selected = String(selectedId === e.event_id);
      el.style.setProperty('--tone', tone);
      el.style.setProperty('--size', `${e.inferred.severity >= 80 ? 15 : 12}px`);
      el.innerHTML = `
        <span class="tw-marker__halo"></span>
        ${e.inferred.novelty_flag ? '<span class="tw-marker__novelty"></span>' : ''}
        <span class="tw-marker__core"></span>`;
      el.title = `${e.event_id} · sev ${e.inferred.severity}`;
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        selectRef.current(e.event_id);
      });
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([e.centroid.lon, e.centroid.lat])
        .addTo(m);
      markers.current.push(marker);
    });
  }, [notable, selectedId]);

  /* ---------- selection ring ---------- */
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current || !m.getLayer('events-selected')) return;
    m.setFilter('events-selected', ['==', ['get', 'event_id'], selectedId ?? '___none___']);
  }, [selectedId, data, basemap]);

  /* ---------- camera ---------- */
  useEffect(() => {
    const m = map.current;
    if (!m || !focus) return;
    m.flyTo({
      center: [focus.lon, focus.lat],
      zoom: focus.zoom ?? Math.max(m.getZoom(), 7.2),
      speed: 0.9,
      curve: 1.5,
      essential: true,
    });
  }, [focus]);

  return (
    <div className="absolute inset-0">
      <div
        ref={holder}
        className="absolute inset-0 transition-[filter] duration-700"
        style={{ filter: basemap.filter }}
      />
      {/* Bright basemaps get dimmed so the severity ramp stays the brightest thing on screen. */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-700"
        style={{ background: '#04060B', opacity: basemap.dim }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(130%_95%_at_50%_10%,transparent_45%,rgba(4,6,11,0.8)_100%)]" />
      {/* scrims: the glass chrome needs a darker ground to stay legible over imagery */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[230px] bg-gradient-to-b from-[#04060B]/95 via-[#04060B]/60 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[300px] bg-gradient-to-r from-[#04060B]/80 via-[#04060B]/25 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[120px] bg-gradient-to-t from-[#04060B]/75 to-transparent" />
    </div>
  );
}

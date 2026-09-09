import { useEffect, useRef } from 'react';
import maplibregl, { Map as MLMap } from 'maplibre-gl';
import type { EventDetail } from '../lib/types';
import { severityColor } from '../lib/design';
import { BASEMAPS } from '../lib/basemaps';

const SAT = BASEMAPS.find((b) => b.id === 'satellite')!;
const PIXEL_M = 375; // VIIRS nominal footprint

function squareAround(lat: number, lon: number, metres = PIXEL_M) {
  const dLat = metres / 2 / 111_320;
  const dLon = metres / 2 / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [
    [lon - dLon, lat - dLat],
    [lon + dLon, lat - dLat],
    [lon + dLon, lat + dLat],
    [lon - dLon, lat + dLat],
    [lon - dLon, lat - dLat],
  ];
}

/** 375 m detection footprints over optical imagery, with the wind cone when we have one. */
export default function FootprintMap({ detail }: { detail: EventDetail }) {
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<MLMap | null>(null);

  useEffect(() => {
    if (!holder.current || map.current) return;
    const m = new maplibregl.Map({
      container: holder.current,
      style: SAT.style as any,
      center: [detail.centroid.lon, detail.centroid.lat],
      zoom: 12.4,
      attributionControl: false,
      interactive: true,
      dragRotate: false,
    });
    map.current = m;

    m.on('load', () => {
      const tone = severityColor(detail.inferred.severity);

      m.addSource('pixels', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: (detail.pixels ?? []).map((p) => ({
            type: 'Feature',
            properties: { frp: p.frp_mw, temp: p.temp_k },
            geometry: { type: 'Polygon', coordinates: [squareAround(p.lat, p.lon)] },
          })),
        } as any,
      });
      m.addLayer({
        id: 'pixel-fill',
        type: 'fill',
        source: 'pixels',
        paint: { 'fill-color': tone, 'fill-opacity': 0.28 },
      });
      m.addLayer({
        id: 'pixel-line',
        type: 'line',
        source: 'pixels',
        paint: { 'line-color': tone, 'line-width': 1.2, 'line-opacity': 0.9 },
      });

      const cone = detail.wind?.downwind_cone;
      if (cone && cone.length > 2) {
        m.addSource('cone', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [cone] },
          } as any,
        });
        m.addLayer({
          id: 'cone-fill',
          type: 'fill',
          source: 'cone',
          paint: { 'fill-color': '#38BDF8', 'fill-opacity': 0.14 },
        });
        m.addLayer({
          id: 'cone-line',
          type: 'line',
          source: 'cone',
          paint: { 'line-color': '#7DD3FC', 'line-width': 1, 'line-dasharray': [2, 2], 'line-opacity': 0.7 },
        });
        m.fitBounds(
          cone.reduce(
            (b, c) => b.extend(c as [number, number]),
            new maplibregl.LngLatBounds(cone[0] as [number, number], cone[0] as [number, number]),
          ),
          { padding: 34, duration: 0 },
        );
      }
    });

    return () => {
      m.remove();
      map.current = null;
    };
  }, [detail.event_id]);

  return (
    <div className="relative h-[190px] overflow-hidden rounded-xl border border-white/[0.08]">
      <div ref={holder} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_0%,transparent_50%,rgba(4,6,11,0.6)_100%)]" />
      <div className="pointer-events-none absolute bottom-1.5 left-2 font-mono text-[8.5px] uppercase tracking-[0.16em] text-white/55">
        {detail.pixels?.length ?? 0} × 375 m footprints · Esri imagery
      </div>
      {detail.wind && (
        <div className="pointer-events-none absolute right-2 top-2 rounded-md border border-white/12 bg-black/45 px-2 py-1 font-mono text-[9px] text-white/75 backdrop-blur">
          wind {detail.wind.speed_kmh} km/h @ {detail.wind.bearing_deg}°
        </div>
      )}
    </div>
  );
}

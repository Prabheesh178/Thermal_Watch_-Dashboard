import type { StyleSpecification } from 'maplibre-gl';

/**
 * Every basemap here is key-free and openly licensed: CARTO styles over OSM data,
 * Esri World Imagery / World Topo for optical and relief. Attribution is rendered by
 * the map's own control — do not strip it.
 *
 * Vector styles look better (crisp labels, rotation, no tile seams) but some networks
 * block CARTO's vector tile hosts. Each vector basemap therefore carries a raster twin
 * in `fallback`, which MapView swaps in automatically if tiles fail to load.
 */
export interface Basemap {
  id: string;
  label: string;
  hint: string;
  /** Swatch shown in the Google-Maps-style switcher. */
  swatch: string;
  style: string | StyleSpecification;
  fallback?: StyleSpecification;
  /** Bright basemaps are dimmed so the thermal ramp stays the brightest thing on screen. */
  dim: number;
  /** CSS filter applied to the canvas — imagery is graded, never shown raw. */
  filter?: string;
  /** Vector styles get recoloured into the console palette after they load. */
  tint?: boolean;
}

const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const ESRI_ATTR =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a>, DeLorme, NAVTEQ, TomTom, &copy; OpenStreetMap contributors';

function rasterStyle(
  tiles: string[],
  attribution: string,
  overlay?: { tiles: string[]; attribution: string },
): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    sources: {
      base: { type: 'raster', tiles, tileSize: 256, attribution, maxzoom: 19 },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#04060B' } },
      { id: 'base', type: 'raster', source: 'base', paint: { 'raster-opacity': 1 } },
    ],
  };
  if (overlay) {
    (style.sources as any).labels = {
      type: 'raster',
      tiles: overlay.tiles,
      tileSize: 256,
      attribution: overlay.attribution,
      maxzoom: 20,
    };
    style.layers.push({ id: 'labels', type: 'raster', source: 'labels', paint: { 'raster-opacity': 0.9 } });
  }
  return style;
}

const ESRI_DARK_GRAY_BASE = [
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
];
const ESRI_DARK_GRAY_REF = [
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
];
const ESRI_IMAGERY = [
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
];
const ESRI_BOUNDARIES = [
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
];
const OSM_TILES = [
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
];

export const BASEMAPS: Basemap[] = [
  {
    id: 'obsidian',
    label: 'Obsidian',
    hint: 'Dark canvas — default operating picture (clean, watermark-free)',
    swatch: 'linear-gradient(135deg,#0b1018,#1b2434 60%,#0a3b45)',
    style: rasterStyle(ESRI_DARK_GRAY_BASE, ESRI_ATTR, {
      tiles: ESRI_DARK_GRAY_REF,
      attribution: ESRI_ATTR,
    }),
    fallback: rasterStyle(ESRI_DARK_GRAY_BASE, ESRI_ATTR),
    dim: 0,
    tint: false,
  },
  {
    id: 'satellite',
    label: 'Satellite',
    hint: 'Esri World Imagery — optical truth',
    swatch: 'linear-gradient(135deg,#22331b,#4a5b2c 45%,#7a6a45)',
    style: rasterStyle(ESRI_IMAGERY, ESRI_ATTR),
    dim: 0.12,
    filter: 'brightness(0.6) saturate(0.75) contrast(1.12)',
  },
  {
    id: 'hybrid',
    label: 'Hybrid',
    hint: 'Imagery with place names and borders',
    swatch: 'linear-gradient(135deg,#2a3a24,#556236 45%,#9aa3ad)',
    style: rasterStyle(ESRI_IMAGERY, ESRI_ATTR, {
      tiles: ESRI_BOUNDARIES,
      attribution: ESRI_ATTR,
    }),
    dim: 0.14,
    filter: 'brightness(0.58) saturate(0.72) contrast(1.12)',
  },
  {
    id: 'terrain',
    label: 'Terrain',
    hint: 'Relief, contours and land cover',
    swatch: 'linear-gradient(135deg,#2b3a2b,#6b7a52 50%,#c9b98f)',
    style: rasterStyle(
      ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'],
      ESRI_ATTR,
    ),
    dim: 0.3,
    filter: 'brightness(0.6) saturate(0.68) contrast(1.06)',
  },
  {
    id: 'streets',
    label: 'Streets',
    hint: 'OpenStreetMap — infrastructure detail',
    swatch: 'linear-gradient(135deg,#dfe6ee,#b9c6d4 55%,#8fa4b8)',
    style: rasterStyle(OSM_TILES, OSM_ATTR),
    fallback: rasterStyle(OSM_TILES, OSM_ATTR),
    dim: 0.25,
    filter: 'brightness(0.85) saturate(0.75)',
  },
  {
    id: 'briefing',
    label: 'Briefing',
    hint: 'Light basemap for printed briefs',
    swatch: 'linear-gradient(135deg,#f2f5f8,#d8dfe6 55%,#aab6c2)',
    style: rasterStyle(
      ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'],
      ESRI_ATTR,
      {
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}'],
        attribution: ESRI_ATTR,
      },
    ),
    fallback: rasterStyle(
      ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'],
      ESRI_ATTR,
    ),
    dim: 0.18,
    filter: 'brightness(0.94) saturate(0.7)',
  },
];

/** Obsidian dark vector reads instantly at national zoom without any API key or watermark. */
export const DEFAULT_BASEMAP = BASEMAPS.find((b) => b.id === 'obsidian') ?? BASEMAPS[0];


/**
 * Recolour a CARTO vector style into the console palette: deep navy water, a graphite
 * landmass, cyan administrative boundaries, muted labels. Without this, Dark Matter at
 * national zoom is a black rectangle with dots on it.
 */
export function tintVectorStyle(map: {
  getStyle: () => StyleSpecification;
  setPaintProperty: (layer: string, prop: string, value: unknown) => void;
}) {
  const style = map.getStyle();
  if (!style?.layers) return;
  const set = (id: string, prop: string, value: unknown) => {
    try {
      map.setPaintProperty(id, prop, value);
    } catch {
      /* layer absent in this style — nothing to recolour */
    }
  };

  style.layers.forEach((layer) => {
    const id = layer.id;
    if (layer.type === 'background') set(id, 'background-color', '#070B12');
    else if (/^water$|water_shadow|^waterway$/.test(id)) {
      set(id, layer.type === 'line' ? 'line-color' : 'fill-color', '#0A1524');
    } else if (/landcover|landuse|park/.test(id)) {
      set(id, 'fill-color', '#0C121B');
      set(id, 'fill-opacity', 0.9);
    } else if (/boundary_country/.test(id)) {
      set(id, 'line-color', 'rgba(125,211,252,0.55)');
      set(id, 'line-width', 0.9);
    } else if (/boundary_state|boundary_county/.test(id)) {
      set(id, 'line-color', 'rgba(125,211,252,0.22)');
    } else if (/^road|bridge|tunnel|rail/.test(id)) {
      set(id, 'line-color', '#161D28');
    } else if (/building/.test(id)) {
      set(id, 'fill-color', '#141B25');
    } else if (layer.type === 'symbol') {
      set(id, 'text-color', '#7C8CA3');
      set(id, 'text-halo-color', 'rgba(4,6,11,0.9)');
      set(id, 'text-halo-width', 1.1);
    }
  });
}

/**
 * One vector tile, fetched once at startup. If it does not come back the network
 * blocks CARTO's vector hosts, and every vector basemap switches to its raster twin
 * before the user ever sees an empty canvas.
 */
export const VECTOR_PROBE = 'https://tiles-a.basemaps.cartocdn.com/vectortiles/carto.streets/v1/4/11/6.mvt';

export const VECTOR_BASEMAP_IDS = BASEMAPS.filter((b) => b.fallback).map((b) => b.id);

import type { CanonicalEventType, DemoEventType, EventType, Priority } from './types';

/** Continuous severity ramp: cold slate -> ice -> amber -> ember -> crimson. */
export function severityColor(severity: number): string {
  const s = Math.max(0, Math.min(100, severity)) / 100;
  const stops: [number, [number, number, number]][] = [
    [0.0, [96, 116, 140]],
    [0.25, [56, 189, 248]],
    [0.5, [250, 204, 21]],
    [0.75, [255, 107, 44]],
    [1.0, [255, 59, 78]],
  ];
  let a = stops[0];
  let b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (s >= stops[i][0] && s <= stops[i + 1][0]) {
      a = stops[i];
      b = stops[i + 1];
      break;
    }
  }
  const t = b[0] === a[0] ? 0 : (s - a[0]) / (b[0] - a[0]);
  const mix = a[1].map((v, i) => Math.round(v + (b[1][i] - v) * t));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

export interface TypeMeta {
  label: string;
  glyph: string;
  accent: string;
  blurb: string;
}

/**
 * Canonical 7 classes used in live mode when connected to the Model API.
 */
export const CANONICAL_EVENT_TYPES: CanonicalEventType[] = [
  'industrial_accident',
  'industrial_flare',
  'stockpile_combustion',
  'wildfire',
  'agricultural_burn',
  'known_false_positive',
  'unknown_source',
];

/**
 * Legacy 6 class names retained strictly for the offline demo snapshot (`snapshot.json`).
 */
export const DEMO_EVENT_TYPES: DemoEventType[] = [
  'industrial_incident',
  'persistent_flare',
  'wildfire',
  'agricultural_burn',
  'known_false_positive',
  'unknown_source',
];

/** Every enum handled explicitly. Unknown values render a visible "unrecognised" state. */
export const TYPE_META: Record<EventType, TypeMeta> = {
  // Canonical 7 model classes
  industrial_accident: {
    label: 'Industrial Accident',
    glyph: '◈',
    accent: '#FF3B4E',
    blurb: 'Off-baseline emergency heat at a mapped plant',
  },
  industrial_flare: {
    label: 'Industrial Flare',
    glyph: '▲',
    accent: '#FBBF24',
    blurb: 'Routine industrial burn-off within facility baseline',
  },
  stockpile_combustion: {
    label: 'Stockpile Combustion',
    glyph: '◆',
    accent: '#F97316',
    blurb: 'Sustained coal, sulphur, or solid-waste stockpile fire',
  },
  wildfire: {
    label: 'Wildfire',
    glyph: '❋',
    accent: '#FF6B2C',
    blurb: 'Spreading forest or vegetation fire',
  },
  agricultural_burn: {
    label: 'Agricultural Burn',
    glyph: '≋',
    accent: '#34D399',
    blurb: 'Seasonal crop residue burning',
  },
  known_false_positive: {
    label: 'Known False Positive',
    glyph: '⊘',
    accent: '#64748B',
    blurb: 'Catalogued solar or industrial reflector — scored to zero',
  },
  unknown_source: {
    label: 'Unknown Source',
    glyph: '◎',
    accent: '#C084FC',
    blurb: 'Thermal signature with no mapped facility',
  },
  // Legacy aliases for offline demo mode only
  industrial_incident: {
    label: 'Industrial Incident',
    glyph: '◈',
    accent: '#FF3B4E',
    blurb: 'Off-baseline heat at a mapped plant',
  },
  persistent_flare: {
    label: 'Persistent Flare',
    glyph: '▲',
    accent: '#FBBF24',
    blurb: 'Routine industrial burn-off, suppressed',
  },
};

export function typeMeta(type: string): TypeMeta {
  return (
    TYPE_META[type as EventType] ?? {
      label: `Unrecognised (${type})`,
      glyph: '?',
      accent: '#F472B6',
      blurb: 'Class not known to this build — backend shipped a new label',
    }
  );
}

export const PRIORITY_META: Record<Priority, { ring: string; text: string; dot: string }> = {
  HIGH: { ring: 'border-[#FF3B4E]/40 bg-[#FF3B4E]/10', text: 'text-[#FF8A96]', dot: '#FF3B4E' },
  MEDIUM: { ring: 'border-[#FBBF24]/35 bg-[#FBBF24]/10', text: 'text-[#FCD34D]', dot: '#FBBF24' },
  LOW: { ring: 'border-white/10 bg-white/[0.04]', text: 'text-slate-400', dot: '#64748B' },
};

export const LIMITATION_LABEL: Record<string, string> = {
  cloud_cover_moderate: 'Moderate cloud cover',
  cloud_cover_high: 'Heavy cloud cover — confidence reduced',
  low_confidence: 'Low detection confidence',
  bright_ti4_saturated: 'Sensor saturated — true temperature is at or above the reading',
  sparse_history: 'Sparse history — baseline is weak',
  no_facility_match: 'No mapped facility within search radius',
};

export const CONFIDENCE_META: Record<string, { label: string; tone: string }> = {
  high: { label: 'High', tone: 'text-neon-mint' },
  nominal: { label: 'Nominal', tone: 'text-neon-ice' },
  low: { label: 'Low', tone: 'text-neon-amber' },
};

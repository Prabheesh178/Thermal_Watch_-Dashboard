import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Factory, Flame, Grid3x3, Layers, Map as MapIcon, Waves } from 'lucide-react';
import { BASEMAPS, type Basemap } from '../lib/basemaps';
import { severityColor } from '../lib/design';

/* ---------------- basemap switcher (Google-Maps style, bottom-left) --------------- */

export function BasemapSwitcher({
  active,
  onChange,
}: {
  active: Basemap;
  onChange: (b: Basemap) => void;
}) {
  const [open, setOpen] = useState(false);
  const others = BASEMAPS.filter((b) => b.id !== active.id);

  return (
    <div className="pointer-events-auto flex items-end gap-2" onMouseLeave={() => setOpen(false)}>
      <button
        onMouseEnter={() => setOpen(true)}
        onClick={() => setOpen((v) => !v)}
        className="group relative h-[68px] w-[92px] overflow-hidden rounded-xl border border-white/15 shadow-glass transition
                   hover:border-neon-cyan/45"
        style={{ background: active.swatch }}
        title={active.hint}
      >
        <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <span className="absolute bottom-1 left-0 right-0 text-center font-mono text-[9.5px] uppercase tracking-[0.14em] text-white">
          {active.label}
        </span>
        <span className="absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-md bg-black/45 text-white/80 backdrop-blur">
          <MapIcon size={11} />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="glass flex gap-2 rounded-2xl p-2"
          >
            {others.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  onChange(b);
                  setOpen(false);
                }}
                title={b.hint}
                className="group relative h-[56px] w-[76px] overflow-hidden rounded-lg border border-white/12 transition
                           hover:border-neon-cyan/50 hover:shadow-[0_0_26px_-8px_rgba(34,211,238,0.9)]"
                style={{ background: b.swatch }}
              >
                <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <span className="absolute bottom-1 left-0 right-0 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-white/90">
                  {b.label}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- layer dock ---------------- */

export interface LayerFlags {
  events: boolean;
  risk: boolean;
  facilities: boolean;
  heat: boolean;
}

const LAYER_ROWS: { key: keyof LayerFlags; label: string; note: string; icon: JSX.Element; tone: string }[] = [
  { key: 'events', label: 'Thermal events', note: 'clustered, severity-coloured', icon: <Flame size={12} />, tone: '#FF6B2C' },
  { key: 'heat', label: 'FRP density', note: 'radiative power heat field', icon: <Waves size={12} />, tone: '#FBBF24' },
  { key: 'risk', label: '24 h risk grid', note: 'Model C — off by default', icon: <Grid3x3 size={12} />, tone: '#38BDF8' },
  { key: 'facilities', label: 'OSM facilities', note: 'mapped industrial sites', icon: <Factory size={12} />, tone: '#7DD3FC' },
];

export function LayerDock({
  layers,
  onChange,
  hasRiskLayer = false,
}: {
  layers: LayerFlags;
  onChange: (l: LayerFlags) => void;
  hasRiskLayer?: boolean;
}) {
  const visibleRows = LAYER_ROWS.filter((r) => (r.key === 'risk' ? hasRiskLayer : true));
  const activeCount = visibleRows.filter((r) => layers[r.key]).length;

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
        <Layers size={12} className="text-neon-cyan" />
        <span className="label !text-slate-300">Surveillance layers</span>
        <span className="ml-auto font-mono text-[9.5px] text-slate-600">
          {activeCount}/{visibleRows.length}
        </span>
      </div>

      <div className="space-y-0.5 p-1.5">
        {visibleRows.map((row) => {
          const on = layers[row.key];
          return (
            <button
              key={row.key}
              onClick={() => onChange({ ...layers, [row.key]: !on })}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.05]"
            >
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md border transition"
                style={{
                  borderColor: on ? `${row.tone}66` : 'rgba(255,255,255,0.09)',
                  background: on ? `${row.tone}1F` : 'transparent',
                  color: on ? row.tone : '#475569',
                }}
              >
                {row.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[11.5px] ${on ? 'text-slate-200' : 'text-slate-500'}`}>
                  {row.label}
                </span>
                <span className="block truncate font-mono text-[9px] text-slate-600">{row.note}</span>
              </span>
              <span
                className="relative h-3.5 w-7 shrink-0 rounded-full transition"
                style={{ background: on ? `${row.tone}55` : 'rgba(255,255,255,0.08)' }}
              >
                <span
                  className="absolute top-[2px] h-2.5 w-2.5 rounded-full transition-all duration-200"
                  style={{ left: on ? 16 : 3, background: on ? row.tone : '#64748B' }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- legend ---------------- */

export function Legend() {
  const stops = [0, 20, 40, 60, 80, 100];
  return (
    <div className="glass rounded-2xl px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="label !text-slate-300">Severity</span>
        <span className="font-mono text-[9px] text-slate-600">0 — 100</span>
      </div>
      <div
        className="mt-2 h-1.5 rounded-full"
        style={{ background: `linear-gradient(90deg, ${stops.map((s) => severityColor(s)).join(',')})` }}
      />
      <div className="mt-1 flex justify-between font-mono text-[9px] text-slate-600">
        <span>suppressed</span>
        <span>watch</span>
        <span>critical</span>
      </div>
      <div className="mt-2.5 flex items-center gap-2 border-t border-white/[0.06] pt-2">
        <span className="relative grid h-4 w-4 place-items-center">
          <span className="absolute inset-0 rounded-full border border-neon-violet/70" />
          <span className="h-1.5 w-1.5 rounded-full bg-neon-violet" />
        </span>
        <span className="font-mono text-[9.5px] text-slate-500">radar ring = unmapped source</span>
      </div>
    </div>
  );
}

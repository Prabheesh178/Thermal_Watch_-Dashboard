import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronLeft,
  CloudOff,
  Crosshair,
  Flame,
  Globe2,
  Layers,
  Map as MapIcon,
  MoreHorizontal,
  Pause,
  Play,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import type { ConsoleState } from '../lib/useConsole';
import { DEMO_MODE } from '../lib/api';
import { timeAgo } from '../lib/format';
import { BASEMAPS, type Basemap } from '../lib/basemaps';
import { LayerDock, Legend, type LayerFlags } from './MapControls';
import ClassMix from './ClassMix';
import BottomSheet, { type SheetSnap } from './BottomSheet';

const SPEEDS = [1, 10, 60, 600];

/* ------------------------------------------------------------------ top bar */

export function MobileTopBar({
  state,
  onOpenMenu,
}: {
  state: ConsoleState;
  onOpenMenu: () => void;
}) {
  const { link, lastSync, replay, toggleReplay, stale } = state;
  const tone =
    link === 'live'
      ? { dot: '#34D399', label: 'LIVE' }
      : link === 'connecting'
        ? { dot: '#FBBF24', label: 'LINKING' }
        : DEMO_MODE
          ? { dot: '#7DD3FC', label: 'SNAPSHOT' }
          : { dot: '#FF6B2C', label: 'CACHED' };

  return (
    <header className="glass-quiet relative z-30 shrink-0 border-b border-white/[0.07] pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-neon-cyan/30 bg-neon-cyan/10">
          <Flame size={14} className="text-neon-cyan" />
        </div>
        <div className="min-w-0 leading-none">
          <div className="truncate text-[13.5px] font-semibold tracking-tight text-slate-50">Thermal Watch</div>
          <div className="mt-0.5 flex items-center gap-1 font-mono text-[8.5px] uppercase tracking-[0.14em] text-slate-500">
            <span className="h-1 w-1 rounded-full" style={{ background: tone.dot }} />
            <span style={{ color: tone.dot }}>{tone.label}</span>
            <span>·</span>
            <span className={stale ? 'text-neon-amber' : ''}>
              {lastSync ? timeAgo(lastSync) : 'no sync'}
            </span>
          </div>
        </div>

        <button
          onClick={() => void toggleReplay(replay.speed)}
          data-active={replay.active}
          className="btn-glass ml-auto !px-2.5 !py-1.5"
          aria-label={replay.active ? 'Pause replay' : 'Start replay'}
        >
          {replay.active ? <Pause size={12} /> : <Play size={12} />}
          {replay.active ? `${replay.speed}×` : 'Replay'}
        </button>
        <button onClick={onOpenMenu} className="btn-glass !px-2 !py-1.5" aria-label="More controls">
          <MoreHorizontal size={14} />
        </button>
      </div>

      {state.link === 'cached' && (
        <div
          className={`flex items-center gap-1.5 px-3 pb-1.5 font-mono text-[9px] uppercase tracking-[0.12em] ${
            DEMO_MODE ? 'text-neon-ice' : 'text-neon-ember'
          }`}
        >
          <CloudOff size={10} />
          {DEMO_MODE ? 'Hosted demo — bundled synthetic snapshot' : 'Service unreachable — cached snapshot'}
        </div>
      )}
    </header>
  );
}

/* --------------------------------------------------------------- sheet shell */

function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/55 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-quiet max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-white/[0.1]
                       pb-[calc(env(safe-area-inset-bottom)+12px)]"
          >
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-white/[0.07]
                            bg-[#070B12]/85 px-3.5 py-2.5 backdrop-blur-xl">
              <span className="label !text-slate-300">{title}</span>
              <button onClick={onClose} className="btn-glass ml-auto !px-2 !py-1" aria-label="Close">
                <X size={12} />
              </button>
            </div>
            <div className="p-3">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------ map overlays */

export function MobileMapControls({
  layers,
  onLayersChange,
  basemap,
  onBasemapChange,
  state,
  onNationalView,
}: {
  layers: LayerFlags;
  onLayersChange: (l: LayerFlags) => void;
  basemap: Basemap;
  onBasemapChange: (b: Basemap) => void;
  state: ConsoleState;
  onNationalView: () => void;
}) {
  const [sheet, setSheet] = useState<null | 'layers' | 'basemap'>(null);

  return (
    <>
      <div className="pointer-events-auto absolute right-2.5 top-[150px] z-20 flex flex-col gap-2">
        <button
          onClick={() => setSheet('layers')}
          className="glass grid h-10 w-10 place-items-center rounded-xl text-neon-cyan"
          aria-label="Layers"
        >
          <Layers size={16} />
        </button>
        <button
          onClick={() => setSheet('basemap')}
          className="glass grid h-10 w-10 place-items-center rounded-xl text-slate-200"
          aria-label="Basemap"
        >
          <MapIcon size={16} />
        </button>
        <button
          onClick={onNationalView}
          className="glass grid h-10 w-10 place-items-center rounded-xl text-slate-200"
          aria-label="National view"
        >
          <Globe2 size={16} />
        </button>
      </div>

      <Sheet open={sheet === 'layers'} onClose={() => setSheet(null)} title="Layers & legend">
        <div className="space-y-2.5">
          <LayerDock layers={layers} onChange={onLayersChange} />
          <Legend />
          <ClassMix state={state} />
        </div>
      </Sheet>

      <Sheet open={sheet === 'basemap'} onClose={() => setSheet(null)} title="Basemap">
        <div className="grid grid-cols-3 gap-2">
          {BASEMAPS.map((b) => (
            <button
              key={b.id}
              onClick={() => {
                onBasemapChange(b);
                setSheet(null);
              }}
              className={`relative h-[70px] overflow-hidden rounded-xl border transition ${
                b.id === basemap.id ? 'border-neon-cyan/60 shadow-neon' : 'border-white/12'
              }`}
              style={{ background: b.swatch }}
            >
              <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
              <span className="absolute bottom-1 left-0 right-0 text-center font-mono text-[9px] uppercase tracking-[0.1em] text-white">
                {b.label}
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

/* --------------------------------------------------------------- menu sheet */

export function MobileMenu({
  open,
  onClose,
  state,
}: {
  open: boolean;
  onClose: () => void;
  state: ConsoleState;
}) {
  const { filters, setFilters, replay, toggleReplay, reload, health, stats } = state;

  return (
    <Sheet open={open} onClose={onClose} title="Console controls">
      <div className="space-y-4">
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-3 text-slate-500" />
          <input
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            placeholder="Search facility, event id, class…"
            className="h-11 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-9 pr-3 font-mono text-[13px]
                       text-slate-200 placeholder:text-slate-600 outline-none focus:border-neon-cyan/40"
          />
        </div>

        <div>
          <div className="label mb-1.5">Replay speed</div>
          <div className="flex gap-1.5">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => void toggleReplay(s)}
                data-active={replay.active && replay.speed === s}
                className="btn-glass flex-1 justify-center !py-2"
              >
                {s}×
              </button>
            ))}
          </div>
          {replay.active && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-neon-amber to-neon-ember transition-all"
                style={{ width: `${replay.progress}%` }}
              />
            </div>
          )}
        </div>

        <button onClick={() => void reload()} className="btn-glass w-full justify-center !py-2.5">
          <RefreshCw size={13} /> Re-poll the service
        </button>

        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 font-mono text-[10px] leading-relaxed text-slate-500">
          <div>FIRMS publishes ≈ 3 h behind the overpass — this console never implies live coverage.</div>
          <div className="mt-1.5 text-slate-400">
            {health
              ? `models A ${health.model_versions.Model_A_Clustering} · B ${health.model_versions.Model_B_Classification} · C ${health.model_versions.Model_C_EscalationRisk}`
              : 'models A 1.0.2 · B 1.0.0 · C 1.0.1'}
          </div>
          <div className="text-slate-400">{stats.total} events in the current window</div>
        </div>
      </div>
    </Sheet>
  );
}

/* -------------------------------------------------------- scenarios + queue */

export function MobileScenarioRow({
  scenarios,
  selectedId,
  onSelect,
}: {
  scenarios: { id: string; label: string; tone: string; zoom: number }[];
  selectedId: string | null;
  onSelect: (id: string, zoom: number) => void;
}) {
  return (
    <div className="scroll-thin pointer-events-auto flex gap-1.5 overflow-x-auto px-2.5 pb-1">
      <span className="label flex shrink-0 items-center gap-1 pr-0.5">
        <Crosshair size={9} />
      </span>
      {scenarios.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id, s.zoom)}
          data-active={selectedId === s.id}
          className="btn-glass shrink-0 !py-1.5 backdrop-blur-xl"
          style={selectedId === s.id ? { borderColor: `${s.tone}66`, color: s.tone } : undefined}
        >
          <span style={{ color: s.tone }}>●</span>
          {s.label}
        </button>
      ))}
    </div>
  );
}

export function MobileQueueSheet({
  state,
  snap,
  onSnapChange,
  children,
}: {
  state: ConsoleState;
  snap: SheetSnap;
  onSnapChange: (s: SheetSnap) => void;
  children: React.ReactNode;
}) {
  return (
    <BottomSheet
      snap={snap}
      onSnapChange={onSnapChange}
      header={
        <div className="flex items-baseline gap-2 px-0.5 pb-2">
          <span className="text-[13px] font-semibold tracking-tight text-slate-100">Triage queue</span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">
            {state.visible.length} in window
          </span>
          <span className="ml-auto font-mono text-[9.5px] text-slate-600">
            {snap === 'peek' ? 'drag up' : snap === 'full' ? 'drag down' : ''}
          </span>
        </div>
      }
    >
      {children}
    </BottomSheet>
  );
}

/* ------------------------------------------------------- full-screen detail */

export function MobileDetailScreen({
  open,
  onBack,
  children,
}: {
  open: boolean;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 420, damping: 42 }}
          className="fixed inset-0 z-40 flex flex-col bg-[#070B12] pt-[env(safe-area-inset-top)]"
        >
          <button
            onClick={onBack}
            className="flex shrink-0 items-center gap-1.5 border-b border-white/[0.07] px-3 py-2.5
                       font-mono text-[11px] uppercase tracking-[0.14em] text-slate-300"
          >
            <ChevronLeft size={15} /> Back to map
          </button>
          <div className="min-h-0 flex-1">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

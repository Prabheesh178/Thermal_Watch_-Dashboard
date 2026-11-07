import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  CloudOff,
  Flame,
  MapPin,
  Pause,
  Play,
  RefreshCw,
  Satellite,
  Search,
} from 'lucide-react';
import SplitFlapText from '../reactbits/SplitFlapText';
import RotatingText from '../reactbits/RotatingText';
import type { ConsoleState } from '../lib/useConsole';
import { clock, utc } from '../lib/format';

const SPEEDS = [1, 10, 60, 600];

export default function CommandBar({
  state,
  onSelectRegion,
}: {
  state: ConsoleState;
  onSelectRegion?: (regionName: string) => void;
}) {
  const {
    link,
    dataAsOf,
    health,
    regions,
    selectedRegion,
    setSelectedRegion,
    replay,
    toggleReplay,
    filters,
    setFilters,
    reload,
    stats,
  } = state;
  const [utcClock, setUtcClock] = useState(clock());
  const [speed, setSpeed] = useState(600);

  useEffect(() => {
    const id = setInterval(() => setUtcClock(clock()), 1000);
    return () => clearInterval(id);
  }, []);

  const linkTone =
    link === 'live'
      ? { dot: '#34D399', label: 'MODEL API CONNECTED', text: 'text-neon-mint' }
      : link === 'waking'
        ? { dot: '#FBBF24', label: 'WAKING THE API...', text: 'text-neon-amber' }
        : link === 'connecting'
          ? { dot: '#FBBF24', label: 'CONNECTING...', text: 'text-neon-amber' }
          : { dot: '#FF6B2C', label: 'DEMO DATA · OFFLINE', text: 'text-neon-ember' };

  const artifactSummary = (() => {
    if (link === 'live' && health?.model_artifacts) {
      const a = health.model_artifacts.model_a;
      const b = health.model_artifacts.facility_baselines;
      const c = health.model_artifacts.model_c;
      const parts: string[] = [];
      if (a?.exists) parts.push(`${a.filename}${a.modified_at ? ` (${a.modified_at.slice(0, 10)})` : ''}`);
      if (b?.exists) parts.push(`${b.filename}`);
      if (c?.exists) parts.push(`${c.filename}`);
      if (parts.length > 0) return parts.join(' · ');
    }
    return link === 'cached' ? 'Demo data, API not connected' : 'Loading model artifacts...';
  })();

  const handleRegionChange = (nextRegion: string) => {
    if (onSelectRegion) {
      onSelectRegion(nextRegion);
    } else {
      setSelectedRegion(nextRegion);
    }
  };

  return (
    <div className="relative z-30">
      {/* classification strip — dynamic provenance (never shows synthetic label on live data) */}
      <div className="flex h-[22px] items-center justify-between border-b border-white/[0.06] bg-[#070B12]/80 px-4 backdrop-blur-xl">
        <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-slate-500">
          Unclassified // For official use only
        </span>
        <span className="hidden font-mono text-[9px] uppercase tracking-[0.26em] text-slate-500 md:block">
          {link === 'live'
            ? `National Technical Research Organisation · Smart India Hackathon 26162 · Data as of ${dataAsOf ? utc(dataAsOf) : '—'}`
            : link === 'waking'
              ? 'National Technical Research Organisation · Smart India Hackathon 26162 · Waking the API...'
              : 'National Technical Research Organisation · Smart India Hackathon 26162 · Demo data, API not connected'}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-slate-500">
          {utcClock} UTC
        </span>
      </div>

      <motion.header
        initial={{ y: -18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="glass-quiet flex h-[62px] items-center gap-3 border-b border-white/[0.07] px-4"
      >
        {/* brand */}
        <div className="flex items-center gap-3 pr-2">
          <div className="relative grid h-9 w-9 place-items-center rounded-xl border border-neon-cyan/30 bg-neon-cyan/10">
            <Flame size={16} className="text-neon-cyan" />
            <span className="absolute inset-0 rounded-xl border border-neon-cyan/20 animate-breathe" />
          </div>
          <div className="leading-none">
            <div className="font-semibold tracking-tight text-[15px] text-slate-50">
              Thermal Watch
            </div>
            <div className="mt-1 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-slate-500">
              <span className="text-neon-cyan/70">SIH</span>
              <span>·</span>
              <RotatingText
                texts={[
                  'industrial fire intelligence',
                  'persistent thermal sources',
                  'FIRMS · OSM · model fusion',
                  'novelty detection for NTRO',
                ]}
                rotationInterval={3200}
                staggerDuration={0.012}
                staggerFrom="last"
                splitBy="characters"
                mainClassName="text-slate-500"
                transition={{ type: 'spring', damping: 30, stiffness: 380 }}
              />
            </div>
          </div>
        </div>

        {/* Region Picker driven by GET /regions */}
        <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5">
          <MapPin size={12} className="shrink-0 text-neon-cyan" />
          <label htmlFor="region-picker" className="sr-only">
            Select Indian Industrial Region
          </label>
          <select
            id="region-picker"
            value={selectedRegion}
            onChange={(e) => handleRegionChange(e.target.value)}
            className="max-w-[210px] cursor-pointer truncate bg-transparent font-mono text-[11px] text-slate-200 outline-none"
            title="Select Indian industrial region (/regions)"
          >
            {regions.map((r) => (
              <option key={r.name} value={r.name} className="bg-[#0B101B] text-slate-200">
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* search */}
        <div className="relative hidden min-w-[170px] max-w-[250px] flex-1 items-center lg:flex">
          <Search size={13} className="absolute left-3 text-slate-500" />
          <input
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            placeholder="Search facility, event id, class…"
            className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] pl-9 pr-3 font-mono text-[11px]
                       text-slate-200 placeholder:text-slate-600 outline-none transition focus:border-neon-cyan/40
                       focus:bg-white/[0.06] focus:shadow-[0_0_24px_-8px_rgba(34,211,238,0.7)]"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Replay deck — only shown in offline demo mode (hidden when connected to real API per Decision B.3) */}
          {link === 'cached' && (
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2 py-1.5">
              <button
                onClick={() => void toggleReplay(speed)}
                className="btn-glass !px-2.5 !py-1"
                data-active={replay.active}
                title="Replay offline demo timeline"
              >
                {replay.active ? <Pause size={12} /> : <Play size={12} />}
                {replay.active ? 'Pause' : 'Replay'}
              </button>
              <div className="flex items-center gap-1">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    data-active={speed === s}
                    className="btn-glass !px-2 !py-1 !text-[10px]"
                  >
                    {s}×
                  </button>
                ))}
              </div>
              <div className="ml-1 hidden xl:block">
                <SplitFlapText
                  text={replay.virtualTime ? replay.virtualTime.slice(11, 19) : utcClock}
                  fontSize={12}
                  gap={2}
                  tileRadius={3}
                  padTo={8}
                  tileColor={replay.active ? '#1A1207' : '#0D1420'}
                  textColor={replay.active ? '#FBBF24' : '#7DD3FC'}
                  flipDuration={0.08}
                  stagger={0.015}
                  flipsPerChar={3}
                />
              </div>
            </div>
          )}

          {/* link + dataset currency timestamp ("Data as of <timestamp>") */}
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full animate-breathe"
              style={{ background: linkTone.dot, boxShadow: `0 0 10px ${linkTone.dot}` }}
            />
            <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${linkTone.text}`}>
              {linkTone.label}
            </span>
            {dataAsOf && (
              <>
                <span className="h-3 w-px bg-white/10" />
                <span
                  className="font-mono text-[10px] text-slate-300"
                  title="Dataset acquisition currency timestamp from /health"
                >
                  Data as of {utc(dataAsOf)}
                </span>
              </>
            )}
          </div>

          <button
            onClick={() => void reload()}
            className="btn-glass !px-2.5 !py-2"
            title="Re-poll the API service"
          >
            <RefreshCw size={12} />
          </button>

          <div className="hidden items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 2xl:flex">
            {link === 'live' ? (
              <Satellite size={12} className="text-neon-ice" />
            ) : (
              <CloudOff size={12} className="text-neon-ember" />
            )}
            <span className="font-mono text-[10px] text-slate-500" title={artifactSummary}>
              {artifactSummary}
            </span>
            <span className="h-3 w-px bg-white/10" />
            <Activity size={12} className="text-slate-500" />
            <span className="font-mono text-[10px] text-slate-400">{stats.total} events</span>
          </div>
        </div>
      </motion.header>
    </div>
  );
}

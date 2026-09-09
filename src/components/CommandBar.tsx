import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Activity, CloudOff, Flame, Pause, Play, RefreshCw, Search, Satellite } from 'lucide-react';
import SplitFlapText from '../reactbits/SplitFlapText';
import RotatingText from '../reactbits/RotatingText';
import { DEMO_MODE } from '../lib/api';
import type { ConsoleState } from '../lib/useConsole';
import { clock, timeAgo } from '../lib/format';

const SPEEDS = [1, 10, 60, 600];

export default function CommandBar({ state }: { state: ConsoleState }) {
  const { link, lastSync, stale, health, replay, toggleReplay, filters, setFilters, reload, stats } = state;
  const [utcClock, setUtcClock] = useState(clock());
  const [speed, setSpeed] = useState(600);

  useEffect(() => {
    const id = setInterval(() => setUtcClock(clock()), 1000);
    return () => clearInterval(id);
  }, []);

  const linkTone =
    link === 'live'
      ? { dot: '#34D399', label: 'STREAM LIVE', text: 'text-neon-mint' }
      : link === 'connecting'
        ? { dot: '#FBBF24', label: 'LINKING', text: 'text-neon-amber' }
        : DEMO_MODE
        ? { dot: '#7DD3FC', label: 'SNAPSHOT DEMO', text: 'text-neon-ice' }
        : { dot: '#FF6B2C', label: 'CACHED VIEW', text: 'text-neon-ember' };

  return (
    <div className="relative z-30">
      {/* classification strip — this console is built for a government desk */}
      <div className="flex h-[22px] items-center justify-between border-b border-white/[0.06] bg-[#070B12]/80 px-4 backdrop-blur-xl">
        <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-slate-500">
          Unclassified // For official use only
        </span>
        <span className="hidden font-mono text-[9px] uppercase tracking-[0.28em] text-slate-500 md:block">
          National Technical Research Organisation · Smart India Hackathon 26162 · Synthetic demonstration data
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-slate-500">
          {utcClock} UTC
        </span>
      </div>

      <motion.header
        initial={{ y: -18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="glass-quiet flex h-[62px] items-center gap-4 border-b border-white/[0.07] px-4"
      >
        {/* brand */}
        <div className="flex items-center gap-3 pr-4">
          <div className="relative grid h-9 w-9 place-items-center rounded-xl border border-neon-cyan/30 bg-neon-cyan/10">
            <Flame size={16} className="text-neon-cyan" />
            <span className="absolute inset-0 rounded-xl border border-neon-cyan/20 animate-breathe" />
          </div>
          <div className="leading-none">
            <div className="font-semibold tracking-tight text-[15px] text-slate-50">
              Thermal Watch
            </div>
            <div className="mt-1 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-slate-500">
              <span className="text-neon-cyan/70">v2</span>
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

        {/* search */}
        <div className="relative hidden min-w-[190px] max-w-[280px] flex-1 items-center lg:flex">
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

        {/* replay deck */}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2 py-1.5">
            <button
              onClick={() => void toggleReplay(speed)}
              className="btn-glass !px-2.5 !py-1"
              data-active={replay.active}
              title="Replay the synthetic 24 h timeline"
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
                text={
                  replay.virtualTime
                    ? replay.virtualTime.slice(11, 19)
                    : utcClock
                }
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

          {/* link + provenance */}
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full animate-breathe"
              style={{ background: linkTone.dot, boxShadow: `0 0 10px ${linkTone.dot}` }}
            />
            <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${linkTone.text}`}>
              {linkTone.label}
            </span>
            <span className="h-3 w-px bg-white/10" />
            <span className="font-mono text-[10px] text-slate-500" title="NASA FIRMS publishes roughly 3 hours behind the overpass">
              FIRMS ≈ 3 h behind
            </span>
            {lastSync && (
              <>
                <span className="h-3 w-px bg-white/10" />
                <span className={`font-mono text-[10px] ${stale ? 'text-neon-amber' : 'text-slate-500'}`}>
                  {stale ? 'stale · ' : 'sync '}
                  {timeAgo(lastSync)}
                </span>
              </>
            )}
          </div>

          <button onClick={() => void reload()} className="btn-glass !px-2.5 !py-2" title="Re-poll the service">
            <RefreshCw size={12} />
          </button>

          <div className="hidden items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 2xl:flex">
            {link === 'live' ? <Satellite size={12} className="text-neon-ice" /> : <CloudOff size={12} className="text-neon-ember" />}
            <span className="font-mono text-[10px] text-slate-500">
              {health
                ? `A ${health.model_versions.Model_A_Clustering} · B ${health.model_versions.Model_B_Classification} · C ${health.model_versions.Model_C_EscalationRisk}`
                : 'models A 1.0.2 · B 1.0.0 · C 1.0.1'}
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

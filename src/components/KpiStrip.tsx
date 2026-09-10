import { motion } from 'motion/react';
import { AlertTriangle, Flame, Radar, Zap } from 'lucide-react';
import CountUp from '../reactbits/CountUp';
import type { ConsoleState } from '../lib/useConsole';
import { nf } from '../lib/format';

interface Tile {
  key: string;
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  foot: string;
  tone: string;
  icon: JSX.Element;
}

export default function KpiStrip({
  state,
  compact = false,
}: {
  state: ConsoleState;
  /** Phone layout: one scroll-snap row of narrow tiles instead of a 4-up grid. */
  compact?: boolean;
}) {
  const { stats, loading } = state;

  const tiles: Tile[] = [
    {
      key: 'events',
      label: 'Active thermal events',
      value: stats.total,
      foot: 'clustered detections, not raw pixels',
      tone: '#22D3EE',
      icon: <Flame size={13} />,
    },
    {
      key: 'anomalies',
      label: 'Anomalies |z| > 3',
      value: stats.critical,
      foot: 'above each site’s own baseline',
      tone: '#FF3B4E',
      icon: <AlertTriangle size={13} />,
    },
    {
      key: 'frp',
      label: 'Aggregate radiative power',
      value: Math.round(stats.frp),
      suffix: ' MW',
      foot: stats.peak.event
        ? `peak ${nf(stats.peak.value)} MW · ${stats.peak.event.observed.nearest_industrial?.name ?? 'unmapped source'}`
        : 'no events in window',
      tone: '#FBBF24',
      icon: <Zap size={13} />,
    },
    {
      key: 'novelty',
      label: 'Unmapped sources',
      value: stats.novelty,
      foot: 'no OSM facility within radius',
      tone: '#C084FC',
      icon: <Radar size={13} />,
    },
  ];

  return (
    <div
      className={
        compact
          ? 'scroll-thin pointer-events-auto flex snap-x snap-mandatory gap-2 overflow-x-auto px-2.5 pb-1'
          : 'pointer-events-none grid grid-cols-2 gap-2 xl:grid-cols-4'
      }
    >
      {tiles.map((t, i) => (
        <motion.div
          key={t.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 * i, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className={`glass pointer-events-auto group relative overflow-hidden rounded-2xl ${
            compact ? 'w-[172px] shrink-0 snap-start px-3 py-2' : 'px-3.5 py-3'
          }`}
        >
          <div
            className="absolute inset-x-0 top-0 h-px opacity-70"
            style={{ background: `linear-gradient(90deg, transparent, ${t.tone}, transparent)` }}
          />
          <div className="flex items-center justify-between gap-1.5">
            <span className={`label ${compact ? 'truncate' : ''}`}>{t.label}</span>
            <span
              className="grid h-6 w-6 place-items-center rounded-lg border"
              style={{ borderColor: `${t.tone}44`, color: t.tone, background: `${t.tone}14` }}
            >
              {t.icon}
            </span>
          </div>

          <div className="mt-1.5 flex items-baseline gap-1">
            {loading ? (
              <span className="skeleton block h-7 w-20 rounded-md" />
            ) : (
              <>
                <span
                  className={`metric font-semibold leading-none tracking-tight ${
                    compact ? 'text-[20px]' : 'text-[26px]'
                  }`}
                  style={{ color: t.tone }}
                >
                  <CountUp to={t.value} duration={1.1} separator="," />
                </span>
                {t.suffix && <span className="font-mono text-[11px] text-slate-500">{t.suffix}</span>}
              </>
            )}
          </div>

          <div className="mt-1.5 truncate font-mono text-[9.5px] text-slate-500">{t.foot}</div>
        </motion.div>
      ))}
    </div>
  );
}

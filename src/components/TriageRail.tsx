import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, Filter, Radar, SlidersHorizontal, TriangleAlert, X } from 'lucide-react';
import type { EventSummary, Priority } from '../lib/types';
import type { ConsoleState } from '../lib/useConsole';
import {
  CANONICAL_EVENT_TYPES,
  DEMO_EVENT_TYPES,
  PRIORITY_META,
  severityColor,
  typeMeta,
} from '../lib/design';
import { nf, timeAgo } from '../lib/format';

const GROUPS: Priority[] = ['HIGH', 'MEDIUM', 'LOW'];
const PAGE = 40;

export default function TriageRail({
  state,
  variant = 'desktop',
}: {
  state: ConsoleState;
  /** 'mobile' drops the rail chrome — the bottom sheet supplies it. */
  variant?: 'desktop' | 'mobile';
}) {
  const { visible, loading, selectedId, setSelectedId, setStatus, filters, setFilters, link, dataAsOf } = state;
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const availableClasses = link === 'cached' ? DEMO_EVENT_TYPES : CANONICAL_EVENT_TYPES;
  const referenceNowMs = dataAsOf ? new Date(dataAsOf).getTime() : Date.now();

  const grouped = useMemo(() => {
    const buckets: Record<Priority, EventSummary[]> = { HIGH: [], MEDIUM: [], LOW: [] };
    visible.forEach((e) => {
      const p = (e.inferred.priority as Priority) in buckets ? (e.inferred.priority as Priority) : 'LOW';
      buckets[p].push(e);
    });
    GROUPS.forEach((g) => buckets[g].sort((a, b) => b.inferred.severity - a.inferred.severity));
    return buckets;
  }, [visible]);

  // Queue paginates rather than mounting 200 rows at once — scenario 3 is the load test.
  useEffect(() => setLimit(PAGE), [filters]);
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setLimit((l) => Math.min(l + PAGE, visible.length)),
      { threshold: 0.1 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [visible.length]);

  let budget = limit;
  const activeFilterCount =
    filters.types.length + filters.priorities.length + (filters.noveltyOnly ? 1 : 0) + (filters.anomalyOnly ? 1 : 0);

  const mobile = variant === 'mobile';

  return (
    <div
      className={
        mobile
          ? 'flex h-full w-full flex-col'
          : 'glass-quiet flex h-full w-[400px] shrink-0 flex-col border-l border-white/[0.07]'
      }
    >
      {/* header — on mobile the sheet already shows the title, so only filters remain */}
      <div
        className={`flex items-center gap-2 border-b border-white/[0.07] ${
          mobile ? 'px-3 py-2' : 'px-3.5 py-3'
        }`}
      >
        {!mobile && (
          <div>
            <div className="text-[13px] font-semibold tracking-tight text-slate-100">Triage queue</div>
            <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-slate-500">
              {visible.length} in window · sorted by severity
            </div>
          </div>
        )}
        {mobile && (
          <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">
            sorted by severity
          </span>
        )}
        <button
          onClick={() => setShowFilters((v) => !v)}
          data-active={showFilters || activeFilterCount > 0}
          className={`btn-glass ml-auto !px-2.5 ${mobile ? '!py-1.5' : ''}`}
        >
          <SlidersHorizontal size={12} />
          {activeFilterCount > 0 ? `${activeFilterCount}` : 'Filter'}
        </button>
      </div>

      {/* filters */}
      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-b border-white/[0.07] bg-white/[0.015]"
          >
            <div className="space-y-3 px-3.5 py-3">
              <div>
                <div className="label mb-1.5">Class</div>
                <div className="flex flex-wrap gap-1.5">
                  {availableClasses.map((t) => {
                    const on = filters.types.includes(t);
                    const meta = typeMeta(t);
                    return (
                      <button
                        key={t}
                        onClick={() =>
                          setFilters({
                            ...filters,
                            types: on ? filters.types.filter((x) => x !== t) : [...filters.types, t],
                          })
                        }
                        className="chip transition"
                        style={{
                          borderColor: on ? `${meta.accent}66` : 'rgba(255,255,255,0.08)',
                          background: on ? `${meta.accent}1C` : 'transparent',
                          color: on ? meta.accent : '#64748B',
                        }}
                      >
                        <span>{meta.glyph}</span>
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-4">
                <div>
                  <div className="label mb-1.5">Priority</div>
                  <div className="flex gap-1.5">
                    {GROUPS.map((p) => {
                      const on = filters.priorities.includes(p);
                      return (
                        <button
                          key={p}
                          onClick={() =>
                            setFilters({
                              ...filters,
                              priorities: on ? filters.priorities.filter((x) => x !== p) : [...filters.priorities, p],
                            })
                          }
                          className={`chip ${on ? PRIORITY_META[p].ring + ' ' + PRIORITY_META[p].text : 'border-white/8 text-slate-500'}`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="label mb-1.5">Window</div>
                  <div className="flex gap-1.5">
                    {[6, 24, 48, 168].map((h) => (
                      <button
                        key={h}
                        onClick={() => setFilters({ ...filters, windowHours: h })}
                        data-active={filters.windowHours === h}
                        className="btn-glass !px-2 !py-1 !text-[10px]"
                      >
                        {h < 168 ? `${h}h` : '7d'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-1.5">
                <button
                  onClick={() => setFilters({ ...filters, noveltyOnly: !filters.noveltyOnly })}
                  data-active={filters.noveltyOnly}
                  className="btn-glass !py-1"
                >
                  <Radar size={11} /> Novelty only
                </button>
                <button
                  onClick={() => setFilters({ ...filters, anomalyOnly: !filters.anomalyOnly })}
                  data-active={filters.anomalyOnly}
                  className="btn-glass !py-1"
                >
                  <TriangleAlert size={11} /> Anomalies
                </button>
                {activeFilterCount > 0 && (
                  <button
                    onClick={() =>
                      setFilters({ ...filters, types: [], priorities: [], noveltyOnly: false, anomalyOnly: false })
                    }
                    className="btn-glass !py-1"
                  >
                    <X size={11} /> Clear
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* list */}
      <div className="scroll-thin flex-1 overflow-y-auto">
        {loading && (
          <div className="space-y-2 p-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="skeleton h-[62px] rounded-xl" />
            ))}
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
            <Filter size={20} className="text-slate-700" />
            <div className="text-[12.5px] text-slate-400">No events match this window</div>
            <div className="font-mono text-[10px] leading-relaxed text-slate-600">
              Widen the time window or clear class filters. An empty queue is a real state —
              routine flares are suppressed by design.
            </div>
          </div>
        )}

        {!loading &&
          GROUPS.map((group) => {
            const rows = grouped[group];
            if (!rows.length) return null;
            const slice = rows.slice(0, Math.max(0, budget));
            budget -= slice.length;
            if (!slice.length) return null;
            return (
              <div key={group}>
                <div className="sticky top-0 z-10 flex items-center gap-2 border-y border-white/[0.06] bg-[#070B12]/85 px-3.5 py-1.5 backdrop-blur-xl">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: PRIORITY_META[group].dot }} />
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">{group}</span>
                  <span className="ml-auto font-mono text-[10px] text-slate-600">{rows.length}</span>
                </div>
                <div className="space-y-1.5 p-2">
                  {slice.map((e) => (
                    <QueueRow
                      key={e.event_id}
                      event={e}
                      referenceNowMs={referenceNowMs}
                      selected={selectedId === e.event_id}
                      onSelect={() => setSelectedId(e.event_id)}
                      onAck={() => setStatus(e.event_id, 'acknowledged')}
                      onDismiss={() => setStatus(e.event_id, 'dismissed')}
                    />
                  ))}
                </div>
              </div>
            );
          })}

        {!loading && limit < visible.length && (
          <div ref={sentinel} className="flex items-center justify-center gap-2 py-4 font-mono text-[10px] text-slate-600">
            <ChevronDown size={12} className="animate-bounce" />
            loading {Math.min(PAGE, visible.length - limit)} more of {visible.length - limit}
          </div>
        )}
      </div>
    </div>
  );
}

function QueueRow({
  event,
  referenceNowMs,
  selected,
  onSelect,
  onAck,
  onDismiss,
}: {
  event: EventSummary;
  referenceNowMs: number;
  selected: boolean;
  onSelect: () => void;
  onAck: () => void;
  onDismiss: () => void;
}) {
  const meta = typeMeta(event.inferred.event_type);
  const tone = severityColor(event.inferred.severity);
  const facility = event.observed.nearest_industrial?.name ?? 'No known facility';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      onClick={onSelect}
      className={`group relative cursor-pointer overflow-hidden rounded-xl border px-2.5 py-2 transition-all duration-200
        ${selected
          ? 'border-neon-cyan/45 bg-neon-cyan/[0.07] shadow-[0_0_28px_-12px_rgba(34,211,238,0.9)]'
          : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]'}`}
    >
      <span className="absolute left-0 top-0 h-full w-[2px]" style={{ background: tone }} />

      <div className="flex items-center gap-2">
        <span
          className="metric grid h-7 w-9 shrink-0 place-items-center rounded-md text-[12px] font-semibold"
          style={{ background: `${tone}1F`, color: tone, boxShadow: `inset 0 0 0 1px ${tone}44` }}
        >
          {event.inferred.severity}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span style={{ color: meta.accent }} className="text-[11px] leading-none">
              {meta.glyph}
            </span>
            <span className="truncate text-[12px] font-medium text-slate-200">{meta.label}</span>
            {event.status === 'acknowledged' && (
              <span className="chip border-neon-mint/30 bg-neon-mint/10 !px-1.5 !py-0 text-neon-mint">ack</span>
            )}
          </div>
          <div
            className={`truncate font-mono text-[10px] ${
              event.observed.nearest_industrial ? 'text-slate-500' : 'text-neon-violet/80'
            }`}
          >
            {facility}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="metric text-[11.5px] text-slate-200">{nf(event.observed.frp_total_mw)} MW</div>
          <div className="font-mono text-[9.5px] text-slate-600">{timeAgo(event.last_seen, referenceNowMs)}</div>
        </div>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5">
        {event.inferred.anomaly_flag && (
          <span className="chip border-[#FF3B4E]/30 bg-[#FF3B4E]/10 text-[#FF8A96]">
            {event.inferred.anomaly_z > 0 ? '+' : ''}
            {event.inferred.anomaly_z.toFixed(1)}σ
          </span>
        )}
        {event.inferred.novelty_flag && (
          <span className="chip border-neon-violet/35 bg-neon-violet/10 text-neon-violet">novelty</span>
        )}
        {event.limitations.slice(0, 1).map((l) => (
          <span key={l} className="chip border-white/10 text-slate-500">
            {l.replace(/_/g, ' ')}
          </span>
        ))}

        <div className="ml-auto flex gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAck();
            }}
            className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-400 transition hover:border-neon-mint/50 hover:text-neon-mint md:h-5 md:w-5"
            title="Acknowledge"
          >
            <Check size={11} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-slate-400 transition hover:border-[#FF3B4E]/50 hover:text-[#FF8A96] md:h-5 md:w-5"
            title="Dismiss"
          >
            <X size={11} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

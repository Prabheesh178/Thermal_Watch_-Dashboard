import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Building2, Gauge, X } from 'lucide-react';
import { cached, fetchFacilityHistory } from '../lib/api';
import type { EventSummary, FacilitySeries } from '../lib/types';
import { severityColor, typeMeta } from '../lib/design';
import { nf, timeAgo } from '../lib/format';

/**
 * PRD screen 4. Opened from the drawer's facility line: the site's own FRP history with its
 * anomaly band, a persistence badge, and every event this console has attributed to it.
 */
export default function FacilityView({
  facilityId,
  facilityName,
  events,
  onClose,
  onSelectEvent,
}: {
  facilityId: string;
  facilityName: string;
  events: EventSummary[];
  onClose: () => void;
  onSelectEvent: (id: string) => void;
}) {
  const [series, setSeries] = useState<FacilitySeries | null>(null);
  const [days, setDays] = useState<30 | 90>(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchFacilityHistory(facilityId, days)
      .catch(() => cached.facilityHistory(facilityId))
      .then((s) => {
        if (!cancelled) setSeries(s ?? null);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [facilityId, days]);

  const data = useMemo(
    () =>
      (series?.history ?? []).map((p) => ({
        t: new Date(p.timestamp).getTime(),
        frp: p.frp_mw,
        band: series?.baseline ? [series.baseline.band_low_mw, series.baseline.band_high_mw] : undefined,
        anomalyPoint: Math.abs(p.z_score) > 3 ? p.frp_mw : undefined,
        z: p.z_score,
      })),
    [series],
  );

  const facilityEvents = events.filter((e) => e.observed.nearest_industrial?.facility_id === facilityId);
  const activeDays = series?.days_active_last_30;
  const duty = series?.duty_cycle_30d;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40 grid place-items-center bg-black/55 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 18, opacity: 0, scale: 0.985 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 18, opacity: 0, scale: 0.985 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="glass w-[min(860px,92vw)] overflow-hidden rounded-3xl"
        >
          <div className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-3.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-neon-ice/30 bg-neon-ice/10 text-neon-ice">
              <Building2 size={15} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold tracking-tight text-slate-50">
                {series?.facility_name ?? facilityName}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
                {facilityId} · {series?.source ?? 'baseline'} · n={series?.n_history ?? '—'}
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {[30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d as 30 | 90)}
                  data-active={days === d}
                  className="btn-glass !py-1"
                >
                  {d} d
                </button>
              ))}
              <button onClick={onClose} className="btn-glass !px-2 !py-1.5">
                <X size={12} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_260px] gap-4 p-5">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <span className="label">FRP history vs facility baseline</span>
                {series?.baseline && (
                  <span className="font-mono text-[9.5px] text-slate-500">
                    median {nf(series.baseline.median_mw)} MW · band {nf(series.baseline.band_low_mw)}–
                    {nf(series.baseline.band_high_mw)} MW
                  </span>
                )}
              </div>

              {loading ? (
                <div className="skeleton h-[240px] rounded-xl" />
              ) : !series || data.length === 0 ? (
                <div className="grid h-[240px] place-items-center rounded-xl border border-dashed border-white/10 font-mono text-[11px] text-slate-500">
                  No history returned for this facility
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
                    <defs>
                      <linearGradient id="facFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FF6B2C" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#FF6B2C" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="t"
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={(v) => new Date(v).toISOString().slice(5, 10)}
                      tick={{ fill: '#64748B', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                      tickLine={false}
                      minTickGap={26}
                    />
                    <YAxis
                      tick={{ fill: '#64748B', fontSize: 9, fontFamily: 'JetBrains Mono' }}
                      axisLine={false}
                      tickLine={false}
                      width={44}
                    />
                    {series.baseline && (
                      <Area type="monotone" dataKey="band" stroke="none" fill="#38BDF8" fillOpacity={0.12} isAnimationActive={false} />
                    )}
                    {series.baseline && (
                      <ReferenceLine y={series.baseline.median_mw} stroke="#38BDF8" strokeDasharray="4 4" strokeOpacity={0.6} />
                    )}
                    <Area type="monotone" dataKey="frp" stroke="none" fill="url(#facFill)" isAnimationActive={false} />
                    <Line type="monotone" dataKey="frp" stroke="#FF6B2C" strokeWidth={1.5} dot={false} animationDuration={800} />
                    <Scatter dataKey="anomalyPoint" fill="#FF3B4E" />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(8,12,20,0.94)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 10,
                        fontFamily: 'JetBrains Mono',
                        fontSize: 10,
                      }}
                      labelFormatter={(v) => `${new Date(Number(v)).toISOString().slice(0, 16).replace('T', ' ')}Z`}
                      formatter={(value: any, name: any) =>
                        name === 'band'
                          ? [`${nf(value[0])} – ${nf(value[1])} MW`, 'baseline band']
                          : [`${nf(value)} MW`, name === 'anomalyPoint' ? 'anomalous pass' : 'FRP']
                      }
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
                <div className="flex items-center gap-2">
                  <Gauge size={12} className="text-neon-ice" />
                  <span className="label">Persistence</span>
                </div>
                {activeDays === undefined ? (
                  <div className="mt-1.5 font-mono text-[10px] text-slate-500">not reported for this site</div>
                ) : (
                  <>
                    <div className="metric mt-1 text-[20px] font-semibold text-slate-100">
                      {activeDays}
                      <span className="font-mono text-[11px] text-slate-500"> / 30 days active</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-white/[0.07]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(activeDays / 30) * 100}%` }}
                        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                        className="h-full rounded-full bg-gradient-to-r from-neon-ice to-neon-cyan"
                      />
                    </div>
                    {duty !== undefined && (
                      <div className="mt-1.5 font-mono text-[9.5px] text-slate-500">
                        duty cycle {(duty * 100).toFixed(0)}% — steady operation suppresses routine alerts
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
                <div className="label mb-2">Events at this site</div>
                {facilityEvents.length === 0 ? (
                  <div className="font-mono text-[10px] text-slate-500">none in the current window</div>
                ) : (
                  <div className="scroll-thin max-h-[150px] space-y-1.5 overflow-y-auto pr-1">
                    {facilityEvents.map((e) => {
                      const meta = typeMeta(e.inferred.event_type);
                      return (
                        <button
                          key={e.event_id}
                          onClick={() => onSelectEvent(e.event_id)}
                          className="flex w-full items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-left transition hover:border-white/15 hover:bg-white/[0.06]"
                        >
                          <span
                            className="metric grid h-5 w-7 shrink-0 place-items-center rounded text-[10px]"
                            style={{
                              background: `${severityColor(e.inferred.severity)}1F`,
                              color: severityColor(e.inferred.severity),
                            }}
                          >
                            {e.inferred.severity}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[10.5px] text-slate-300">{meta.label}</span>
                          <span className="font-mono text-[9px] text-slate-500">{timeAgo(e.last_seen)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

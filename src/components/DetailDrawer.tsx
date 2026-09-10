import { AnimatePresence, motion } from 'motion/react';
import { Brain, Check, Download, Image as ImageIcon, Info, Satellite, TriangleAlert, X } from 'lucide-react';
import type { EventDetail } from '../lib/types';
import type { ConsoleState } from '../lib/useConsole';
import { CONFIDENCE_META, LIMITATION_LABEL, severityColor, typeMeta } from '../lib/design';
import { coords, humanFeature, int, nf, pct, timeAgo, utc } from '../lib/format';
import FrpChart from './FrpChart';
import FootprintMap from './FootprintMap';

export default function DetailDrawer({
  state,
  onOpenFacility,
  variant = 'desktop',
}: {
  state: ConsoleState;
  onOpenFacility: (facility: { id: string; name: string }) => void;
  /** On mobile the drawer fills a screen of its own, so it drops the slide-in chrome. */
  variant?: 'desktop' | 'mobile';
}) {
  const { detail, detailLoading, selectedId, setSelectedId, setStatus } = state;
  const open = Boolean(selectedId);
  const mobile = variant === 'mobile';

  if (mobile) {
    return (
      <div className="flex h-full flex-col">
        {detailLoading && !detail ? (
          <DrawerSkeleton onClose={() => setSelectedId(null)} />
        ) : detail ? (
          <DrawerBody
            detail={detail}
            onClose={() => setSelectedId(null)}
            setStatus={setStatus}
            onOpenFacility={onOpenFacility}
            hideClose
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-10 text-center">
            <Info size={20} className="text-slate-600" />
            <div className="text-[13px] text-slate-300">Event detail unavailable</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="drawer"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          className="glass-quiet absolute right-[400px] top-0 z-20 flex h-full w-[500px] flex-col border-x border-white/[0.08]
                     shadow-[0_0_140px_-30px_rgba(0,0,0,1)]"
        >
          {detailLoading && !detail ? (
            <DrawerSkeleton onClose={() => setSelectedId(null)} />
          ) : detail ? (
            <DrawerBody
              detail={detail}
              onClose={() => setSelectedId(null)}
              setStatus={setStatus}
              onOpenFacility={onOpenFacility}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-10 text-center">
              <Info size={20} className="text-slate-600" />
              <div className="text-[13px] text-slate-300">Event detail unavailable</div>
              <div className="font-mono text-[10px] leading-relaxed text-slate-500">
                The service did not return this event and it is not in the cached snapshot.
              </div>
              <button onClick={() => setSelectedId(null)} className="btn-glass mt-2">
                Close
              </button>
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function DrawerSkeleton({ onClose }: { onClose: () => void }) {
  return (
    <div className="p-4">
      <div className="mb-3 flex justify-end">
        <button onClick={onClose} className="btn-glass !px-2 !py-1">
          <X size={12} />
        </button>
      </div>
      <div className="space-y-3">
        <div className="skeleton h-16 rounded-xl" />
        <div className="skeleton h-40 rounded-xl" />
        <div className="skeleton h-52 rounded-xl" />
      </div>
    </div>
  );
}

function DrawerBody({
  detail,
  onClose,
  setStatus,
  onOpenFacility,
  hideClose = false,
}: {
  detail: EventDetail;
  onClose: () => void;
  setStatus: ConsoleState['setStatus'];
  onOpenFacility: (facility: { id: string; name: string }) => void;
  hideClose?: boolean;
}) {
  const meta = typeMeta(detail.inferred.event_type);
  const tone = severityColor(detail.inferred.severity);
  const o = detail.observed;
  const inf = detail.inferred;

  const exportBrief = () => {
    const lines = [
      `THERMAL WATCH — EVENT BRIEF (synthetic demonstration data)`,
      `event_id            ${detail.event_id}`,
      `location            ${coords(detail.centroid.lat, detail.centroid.lon)}`,
      `first / last seen   ${utc(detail.first_seen)}  ->  ${utc(detail.last_seen)}`,
      ``,
      `SATELLITE EVIDENCE (observed)`,
      `  sensor            ${o.sensor} ${o.satellite} · ${o.daynight === 'N' ? 'night' : 'day'} pass`,
      `  FRP total / max   ${nf(o.frp_total_mw)} MW / ${nf(o.frp_max_mw)} MW`,
      `  brightness TI4    ${nf(o.bright_ti4_max_k)} K${o.bright_ti4_saturated ? ' (saturated — true value is at or above this)' : ''}`,
      `  detections        ${o.detection_count} px · cloud ${o.cloud_cover_pct}% · ${o.land_cover}`,
      `  nearest facility  ${o.nearest_industrial ? `${o.nearest_industrial.name} (${o.nearest_industrial.distance_m} m)` : 'none within search radius'}`,
      ``,
      `MODEL INFERENCE (inferred)`,
      `  class             ${meta.label} @ ${pct(inf.event_type_confidence)} confidence`,
      `  anomaly           ${inf.anomaly_z > 0 ? '+' : ''}${inf.anomaly_z.toFixed(1)} sigma vs own baseline`,
      `  24h escalation    ${inf.risk_24h === null ? 'not available (Model C)' : pct(inf.risk_24h)}`,
      `  severity          ${inf.severity}/100 · priority ${inf.priority}`,
      `  assessment        ${inf.explanation}`,
      `  models            ${inf.model_version}`,
      ``,
      `LIMITATIONS         ${detail.limitations.length ? detail.limitations.join(', ') : 'none recorded'}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${detail.event_id}_brief.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* 1 — header */}
      <div className="relative border-b border-white/[0.07] px-4 py-3">
        <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg,transparent,${tone},transparent)` }} />
        <div className="flex items-start gap-3">
          <span
            className="metric grid h-11 w-14 shrink-0 place-items-center rounded-xl text-[18px] font-semibold"
            style={{ background: `${tone}1A`, color: tone, boxShadow: `inset 0 0 0 1px ${tone}55` }}
          >
            {inf.severity}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span style={{ color: meta.accent }}>{meta.glyph}</span>
              <span className="truncate text-[15px] font-semibold tracking-tight text-slate-50">{meta.label}</span>
              <span className={`chip ${inf.priority === 'HIGH' ? 'border-[#FF3B4E]/40 bg-[#FF3B4E]/10 text-[#FF8A96]' : inf.priority === 'MEDIUM' ? 'border-neon-amber/35 bg-neon-amber/10 text-neon-amber' : 'border-white/10 text-slate-400'}`}>
                {inf.priority}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[10px] text-slate-500">
              <span className="text-slate-400">{detail.event_id}</span>
              <span>·</span>
              <span>{coords(detail.centroid.lat, detail.centroid.lon)}</span>
              <span>·</span>
              <span>{timeAgo(detail.last_seen)}</span>
              <span>·</span>
              <span className={detail.status === 'acknowledged' ? 'text-neon-mint' : 'text-slate-500'}>{detail.status}</span>
            </div>
          </div>
          {!hideClose && (
            <button onClick={onClose} className="btn-glass !px-2 !py-1">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="scroll-thin flex-1 space-y-3 overflow-y-auto p-3.5">
        {/* 2 — OBSERVED. Neutral slate, no accent, no model values. */}
        <section className="rounded-2xl border border-white/[0.07] bg-slate-500/[0.045] p-3">
          <header className="mb-2.5 flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-slate-400">
              <Satellite size={12} />
            </span>
            <div>
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                Satellite evidence
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">
                measured · {o.sensor} {o.satellite} · {o.daynight === 'N' ? 'night pass' : 'day pass'}
              </div>
            </div>
            <span
              className={`chip ml-auto border-white/10 ${CONFIDENCE_META[o.confidence]?.tone ?? 'text-slate-400'}`}
            >
              {CONFIDENCE_META[o.confidence]?.label ?? o.confidence} confidence
            </span>
          </header>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            <Metric label="Total radiative power" value={`${nf(o.frp_total_mw)}`} unit="MW" sub={`peak ${nf(o.frp_max_mw)} MW`} />
            <Metric
              label="Brightness temp TI4"
              value={`${nf(o.bright_ti4_max_k)}`}
              unit="K"
              sub={o.bright_ti4_saturated ? 'sensor saturated — true value ≥ this' : 'below saturation'}
              warn={o.bright_ti4_saturated}
            />
            <Metric label="Detections clustered" value={`${o.detection_count}`} unit="px" sub={`${detail.pixel_count} px in footprint`} />
            <Metric label="Cloud cover" value={`${o.cloud_cover_pct}`} unit="%" sub={o.land_cover.replace(/_/g, ' ')} />
          </div>

          <div className="mt-3 border-t border-white/[0.06] pt-2.5">
            <div className="label mb-1">Nearest mapped facility (OSM)</div>
            {o.nearest_industrial ? (
              <div className="flex items-baseline gap-2">
                <button
                  onClick={() =>
                    onOpenFacility({ id: o.nearest_industrial!.facility_id, name: o.nearest_industrial!.name })
                  }
                  className="text-[12.5px] text-slate-200 underline decoration-white/20 underline-offset-4 transition
                             hover:text-neon-ice hover:decoration-neon-ice/60"
                  title="Open the facility view"
                >
                  {o.nearest_industrial.name}
                </button>
                <span className="font-mono text-[10px] text-slate-500">
                  {o.nearest_industrial.type.replace(/_/g, ' ')} ·{' '}
                  {o.nearest_industrial.distance_m === 0 ? 'on site' : `${int(o.nearest_industrial.distance_m)} m to boundary`}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] text-neon-violet/90">No known facility</span>
                <span className="font-mono text-[10px] text-slate-500">nothing in OpenStreetMap within the search radius</span>
              </div>
            )}
          </div>
        </section>

        {/* 3 — INFERRED. Accent panel, never interleaved with the section above. */}
        <section className="relative overflow-hidden rounded-2xl border border-neon-violet/25 bg-neon-violet/[0.055] p-3">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-neon-violet/15 blur-3xl" />
          <header className="mb-2.5 flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-md border border-neon-violet/35 bg-neon-violet/15 text-neon-violet">
              <Brain size={12} />
            </span>
            <div>
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-neon-violet">
                Model inference
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
                estimated · not measured
              </div>
            </div>
            <span className="chip ml-auto border-neon-violet/30 bg-neon-violet/10 text-neon-violet">
              {pct(inf.event_type_confidence)} class conf
            </span>
          </header>

          <div className="grid grid-cols-3 gap-3">
            <InferredMetric
              label="Anomaly"
              value={`${inf.anomaly_z > 0 ? '+' : ''}${inf.anomaly_z.toFixed(1)}σ`}
              note={inf.anomaly_flag ? 'above own baseline' : 'within baseline'}
              tone={inf.anomaly_flag ? '#FF6B2C' : '#94A3B8'}
            />
            <InferredMetric
              label="24 h escalation"
              value={inf.risk_24h === null ? 'n/a' : pct(inf.risk_24h)}
              note={inf.risk_24h === null ? 'Model C not available' : 'probability of growth'}
              tone={inf.risk_24h === null ? '#64748B' : '#38BDF8'}
              muted={inf.risk_24h === null}
            />
            <InferredMetric
              label="Novelty"
              value={inf.novelty_flag ? 'flagged' : 'catalogued'}
              note={inf.novelty_flag ? 'no mapped source' : 'known site'}
              tone={inf.novelty_flag ? '#C084FC' : '#94A3B8'}
            />
          </div>

          <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/25 px-3 py-2">
            <div className="label mb-1 !text-neon-violet/70">Assessment</div>
            <p className="text-[11.5px] leading-relaxed text-slate-300">{inf.explanation}</p>
          </div>

          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="label !text-neon-violet/70">Feature attribution (SHAP)</span>
              <span className="font-mono text-[9px] text-slate-600">weight</span>
            </div>
            <div className="space-y-1.5">
              {inf.top_factors.map((f) => {
                const positive = f.direction === '+';
                const width = Math.min(100, Math.abs(f.weight) * 190);
                return (
                  <div key={f.feature}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-mono text-[10px] text-slate-400">{humanFeature(f.feature)}</span>
                      <span className={`font-mono text-[10px] ${positive ? 'text-neon-ember' : 'text-neon-ice'}`}>
                        {positive ? '+' : '−'}
                        {(f.weight * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-1 h-[3px] rounded-full bg-white/[0.06]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        className="h-full rounded-full"
                        style={{ background: positive ? '#FF6B2C' : '#38BDF8' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-2 font-mono text-[9px] text-slate-500">
            <span>{inf.model_version}</span>
            <span>severity {inf.severity}/100 · {inf.priority}</span>
          </div>
        </section>

        {/* 4 — FRP vs baseline */}
        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
          <header className="mb-1 flex items-center justify-between">
            <div>
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                FRP vs baseline
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">
                {detail.frp_series.length} VIIRS passes · ~01:30 / 13:30 local
              </div>
            </div>
            {detail.baseline && (
              <span className="chip border-white/10 text-slate-400">
                {detail.baseline.source === 'facility' ? 'facility baseline' : 'regional fallback'}
              </span>
            )}
          </header>
          <FrpChart series={detail.frp_series} baseline={detail.baseline} />
        </section>

        {/* 5 — footprint */}
        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
          <header className="mb-2 flex items-center justify-between">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-slate-300">
              Detection footprint
            </div>
            {detail.population_5km_exposure > 0 && (
              <span className="font-mono text-[9.5px] text-slate-500">
                {int(detail.population_5km_exposure)} people within 5 km
              </span>
            )}
          </header>
          <FootprintMap detail={detail} />
        </section>

        {/* 6 — imagery, designed empty state (it is null in essentially every real case) */}
        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
          <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-slate-300">
            Before / after imagery
          </div>
          {detail.imagery?.before_url && detail.imagery?.after_url ? (
            <div className="grid grid-cols-2 gap-2">
              <img src={detail.imagery.before_url} alt="before" className="rounded-lg border border-white/10" />
              <img src={detail.imagery.after_url} alt="after" className="rounded-lg border border-white/10" />
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/[0.1] bg-black/20 px-3 py-4">
              <ImageIcon size={16} className="shrink-0 text-slate-600" />
              <div>
                <div className="text-[11.5px] text-slate-400">No optical pass tasked for this window</div>
                <div className="mt-0.5 font-mono text-[9.5px] leading-relaxed text-slate-600">
                  Sentinel-2 revisit is 5 days and cloud-dependent. Thermal detection does not wait
                  on imagery — a brief can be raised without it.
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 7 — limitations */}
        {detail.limitations.length > 0 && (
          <section className="rounded-2xl border border-neon-amber/25 bg-neon-amber/[0.06] p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <TriangleAlert size={12} className="text-neon-amber" />
              <span className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-neon-amber">
                Known limitations
              </span>
            </div>
            <ul className="space-y-1">
              {detail.limitations.map((l) => (
                <li key={l} className="flex gap-2 font-mono text-[10px] leading-relaxed text-neon-amber/85">
                  <span>—</span>
                  <span>{LIMITATION_LABEL[l] ?? l.replace(/_/g, ' ')}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* timeline */}
        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
          <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-slate-300">
            Processing trail
          </div>
          <div className="space-y-1.5">
            {detail.timeline?.map((t, i) => (
              <div key={`${t.ts}-${i}`} className="flex items-center gap-2.5">
                <span className="h-1 w-1 rounded-full bg-neon-cyan/70" />
                <span className="font-mono text-[10px] text-slate-400">{humanFeature(t.event)}</span>
                <span className="ml-auto font-mono text-[9.5px] text-slate-600">{utc(t.ts)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* actions */}
      <div className="flex items-center gap-2 border-t border-white/[0.07] px-3.5 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] md:pb-3">
        <button
          onClick={() => setStatus(detail.event_id, 'acknowledged')}
          className="btn-glass flex-1 justify-center !border-neon-mint/30 !bg-neon-mint/10 !text-neon-mint hover:!bg-neon-mint/20"
        >
          <Check size={12} /> Acknowledge
        </button>
        <button
          onClick={() => setStatus(detail.event_id, 'dismissed')}
          className="btn-glass flex-1 justify-center"
        >
          <X size={12} /> Dismiss
        </button>
        <button onClick={exportBrief} className="btn-glass !px-3" title="Download a plain-text brief">
          <Download size={12} /> Brief
        </button>
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  unit,
  sub,
  warn,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="metric text-[17px] font-medium text-slate-100">{value}</span>
        {unit && <span className="font-mono text-[10px] text-slate-500">{unit}</span>}
      </div>
      {sub && (
        <div className={`mt-0.5 font-mono text-[9.5px] ${warn ? 'text-neon-amber' : 'text-slate-600'}`}>{sub}</div>
      )}
    </div>
  );
}

function InferredMetric({
  label,
  value,
  note,
  tone,
  muted,
}: {
  label: string;
  value: string;
  note: string;
  tone: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/20 px-2.5 py-2">
      <div className="label !text-[9px]">{label}</div>
      <div className={`metric mt-0.5 text-[15px] font-medium ${muted ? 'opacity-70' : ''}`} style={{ color: tone }}>
        {value}
      </div>
      <div className="mt-0.5 font-mono text-[9px] text-slate-600">{note}</div>
    </div>
  );
}

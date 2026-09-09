import { motion } from 'motion/react';
import type { ConsoleState } from '../lib/useConsole';
import { typeMeta, TYPE_META } from '../lib/design';

/**
 * Class distribution across the current window. It exists to make one point on stage:
 * 200 agricultural burns stay out of the queue while two industrial incidents surface.
 */
export default function ClassMix({ state }: { state: ConsoleState }) {
  const { stats } = state;
  const total = Math.max(1, stats.total);
  const rows = Object.keys(TYPE_META)
    .map((t) => ({ type: t, count: stats.byType[t] ?? 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  const unknownClasses = Object.keys(stats.byType).filter((t) => !(t in TYPE_META));

  return (
    <div className="glass rounded-2xl px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="label !text-slate-300">Classification mix</span>
        <span className="font-mono text-[9px] text-slate-600">{stats.total}</span>
      </div>

      <div className="mt-2 space-y-1.5">
        {rows.map((r, i) => {
          const meta = typeMeta(r.type);
          const share = (r.count / total) * 100;
          return (
            <div key={r.type}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span style={{ color: meta.accent }} className="text-[10px] leading-none">
                    {meta.glyph}
                  </span>
                  <span className="truncate text-[10.5px] text-slate-400">{meta.label}</span>
                </span>
                <span className="font-mono text-[9.5px] text-slate-500">{r.count}</span>
              </div>
              <div className="mt-1 h-[3px] rounded-full bg-white/[0.06]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${share}%` }}
                  transition={{ delay: 0.05 * i, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full"
                  style={{ background: meta.accent, boxShadow: `0 0 10px -2px ${meta.accent}` }}
                />
              </div>
            </div>
          );
        })}

        {unknownClasses.map((t) => (
          <div key={t} className="rounded-md border border-pink-400/30 bg-pink-400/10 px-2 py-1 font-mono text-[9px] text-pink-300">
            unrecognised class “{t}” — {stats.byType[t]} events
          </div>
        ))}
      </div>
    </div>
  );
}

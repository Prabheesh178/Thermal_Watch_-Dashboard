import { useMemo } from 'react';
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
import type { Baseline, FrpPoint } from '../lib/types';
import { nf } from '../lib/format';

/**
 * FRP against the site's own baseline band. VIIRS overpasses are ~01:30 / 13:30 local,
 * so the series is plotted on a real time axis — never on evenly spaced indices.
 */
export default function FrpChart({
  series,
  baseline,
  height = 210,
}: {
  series: FrpPoint[];
  baseline: Baseline | null;
  height?: number;
}) {
  const data = useMemo(
    () =>
      series.map((p) => ({
        t: new Date(p.ts).getTime(),
        frp: p.frp_mw,
        band: baseline ? [baseline.band_low_mw, baseline.band_high_mw] : undefined,
        median: baseline?.median_mw,
        anomalyPoint: p.anomalous ? p.frp_mw : undefined,
        daynight: p.daynight,
        satellite: p.satellite,
      })),
    [series, baseline],
  );

  const peak = Math.max(...series.map((p) => p.frp_mw), baseline?.band_high_mw ?? 0);

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -14 }}>
          <defs>
            <linearGradient id="frpFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF6B2C" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#FF6B2C" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />

          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v) => new Date(v).toISOString().slice(5, 10).replace('-', '/')}
            tick={{ fill: '#64748B', fontSize: 9, fontFamily: 'JetBrains Mono' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            tick={{ fill: '#64748B', fontSize: 9, fontFamily: 'JetBrains Mono' }}
            axisLine={false}
            tickLine={false}
            width={46}
            domain={[0, Math.ceil(peak * 1.12)]}
            tickFormatter={(v) => `${v}`}
          />

          {baseline && (
            <Area
              type="monotone"
              dataKey="band"
              stroke="none"
              fill="#38BDF8"
              fillOpacity={0.1}
              isAnimationActive={false}
              activeDot={false}
            />
          )}
          {baseline && (
            <ReferenceLine
              y={baseline.median_mw}
              stroke="#38BDF8"
              strokeDasharray="4 4"
              strokeOpacity={0.65}
              label={{
                value: `median ${nf(baseline.median_mw)} MW`,
                position: 'insideTopLeft',
                fill: '#7DD3FC',
                fontSize: 9,
                fontFamily: 'JetBrains Mono',
              }}
            />
          )}

          <Area type="monotone" dataKey="frp" stroke="none" fill="url(#frpFill)" isAnimationActive={false} />
          <Line
            type="monotone"
            dataKey="frp"
            stroke="#FF6B2C"
            strokeWidth={1.6}
            dot={false}
            isAnimationActive
            animationDuration={900}
          />
          <Scatter dataKey="anomalyPoint" fill="#FF3B4E" shape="circle" legendType="none" />

          <Tooltip
            cursor={{ stroke: 'rgba(255,255,255,0.18)', strokeDasharray: '3 3' }}
            contentStyle={{
              background: 'rgba(8,12,20,0.94)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              fontFamily: 'JetBrains Mono',
              fontSize: 10,
              padding: '8px 10px',
            }}
            labelFormatter={(v) => `${new Date(Number(v)).toISOString().slice(0, 16).replace('T', ' ')}Z`}
            formatter={(value: any, name: any) => {
              if (name === 'band') return [`${nf(value[0])} – ${nf(value[1])} MW`, 'baseline band'];
              if (name === 'anomalyPoint') return [`${nf(value)} MW`, 'anomalous pass'];
              return [`${nf(value)} MW`, 'observed FRP'];
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-1 flex flex-wrap items-center gap-3 font-mono text-[9px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-[2px] w-4 rounded bg-[#FF6B2C]" /> observed FRP
        </span>
        {baseline ? (
          <>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-sm bg-[#38BDF8]/25" />
              {baseline.source === 'facility'
                ? `this facility’s own band · n=${baseline.n_history}`
                : `regional fallback band · n=${baseline.n_history}`}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF3B4E]" /> anomalous pass
            </span>
          </>
        ) : (
          <span className="text-neon-amber">
            no baseline — insufficient history, series shown without a comparison band
          </span>
        )}
      </div>

      {baseline?.source === 'regional' && (
        <div className="mt-1.5 rounded-lg border border-neon-amber/25 bg-neon-amber/[0.06] px-2.5 py-1.5 font-mono text-[9.5px] leading-relaxed text-neon-amber/90">
          Band is a regional fallback averaged across sites of this type — not this facility's own history.
        </div>
      )}
    </div>
  );
}

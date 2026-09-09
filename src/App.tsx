import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CloudOff, Crosshair, Globe2, Layers, PieChart, Thermometer } from 'lucide-react';
import Backdrop from './components/Backdrop';
import BootSplash from './components/BootSplash';
import CommandBar from './components/CommandBar';
import KpiStrip from './components/KpiStrip';
import MapView from './components/MapView';
import { BasemapSwitcher, LayerDock, Legend, type LayerFlags } from './components/MapControls';
import DockPanel from './components/DockPanel';
import TriageRail from './components/TriageRail';
import DetailDrawer from './components/DetailDrawer';
import ClassMix from './components/ClassMix';
import FacilityView from './components/FacilityView';
import { DEFAULT_BASEMAP, type Basemap } from './lib/basemaps';
import { useConsole } from './lib/useConsole';
import { DEMO_MODE } from './lib/api';

const SCENARIOS = [
  { id: 'evt_jamnagar_incident_02', label: 'Jamnagar 11.3σ', tone: '#FF3B4E', zoom: 10.5 },
  { id: 'evt_ntro_novelty_01', label: 'NTRO novelty', tone: '#C084FC', zoom: 9.5 },
  { id: 'evt_odisha_unknown_01', label: 'Odisha unmapped', tone: '#C084FC', zoom: 9.5 },
  { id: 'evt_similipal_wildfire_12', label: 'Similipal wildfire', tone: '#FF6B2C', zoom: 9 },
  { id: 'evt_jamnagar_flare_baseline', label: 'Routine flare', tone: '#FBBF24', zoom: 10.5 },
  { id: 'evt_bhadla_solar_fp_01', label: 'Solar false positive', tone: '#64748B', zoom: 9.5 },
];

export default function App() {
  const state = useConsole();
  const [booted, setBooted] = useState(false);
  const [basemap, setBasemap] = useState<Basemap>(DEFAULT_BASEMAP);
  const [layers, setLayers] = useState<LayerFlags>({ events: true, risk: false, facilities: true, heat: false });
  const [focus, setFocus] = useState<{ lat: number; lon: number; zoom?: number } | null>(null);
  const [facility, setFacility] = useState<{ id: string; name: string } | null>(null);

  const lastFlown = useRef<string | null>(null);

  const selectAndFly = (id: string, zoom = 9.5) => {
    const ev = state.events.find((e) => e.event_id === id);
    state.setSelectedId(id);
    lastFlown.current = id; // claim the camera so the effect below does not override the zoom
    if (ev) setFocus({ lat: ev.centroid.lat, lon: ev.centroid.lon, zoom });
  };

  // Selection is bidirectional: picking a queue row eases the camera onto its pin.
  // Zoom is left undefined so the map keeps the operator's current scale.
  useEffect(() => {
    const id = state.selectedId;
    if (!id || lastFlown.current === id) return;
    lastFlown.current = id;
    const ev = state.events.find((e) => e.event_id === id);
    if (ev) setFocus({ lat: ev.centroid.lat, lon: ev.centroid.lon });
  }, [state.selectedId, state.events]);

  // Console keys: Escape steps back out of facility view -> drawer, "/" jumps to search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (facility) setFacility(null);
        else if (state.selectedId) state.setSelectedId(null);
      }
      if (e.key === '/' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[placeholder^="Search"]')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [facility, state.selectedId, state.setSelectedId]);

  const scenarios = useMemo(
    () => SCENARIOS.filter((s) => state.events.some((e) => e.event_id === s.id)),
    [state.events],
  );

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden">
      <Backdrop />
      {!booted && <BootSplash onDone={() => setBooted(true)} />}

      <CommandBar state={state} />

      {/* offline / cached banner — never a white screen */}
      <AnimatePresence>
        {state.link === 'cached' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={`relative z-20 flex items-center gap-2 border-b px-4 py-1.5 backdrop-blur-xl ${
              DEMO_MODE
                ? 'border-neon-ice/25 bg-neon-ice/[0.07]'
                : 'border-neon-ember/25 bg-neon-ember/[0.08]'
            }`}
          >
            <CloudOff size={12} className={DEMO_MODE ? 'text-neon-ice' : 'text-neon-ember'} />
            <span
              className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
                DEMO_MODE ? 'text-neon-ice' : 'text-neon-ember'
              }`}
            >
              {DEMO_MODE
                ? 'Hosted demo — bundled synthetic snapshot, 208 events'
                : 'Service unreachable — showing the cached synthetic snapshot'}
            </span>
            <span className="font-mono text-[10px] text-slate-500">
              {DEMO_MODE ? (
                <>
                  live telemetry runs against the service —{' '}
                  <span className="text-slate-300">python3 server/mock_api.py</span> locally
                </>
              ) : (
                <>
                  start it with <span className="text-slate-300">python3 server/mock_api.py</span>
                </>
              )}
            </span>
            {!DEMO_MODE && (
              <button onClick={() => void state.reload()} className="btn-glass ml-auto !py-1">
                Retry link
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10 flex min-h-0 flex-1">
        {/* map canvas */}
        <section className="relative min-w-0 flex-1">
          <MapView
            events={state.visible}
            risk={state.risk}
            facilities={state.facilities}
            basemap={basemap}
            layers={layers}
            selectedId={state.selectedId}
            onSelect={(id) => selectAndFly(id, 11)}
            focus={focus}
          />

          {/* top overlay: KPIs + scenario deck */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3">
            <div className="pointer-events-none mx-auto w-full max-w-[900px]">
              <KpiStrip state={state} />
            </div>

            <div className="pointer-events-auto mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
              <span className="label mr-1 flex items-center gap-1.5">
                <Crosshair size={10} /> Scenarios
              </span>
              {scenarios.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectAndFly(s.id, s.zoom)}
                  data-active={state.selectedId === s.id}
                  className="btn-glass !py-1 backdrop-blur-xl"
                  style={state.selectedId === s.id ? { borderColor: `${s.tone}66`, color: s.tone } : undefined}
                >
                  <span style={{ color: s.tone }}>●</span>
                  {s.label}
                </button>
              ))}
              <button
                onClick={() => {
                  state.setSelectedId(null);
                  setFocus({ lat: 22.6, lon: 79.2, zoom: 4.15 });
                }}
                className="btn-glass !py-1 backdrop-blur-xl"
              >
                <Globe2 size={11} /> National view
              </button>
            </div>
          </div>

          {/* left dock — every panel folds into its own labelled tab */}
          <div className="pointer-events-none absolute bottom-5 left-3 top-[152px] z-10 flex flex-col justify-between">
            <div className="space-y-2.5">
              <DockPanel id="layers" label="Layers" icon={<Layers size={13} />} tone="#22D3EE">
                <LayerDock layers={layers} onChange={setLayers} />
              </DockPanel>
              <DockPanel
                id="mix"
                label="Class mix"
                icon={<PieChart size={13} />}
                tone="#C084FC"
                defaultOpen={false}
              >
                <ClassMix state={state} />
              </DockPanel>
            </div>
            <div className="space-y-2.5">
              <DockPanel id="legend" label="Severity" icon={<Thermometer size={13} />} tone="#FF6B2C">
                <Legend />
              </DockPanel>
              <div className="pointer-events-auto pl-[36px]">
                <BasemapSwitcher active={basemap} onChange={setBasemap} />
              </div>
            </div>
          </div>

          {/* replay progress */}
          <AnimatePresence>
            {state.replay.active && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className="glass absolute bottom-3 left-1/2 z-10 w-[420px] -translate-x-1/2 rounded-2xl px-4 py-2.5"
              >
                <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
                  <span className="uppercase tracking-[0.16em] text-neon-amber">Replay · {state.replay.speed}×</span>
                  <span>
                    {state.replay.virtualTime
                      ? `${state.replay.virtualTime.slice(0, 10)} ${state.replay.virtualTime.slice(11, 19)}Z`
                      : '—'}
                  </span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-neon-amber to-neon-ember"
                    animate={{ width: `${state.replay.progress}%` }}
                    transition={{ ease: 'linear', duration: 0.4 }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* triage rail + drawer */}
        <div className="relative z-10 flex">
          <TriageRail state={state} />
          <DetailDrawer state={state} onOpenFacility={setFacility} />
        </div>
      </main>

      {facility && (
        <FacilityView
          facilityId={facility.id}
          facilityName={facility.name}
          events={state.events}
          onClose={() => setFacility(null)}
          onSelectEvent={(id) => {
            setFacility(null);
            selectAndFly(id, 11);
          }}
        />
      )}
    </div>
  );
}

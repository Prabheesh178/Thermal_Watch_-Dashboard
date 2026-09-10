import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, animate, type PanInfo } from 'motion/react';

export type SheetSnap = 'peek' | 'half' | 'full';

/**
 * Draggable bottom sheet for the phone layout. Three snap points, flick-aware:
 * a fast drag jumps a stop rather than snapping back to the nearest one, which is
 * what a thumb expects. The grabber is also a button, so the sheet is usable
 * without a drag gesture at all.
 */
export default function BottomSheet({
  snap,
  onSnapChange,
  header,
  children,
  peek = 172,
}: {
  snap: SheetSnap;
  onSnapChange: (s: SheetSnap) => void;
  header: React.ReactNode;
  children: React.ReactNode;
  peek?: number;
}) {
  const [vh, setVh] = useState(() => (typeof window === 'undefined' ? 800 : window.innerHeight));
  const heights: Record<SheetSnap, number> = {
    peek,
    half: Math.round(vh * 0.52),
    full: Math.round(vh * 0.9),
  };

  const height = useMotionValue(heights[snap]);
  const dragging = useRef(false);

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (dragging.current) return;
    const controls = animate(height, heights[snap], {
      type: 'spring',
      stiffness: 420,
      damping: 40,
    });
    return controls.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, vh]);

  const order: SheetSnap[] = ['peek', 'half', 'full'];

  const settle = (_: unknown, info: PanInfo) => {
    dragging.current = false;
    const current = height.get();
    const flick = info.velocity.y;
    let target: SheetSnap;

    if (flick < -600) target = snap === 'peek' ? 'half' : 'full';
    else if (flick > 600) target = snap === 'full' ? 'half' : 'peek';
    else {
      target = order.reduce((best, key) =>
        Math.abs(heights[key] - current) < Math.abs(heights[best] - current) ? key : best,
      'peek');
    }

    onSnapChange(target);
    animate(height, heights[target], { type: 'spring', stiffness: 420, damping: 40 });
  };

  return (
    <motion.section
      style={{ height }}
      className="glass-quiet pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex flex-col
                 rounded-t-2xl border-t border-white/[0.1] shadow-[0_-20px_60px_-30px_rgba(0,0,0,1)]"
    >
      <motion.div
        onPanStart={() => {
          dragging.current = true;
        }}
        onPan={(_: unknown, info: PanInfo) => {
          height.set(Math.min(heights.full, Math.max(72, height.get() - info.delta.y)));
        }}
        onPanEnd={settle}
        className="shrink-0 touch-none px-3 pt-2"
      >
        <button
          onClick={() => onSnapChange(snap === 'full' ? 'peek' : snap === 'half' ? 'full' : 'half')}
          aria-label="Resize queue"
          className="mx-auto block h-1 w-10 rounded-full bg-white/25 transition hover:bg-white/40"
        />
        <div className="pt-2">{header}</div>
      </motion.div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </motion.section>
  );
}

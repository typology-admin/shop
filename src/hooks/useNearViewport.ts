import { useEffect, useState } from 'react';

/** True when a canvas Y band is near the current window (for lazy image loads). */
export function useNearViewport(
  canvasY: number,
  canvasExtent: number,
  scale: number,
  padPx = 1400,
): boolean {
  const [near, setNear] = useState(() => {
    if (typeof window === 'undefined' || scale <= 0) return true;
    const top = window.scrollY - padPx;
    const bottom = window.scrollY + window.innerHeight + padPx;
    const y0 = (canvasY - canvasExtent) * scale;
    const y1 = (canvasY + canvasExtent) * scale;
    return y1 >= top && y0 <= bottom;
  });

  useEffect(() => {
    if (scale <= 0) {
      setNear(true);
      return;
    }

    let frame = 0;
    function measure() {
      frame = 0;
      const top = window.scrollY - padPx;
      const bottom = window.scrollY + window.innerHeight + padPx;
      // Items appear in each loop copy; treat infinite scroll by folding into one period
      // only for distance — callers pass absolute canvas Y including copy offset when needed.
      const y0 = (canvasY - canvasExtent) * scale;
      const y1 = (canvasY + canvasExtent) * scale;
      const next = y1 >= top && y0 <= bottom;
      setNear((prev) => (prev === next ? prev : next));
    }

    function onScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    }

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [canvasY, canvasExtent, scale, padPx]);

  return near;
}

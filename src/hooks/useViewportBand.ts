import { useEffect, useState } from 'react';

export type ViewportBand = {
  /** Expanded top (scrollY - pad). */
  top: number;
  /** Expanded bottom (scrollY + innerHeight + pad). */
  bottom: number;
};

/** Single shared scroll subscription — one window listener for the whole app. */
type Listener = () => void;

let frame = 0;
let refs = 0;
const listeners = new Set<Listener>();

function tick() {
  frame = 0;
  for (const wake of listeners) wake();
}

function onScroll() {
  if (frame) return;
  frame = window.requestAnimationFrame(tick);
}

function retain() {
  refs += 1;
  if (refs === 1) {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }
}

function release() {
  refs = Math.max(0, refs - 1);
  if (refs === 0) {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    if (frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
  }
}

/** Subscribe to scroll/resize (rAF-coalesced). Prefer Board-level use over per-node. */
export function useScrollEpoch(): number {
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    retain();
    const wake = () => setEpoch((n) => n + 1);
    listeners.add(wake);
    return () => {
      listeners.delete(wake);
      release();
    };
  }, []);
  return epoch;
}

export function readViewportBand(padPx = 0): ViewportBand {
  if (typeof window === 'undefined') return { top: -padPx, bottom: 2000 + padPx };
  const top = window.scrollY - padPx;
  const bottom = window.scrollY + window.innerHeight + padPx;
  return { top, bottom };
}

export function bandOverlaps(
  band: ViewportBand,
  canvasY: number,
  canvasExtent: number,
  scale: number,
): boolean {
  if (scale <= 0) return true;
  const y0 = (canvasY - canvasExtent) * scale;
  const y1 = (canvasY + canvasExtent) * scale;
  return y1 >= band.top && y0 <= band.bottom;
}

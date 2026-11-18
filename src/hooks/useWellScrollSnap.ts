import { useEffect, useRef } from 'react';
import { boardLoopOffset, getActiveViewZoom, scrollTopForCanvasY } from '../lib/canvas.ts';

type Options = {
  /** Canvas Y of each gravity well (section centers). */
  wellYs: number[];
  zoom?: number;
  enabled?: boolean;
  /** Public infinite board copies; 1 = no loop. */
  loopCopies?: number;
};

const NEAR_PX = 140;
const SETTLE_MS = 140;

function chromeBlocksSnap(): boolean {
  const html = document.documentElement;
  return (
    html.classList.contains('cutout-editor-open') ||
    html.classList.contains('account-modal-open') ||
    html.classList.contains('item-modal-open') ||
    html.classList.contains('chrome-overlay-open')
  );
}

function buildSnapTops(wellYs: number[], zoom: number, loopCopies: number): number[] {
  if (wellYs.length === 0) return [];
  const base = wellYs
    .map((y) => scrollTopForCanvasY(y, zoom))
    .sort((a, b) => a - b);
  if (loopCopies < 2) return base;

  const loop = boardLoopOffset();
  if (loop <= 0) return base;
  const tops: number[] = [];
  for (let copy = 0; copy < loopCopies; copy += 1) {
    for (const top of base) {
      const relative = top - loop;
      tops.push(relative + copy * loop);
    }
  }
  return [...new Set(tops.map((n) => Math.round(n)))].sort((a, b) => a - b);
}

function nearestIndex(tops: number[], y: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < tops.length; i += 1) {
    const d = Math.abs((tops[i] ?? 0) - y);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/**
 * Snap window scroll to gravity wells after the user stops scrolling.
 *
 * Important: no non-passive `wheel` listener. A preventDefault wheel handler
 * forces the browser to wait on the main thread before scrolling (Chrome
 * "wheel input event was delayed" violations).
 */
export function useWellScrollSnap(options: Options) {
  const { wellYs, zoom = getActiveViewZoom(), enabled = true, loopCopies = 1 } = options;
  const wellKey = wellYs.map((y) => Math.round(y)).join('|');
  const snappingRef = useRef(false);
  const settleTimer = useRef(0);

  useEffect(() => {
    if (!enabled || wellYs.length === 0) return;

    const tops = () => buildSnapTops(wellYs, zoom, loopCopies);

    function snapTo(index: number) {
      const list = tops();
      if (!list.length) return;
      const clamped = Math.max(0, Math.min(list.length - 1, index));
      const target = list[clamped];
      if (target == null) return;
      if (Math.abs(window.scrollY - target) < 2) return;
      snappingRef.current = true;
      window.scrollTo({ top: target, behavior: 'smooth' });
      window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(() => {
        snappingRef.current = false;
        const again = tops();
        void nearestIndex(again, window.scrollY);
      }, 420);
    }

    function maybeSnap(forceNearest: boolean) {
      if (snappingRef.current || chromeBlocksSnap()) return;
      const list = tops();
      if (!list.length) return;
      const idx = nearestIndex(list, window.scrollY);
      const top = list[idx];
      if (top == null) return;
      const dist = Math.abs(window.scrollY - top);
      if (forceNearest || dist <= NEAR_PX) {
        snapTo(idx);
      }
    }

    function onScroll() {
      if (snappingRef.current || chromeBlocksSnap()) return;
      window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(() => maybeSnap(false), SETTLE_MS);
    }

    function onScrollEnd() {
      maybeSnap(true);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scrollend', onScrollEnd as EventListener);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scrollend', onScrollEnd as EventListener);
      window.clearTimeout(settleTimer.current);
    };
  }, [enabled, wellKey, zoom, loopCopies, wellYs]);
}

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

const ESCAPE_DELTA = 160;
const NEAR_PX = 96;
const SETTLE_MS = 120;

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
      // scrollTopForCanvasY already includes one loop offset; fold into each copy band.
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
 * Window scroll snaps to gravity wells. Small wheel/trackpad motion stays locked;
 * a stronger gesture releases to the next well.
 */
export function useWellScrollSnap(options: Options) {
  const { wellYs, zoom = getActiveViewZoom(), enabled = true, loopCopies = 1 } = options;
  const wellKey = wellYs.map((y) => Math.round(y)).join('|');
  const intentRef = useRef(0);
  const lockedRef = useRef(-1);
  const snappingRef = useRef(false);
  const settleTimer = useRef(0);

  useEffect(() => {
    if (!enabled || wellYs.length === 0) return;

    const tops = () => buildSnapTops(wellYs, zoom, loopCopies);

    function lockToNearest() {
      const list = tops();
      if (!list.length) return;
      lockedRef.current = nearestIndex(list, window.scrollY);
      intentRef.current = 0;
    }

    function snapTo(index: number) {
      const list = tops();
      if (!list.length) return;
      const clamped = Math.max(0, Math.min(list.length - 1, index));
      const target = list[clamped];
      if (target == null) return;
      lockedRef.current = clamped;
      intentRef.current = 0;
      snappingRef.current = true;
      window.scrollTo({ top: target, behavior: 'smooth' });
      window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(() => {
        snappingRef.current = false;
        // Correct after smooth scroll + infinite wrap.
        const again = tops();
        lockedRef.current = nearestIndex(again, window.scrollY);
      }, 420);
    }

    lockToNearest();

    function onWheel(event: WheelEvent) {
      if (event.ctrlKey || chromeBlocksSnap()) return;
      if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
      const list = tops();
      if (!list.length) return;

      if (lockedRef.current < 0) lockToNearest();
      const locked = lockedRef.current;
      const lockedTop = list[locked];
      if (lockedTop == null) return;

      const dist = Math.abs(window.scrollY - lockedTop);
      // Free-scroll when far from a well (e.g. after rail jump mid-flight).
      if (dist > NEAR_PX * 2 && !snappingRef.current) {
        intentRef.current = 0;
        return;
      }

      intentRef.current += event.deltaY;
      if (Math.abs(intentRef.current) < ESCAPE_DELTA) {
        event.preventDefault();
        if (dist > 2 && !snappingRef.current) {
          // Soft hold: ease back toward the well while resisting escape.
          window.scrollTo({ top: lockedTop, behavior: 'auto' });
        }
        return;
      }

      event.preventDefault();
      const dir = intentRef.current > 0 ? 1 : -1;
      intentRef.current = 0;
      snapTo(locked + dir);
    }

    function onScroll() {
      if (snappingRef.current || chromeBlocksSnap()) return;
      window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(() => {
        if (snappingRef.current || chromeBlocksSnap()) return;
        const list = tops();
        if (!list.length) return;
        const idx = nearestIndex(list, window.scrollY);
        const top = list[idx];
        if (top == null) return;
        if (Math.abs(window.scrollY - top) <= NEAR_PX) {
          snapTo(idx);
        } else {
          lockedRef.current = idx;
          intentRef.current = 0;
        }
      }, SETTLE_MS);
    }

    function onScrollEnd() {
      if (chromeBlocksSnap()) return;
      const list = tops();
      if (!list.length) return;
      snapTo(nearestIndex(list, window.scrollY));
    }

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scrollend', onScrollEnd as EventListener);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scrollend', onScrollEnd as EventListener);
      window.clearTimeout(settleTimer.current);
    };
  }, [enabled, wellKey, zoom, loopCopies, wellYs]);
}

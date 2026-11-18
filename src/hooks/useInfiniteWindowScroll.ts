import { useEffect } from 'react';

export function useInfiniteWindowScroll(enabled: boolean, copies: number) {
  useEffect(() => {
    if (!enabled || copies < 2) return;

    const root = document.documentElement;
    const previous = root.style.overscrollBehaviorY;
    root.style.overscrollBehaviorY = 'none';

    // Do not wrap the top edge until the user has actually scrolled down.
    // Otherwise the first scroll/landing event at y≈0 teleports into copy 1
    // while the board still only prefetches copy 0 — blank "Loading images…".
    let armed = false;

    function oneSet(): number {
      const board = document.querySelector('.board-scroll');
      if (!(board instanceof HTMLElement)) return 0;
      return board.scrollHeight / copies;
    }

    function onScroll() {
      const one = oneSet();
      if (one < window.innerHeight) return;
      const y = window.scrollY;
      if (y > 10) armed = true;
      if (y >= one * (copies - 1)) {
        window.scrollTo({ top: y - one, behavior: 'instant' });
      } else if (armed && y <= 0) {
        window.scrollTo({ top: y + one, behavior: 'instant' });
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      root.style.overscrollBehaviorY = previous;
    };
  }, [enabled, copies]);
}

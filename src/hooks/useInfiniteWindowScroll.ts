import { useEffect } from 'react';

export function useInfiniteWindowScroll(enabled: boolean, copies: number) {
  useEffect(() => {
    if (!enabled || copies < 2) return;

    const root = document.documentElement;
    const previous = root.style.overscrollBehaviorY;
    root.style.overscrollBehaviorY = 'none';

    function oneSet(): number {
      const board = document.querySelector('.board-scroll');
      if (!(board instanceof HTMLElement)) return 0;
      return board.scrollHeight / copies;
    }

    function onScroll() {
      const one = oneSet();
      if (one < window.innerHeight) return;
      const y = window.scrollY;
      if (y >= one * (copies - 1)) {
        window.scrollTo({ top: y - one, behavior: 'instant' });
      } else if (y <= 0) {
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

import { useEffect, useRef, useState } from 'react';
import { CANVAS_WIDTH } from '../../shared/constants.ts';
import type { BoardSection } from '../lib/sections.ts';

type Props = {
  sections: BoardSection[];
};

const HIDE_DELAY_MS = 3200;

function canvasScale() {
  return window.innerWidth / CANVAS_WIDTH;
}

function scrollTopForSection(y: number) {
  const scale = canvasScale();
  const target = y * scale - window.innerHeight * 0.28;
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  return Math.min(max, Math.max(0, target));
}

function maxScroll() {
  return Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
}

export function SectionRail({ sections }: Props) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scrollMax, setScrollMax] = useState(1);
  const hideTimer = useRef<number>(0);
  const hovering = useRef(false);

  useEffect(() => {
    function measure() {
      const max = maxScroll();
      setScrollMax(max);
      setProgress(window.scrollY / max);
    }

    function reveal() {
      measure();
      setVisible(true);
      window.clearTimeout(hideTimer.current);
      if (hovering.current) return;
      hideTimer.current = window.setTimeout(() => setVisible(false), HIDE_DELAY_MS);
    }

    measure();
    window.addEventListener('scroll', reveal, { passive: true });
    document.addEventListener('scroll', reveal, { passive: true });
    window.addEventListener('resize', measure);
    const observer = new ResizeObserver(measure);
    observer.observe(document.documentElement);
    return () => {
      window.removeEventListener('scroll', reveal);
      document.removeEventListener('scroll', reveal);
      window.removeEventListener('resize', measure);
      observer.disconnect();
      window.clearTimeout(hideTimer.current);
    };
  }, []);

  const ranked = [...sections].sort((a, b) => a.y - b.y || a.sortOrder - b.sortOrder);

  function holdOpen() {
    hovering.current = true;
    window.clearTimeout(hideTimer.current);
    setVisible(true);
  }

  function releaseOpen() {
    hovering.current = false;
    hideTimer.current = window.setTimeout(() => setVisible(false), HIDE_DELAY_MS);
  }

  return (
    <div className={`scroll-rail${visible ? ' is-active' : ''}`}>
      <span
        className="scroll-rail-hit"
        aria-hidden="true"
        onPointerEnter={holdOpen}
        onPointerLeave={releaseOpen}
      />
      <span className="scroll-rail-line" aria-hidden="true" />
      <span className="scroll-rail-thumb" style={{ top: `${progress * 100}%` }} aria-hidden="true" />
      {ranked.length > 0 ? (
        <div className={`section-hooks${visible ? ' is-visible' : ''}`}>
          {ranked.map((section) => {
            const t = scrollTopForSection(section.y) / scrollMax;
            return (
              <button
                key={section.id}
                type="button"
                className="section-hook chrome-pill"
                style={{ top: `${Math.min(96, Math.max(4, t * 100))}%` }}
                onPointerEnter={holdOpen}
                onPointerLeave={releaseOpen}
                onClick={() => {
                  window.clearTimeout(hideTimer.current);
                  setVisible(true);
                  window.scrollTo({
                    top: scrollTopForSection(section.y),
                    behavior: 'smooth',
                  });
                  if (!hovering.current) {
                    hideTimer.current = window.setTimeout(() => setVisible(false), HIDE_DELAY_MS);
                  }
                }}
              >
                {section.name}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

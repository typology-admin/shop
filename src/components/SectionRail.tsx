import { useEffect, useRef, useState } from 'react';
import { useSiteSettings } from '../hooks/useSiteSettings.ts';
import { loopScrollProgress, scrollFractionForCanvasY, scrollTopForCanvasY } from '../lib/canvas.ts';

export type SectionRailItem = {
  id: string;
  name: string;
  y: number;
  sortOrder?: number;
  items?: Array<{ emoji: string; label: string }>;
};

type Props = {
  sections: SectionRailItem[];
};

export function SectionRail({ sections }: Props) {
  const { settings } = useSiteSettings();
  const hideMs = settings.sectionHooksHideMs;
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const hideTimer = useRef<number>(0);
  const hovering = useRef(false);

  useEffect(() => {
    function measure() {
      setProgress(loopScrollProgress());
    }

    function reveal() {
      measure();
      setVisible(true);
      window.clearTimeout(hideTimer.current);
      if (hovering.current) return;
      hideTimer.current = window.setTimeout(() => setVisible(false), hideMs);
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
  }, [hideMs]);

  const ranked = [...sections].sort((a, b) => a.y - b.y || (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  function holdOpen() {
    hovering.current = true;
    window.clearTimeout(hideTimer.current);
    setVisible(true);
  }

  function releaseOpen() {
    hovering.current = false;
    hideTimer.current = window.setTimeout(() => setVisible(false), hideMs);
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
            const t = scrollFractionForCanvasY(section.y);
            const kit = (section.items ?? []).map((item) => `${item.emoji} ${item.label}`).join(' · ');
            return (
              <button
                key={section.id}
                type="button"
                className="section-hook chrome-pill"
                title={kit || section.name}
                style={{ top: `${Math.min(96, Math.max(4, t * 100))}%` }}
                onPointerEnter={holdOpen}
                onPointerLeave={releaseOpen}
                onClick={() => {
                  window.clearTimeout(hideTimer.current);
                  setVisible(true);
                  window.scrollTo({
                    top: scrollTopForCanvasY(section.y),
                    behavior: 'smooth',
                  });
                  if (!hovering.current) {
                    hideTimer.current = window.setTimeout(() => setVisible(false), hideMs);
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

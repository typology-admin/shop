import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MOBILE_BREAKPOINT } from '../../shared/constants.ts';
import { useContactLinks } from '../hooks/useContactLinks.ts';
import { useMediaQuery } from '../hooks/useMediaQuery.ts';
import { openContactHref } from '../lib/contact.ts';

const HANDLE = 28;
const TOGGLE_PX = 10;
const OPEN_PX = 36;

export function SiteFooter({ overlay = false }: { overlay?: boolean }) {
  const navigate = useNavigate();
  const { links } = useContactLinks();
  const isMobile = useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT}px)`);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const footerRef = useRef<HTMLElement>(null);
  const dragRef = useRef({
    active: false,
    startY: 0,
    dy: 0,
    moved: false,
  });

  useEffect(() => {
    if (!isMobile) {
      setOpen(false);
      setDragging(false);
      footerRef.current?.style.removeProperty('--footer-drag');
    }
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile || !open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobile, open]);

  function setDrag(px: number) {
    footerRef.current?.style.setProperty('--footer-drag', `${px}px`);
  }

  function clearDrag() {
    footerRef.current?.style.removeProperty('--footer-drag');
  }

  function clampDy(dy: number) {
    const height = footerRef.current?.offsetHeight ?? 160;
    const range = Math.max(HANDLE, height - HANDLE);
    if (open) return Math.max(0, Math.min(range, dy));
    return Math.max(-range, Math.min(0, dy));
  }

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (!isMobile) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { active: true, startY: event.clientY, dy: 0, moved: false };
    setDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragRef.current.active) return;
    const dy = clampDy(event.clientY - dragRef.current.startY);
    dragRef.current.dy = dy;
    if (Math.abs(dy) > TOGGLE_PX) dragRef.current.moved = true;
    setDrag(dy);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    const { dy, moved } = dragRef.current;
    setDragging(false);
    clearDrag();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (moved) {
      if (!open && dy < -OPEN_PX) setOpen(true);
      else if (open && dy > OPEN_PX) setOpen(false);
    }
  }

  function handleHandleClick() {
    if (!isMobile) return;
    if (dragRef.current.moved) return;
    setOpen((current) => !current);
  }

  const className = [
    'shop-footer',
    overlay ? 'is-overlay' : '',
    isMobile ? 'is-sheet' : '',
    isMobile && open ? 'is-open' : '',
    isMobile && dragging ? 'is-dragging' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <footer ref={footerRef} className={className}>
      <button
        type="button"
        className="shop-footer-handle"
        aria-label={open ? 'Close footer' : 'Open footer'}
        aria-expanded={open}
        aria-controls="shop-footer-panel"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleHandleClick}
      />
      <div
        id="shop-footer-panel"
        className="shop-footer-panel"
        inert={isMobile && !open ? true : undefined}
      >
        <span className="shop-footer-mark">® typology.network 2026</span>
        <nav className="shop-footer-links" aria-label="Footer">
          {links.map((link) => (
            <button
              key={link.id}
              type="button"
              className="shop-footer-link"
              onClick={() => {
                setOpen(false);
                openContactHref(link.href, navigate);
              }}
            >
              {link.label}
            </button>
          ))}
          <Link className="shop-footer-link" to="/network" onClick={() => setOpen(false)}>
            network
          </Link>
          <Link className="shop-footer-link" to="/terms" onClick={() => setOpen(false)}>
            terms
          </Link>
          <Link className="shop-footer-link" to="/privacy" onClick={() => setOpen(false)}>
            privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}

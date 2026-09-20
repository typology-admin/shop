import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PUBLIC_BOARD_COPIES } from '../../shared/constants.ts';
import { Board } from '../components/Board.tsx';
import { ItemModal } from '../components/ItemModal.tsx';
import { SectionRail } from '../components/SectionRail.tsx';
import { SiteChrome } from '../components/SiteChrome.tsx';
import { SiteFooter } from '../components/SiteFooter.tsx';
import { useBoardSections } from '../hooks/useBoardSections.ts';
import { useInfiniteWindowScroll } from '../hooks/useInfiniteWindowScroll.ts';
import { useWellScrollSnap } from '../hooks/useWellScrollSnap.ts';
import { useItems } from '../hooks/useItems.ts';
import { useNetworkItems } from '../hooks/useNetworkItems.ts';
import { useBoardZoom, useSiteSettings } from '../hooks/useSiteSettings.ts';
import { scrollTopForCanvasY, setActiveViewZoom } from '../lib/canvas.ts';
import { jumpToSection, pickLandingSection } from '../lib/sections.ts';
import type { Item } from '../lib/types.ts';

export function PublicBoard() {
  const { items, status, error } = useItems();
  const { items: networkItems } = useNetworkItems();
  const { sections } = useBoardSections();
  const zoom = useBoardZoom();
  const { settings } = useSiteSettings();
  const landed = useRef(false);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('item');
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const looping = status === 'ready' && items.length > 0;
  const wellYs = sections.map((section) => section.y);

  useInfiniteWindowScroll(looping, PUBLIC_BOARD_COPIES);
  useWellScrollSnap({
    wellYs,
    zoom,
    enabled: status === 'ready' && wellYs.length > 0,
    loopCopies: looping ? PUBLIC_BOARD_COPIES : 1,
  });

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--board', settings.boardColor);
    return () => {
      root.style.removeProperty('--board');
    };
  }, [settings.boardColor]);

  const openItem = useCallback(
    (item: Item | string) => {
      const id = typeof item === 'string' ? item : item.id;
      setParams({ item: id }, { replace: true });
    },
    [setParams],
  );

  const closeItem = useCallback(() => {
    setParams({}, { replace: true });
  }, [setParams]);

  useLayoutEffect(() => {
    setActiveViewZoom(zoom);
    if (status !== 'ready' || items.length === 0) return;

    if (!landed.current) {
      const deep = selectedId ? items.find((item) => item.id === selectedId) : null;
      if (deep) {
        landed.current = true;
        const jump = () => window.scrollTo({ top: scrollTopForCanvasY(deep.y), behavior: 'instant' });
        jump();
        const frame = window.requestAnimationFrame(jump);
        return () => window.cancelAnimationFrame(frame);
      }
      if (sections.length === 0) return;
      const scene = pickLandingSection(sections);
      if (!scene) return;
      landed.current = true;
      const jump = () => jumpToSection(scene, 'instant');
      jump();
      const frame = window.requestAnimationFrame(jump);
      const timer = window.setTimeout(jump, 120);
      return () => {
        window.cancelAnimationFrame(frame);
        window.clearTimeout(timer);
      };
    }
  }, [status, items, sections, zoom, selectedId]);

  const chrome = (
    <SiteChrome
      variant="shop"
      shopItems={items}
      networkItems={networkItems}
      sections={sections}
      onShopItem={openItem}
    />
  );

  if (status === 'loading') {
    return (
      <div className="loading-screen">
        {chrome}
        <div>
          <div className="loading-mark" />
          <h1 className="wordmark wordmark-ui">typology network</h1>
          <p className="lede">Laying out the board…</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="empty-screen">
        {chrome}
        <div>
          <h1 className="wordmark wordmark-ui">typology network</h1>
          <p className="lede">{error ?? 'The board could not be loaded.'}</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="empty-screen">
        {chrome}
        <SectionRail sections={sections} />
        <div>
          <h1 className="wordmark wordmark-ui">typology network</h1>
          <p className="lede">Nothing laid out yet. The board is empty.</p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <>
      {chrome}
      <SectionRail sections={sections} />
      <Board
        items={items}
        mode="public"
        zoom={zoom}
        backgroundColor={settings.boardColor}
        onSelect={(id) => {
          if (id) openItem(id);
        }}
      />
      <SiteFooter overlay />
      {selected ? <ItemModal item={selected} onClose={closeItem} /> : null}
    </>
  );
}

import {
  CANVAS_BOTTOM_PAD,
  CANVAS_WIDTH,
  DEFAULT_DESKTOP_ZOOM,
  DEFAULT_MOBILE_ZOOM,
  MIN_CANVAS_HEIGHT,
  MIN_VIEW_ZOOM,
  MAX_VIEW_ZOOM,
  MOBILE_BREAKPOINT,
} from '../../shared/constants.ts';
import type { Item } from './types.ts';

let activeViewZoom = DEFAULT_DESKTOP_ZOOM;

export function clampViewZoom(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_DESKTOP_ZOOM;
  return Math.min(MAX_VIEW_ZOOM, Math.max(MIN_VIEW_ZOOM, value));
}

export function setActiveViewZoom(zoom: number): void {
  activeViewZoom = clampViewZoom(zoom);
}

export function getActiveViewZoom(): number {
  return activeViewZoom;
}

export function viewZoomForWidth(
  viewportWidth: number,
  desktopZoom = DEFAULT_DESKTOP_ZOOM,
  mobileZoom = DEFAULT_MOBILE_ZOOM,
): number {
  return clampViewZoom(viewportWidth <= MOBILE_BREAKPOINT ? mobileZoom : desktopZoom);
}

export function boardScale(viewportWidth: number, zoom = activeViewZoom): number {
  return (viewportWidth / CANVAS_WIDTH) * clampViewZoom(zoom);
}

export function itemExtent(item: Item): number {
  const w = item.image_width * item.scale;
  const h = item.image_height * item.scale;
  return Math.hypot(w, h) / 2;
}

export function contentBottom(items: Item[]): number {
  return items.reduce((max, item) => Math.max(max, item.y + itemExtent(item)), 0);
}

export function boardHeight(
  items: Item[],
  viewportWidth: number,
  viewportHeight: number,
  zoom = activeViewZoom,
): number {
  const scale = boardScale(viewportWidth, zoom);
  const fillViewport = scale > 0 ? viewportHeight / scale : MIN_CANVAS_HEIGHT;
  if (items.length === 0) {
    return Math.max(fillViewport, 1);
  }
  return Math.max(
    MIN_CANVAS_HEIGHT,
    fillViewport,
    contentBottom(items) + CANVAS_BOTTOM_PAD,
  );
}

export function viewportCenterOnCanvas(scale: number, scrollY: number, viewportHeight: number) {
  return {
    x: CANVAS_WIDTH / 2,
    y: (scrollY + viewportHeight / 2) / scale,
  };
}

export function scrollTopForCanvasY(y: number, zoom = activeViewZoom): number {
  const scale = boardScale(window.innerWidth, zoom);
  const target = y * scale - window.innerHeight * 0.28;
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  return Math.min(max, Math.max(0, target));
}

export function clampScale(value: number): number {
  return Math.min(4, Math.max(0.08, value));
}

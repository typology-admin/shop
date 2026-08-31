import {
  CANVAS_BOTTOM_PAD,
  CANVAS_WIDTH,
  MIN_CANVAS_HEIGHT,
} from '../../shared/constants.ts';
import type { Item } from './types.ts';

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
): number {
  const scale = viewportWidth / CANVAS_WIDTH;
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

export function clampScale(value: number): number {
  return Math.min(4, Math.max(0.08, value));
}

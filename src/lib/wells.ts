import { CANVAS_WIDTH } from '../../shared/constants.ts';
import type { BoardSection } from './sections.ts';

export type GravityWell = {
  id: string;
  x: number;
  y: number;
  sectionId?: string;
};

export const WELL_COLORS = ['#c8553d', '#3d7ea6', '#5b8c5a', '#b08d2f', '#7a5aa6'];

/** Minimum canvas-Y gap between gravity wells so scenes never stack. */
export const MIN_WELL_GAP = 700;

/**
 * Nudge a desired well Y so it stays at least `minGap` away from every other well.
 * Prefer pushing downward when colliding (keeps scroll order stable).
 */
export function resolveWellY(
  desiredY: number,
  occupiedYs: number[],
  minGap: number = MIN_WELL_GAP,
): number {
  let y = desiredY;
  const sorted = [...occupiedYs].sort((a, b) => a - b);
  for (const oy of sorted) {
    if (Math.abs(y - oy) < minGap) {
      y = oy + minGap;
    }
  }
  return y;
}

/** One well per section: window-horizontal center, section vertical center. */
export function wellForSection(section: BoardSection): GravityWell {
  return {
    id: `${section.id}-well`,
    x: CANVAS_WIDTH / 2,
    y: section.y,
    sectionId: section.id,
  };
}

export function wellsForSection(section: BoardSection): GravityWell[] {
  return [wellForSection(section)];
}

export function allWells(sections: BoardSection[]): Array<GravityWell & { sectionId: string; color: string }> {
  return sections.map((section, index) => ({
    ...wellForSection(section),
    sectionId: section.id,
    color: WELL_COLORS[index % WELL_COLORS.length] ?? WELL_COLORS[0]!,
  }));
}

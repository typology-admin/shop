import { CANVAS_WIDTH } from '../../shared/constants.ts';
import { footprintForItem, footprintFromFile, type ItemFootprint } from './itemMask.ts';
import type { BoardSection } from './sections.ts';
import type { Item } from './types.ts';

const CELL = 8;
const MARGIN = 96;
const ROTATIONS = [0, 90, 180, 270];

export type KnollPose = {
  id: string;
  x: number;
  y: number;
  rotation: number;
};

type Cell = { x: number; y: number };

type RotMask = {
  rotation: number;
  cells: Cell[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  height: number;
};

export function nearestSection(y: number, sections: BoardSection[]): BoardSection | null {
  if (sections.length === 0) return null;
  return [...sections].sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y))[0] ?? null;
}

export function sectionGravity(section: BoardSection): { x: number; y: number } {
  return { x: CANVAS_WIDTH / 2, y: section.y };
}

export function sectionBand(section: BoardSection, sections: BoardSection[]): { y0: number; y1: number } {
  const ranked = [...sections].sort((a, b) => a.y - b.y || a.sortOrder - b.sortOrder);
  const index = ranked.findIndex((row) => row.id === section.id);
  const prev = index > 0 ? ranked[index - 1] : null;
  const next = index >= 0 && index < ranked.length - 1 ? ranked[index + 1] : null;
  const y0 = prev ? (prev.y + section.y) / 2 : section.y - 720;
  const y1 = next ? (section.y + next.y) / 2 : section.y + 720;
  return { y0, y1 };
}

export function itemsForSection(items: Item[], section: BoardSection, sections: BoardSection[]): Item[] {
  return items.filter((item) => nearestSection(item.y, sections)?.id === section.id);
}

function rotatePoint(x: number, y: number, degrees: number): { x: number; y: number } {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function uniqueCells(cells: Cell[]): Cell[] {
  const seen = new Set<string>();
  const out: Cell[] = [];
  for (const cell of cells) {
    const key = `${cell.x},${cell.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cell);
  }
  return out;
}

function dilate(cells: Cell[], radius: number): Cell[] {
  if (radius <= 0) return cells;
  const seen = new Set<string>();
  const out: Cell[] = [];
  const r2 = radius * radius;
  for (const cell of cells) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (dx * dx + dy * dy > r2) continue;
        const x = cell.x + dx;
        const y = cell.y + dy;
        const key = `${x},${y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ x, y });
      }
    }
  }
  return out;
}

function maskForRotation(footprint: ItemFootprint, scale: number, rotation: number): RotMask {
  const cells: Cell[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of footprint.points) {
    const rotated = rotatePoint(point.x * scale, point.y * scale, rotation);
    const x = Math.round(rotated.x / CELL);
    const y = Math.round(rotated.y / CELL);
    cells.push({ x, y });
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const unique = uniqueCells(cells);
  return {
    rotation,
    cells: unique,
    minX,
    maxX,
    minY,
    maxY,
    height: maxY - minY + 1,
  };
}

class Occupancy {
  private readonly x0: number;
  private readonly y0: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly data: Uint8Array;

  constructor(x0: number, y0: number, cols: number, rows: number) {
    this.x0 = x0;
    this.y0 = y0;
    this.cols = cols;
    this.rows = rows;
    this.data = new Uint8Array(cols * rows);
  }

  private index(cx: number, cy: number): number | null {
    const x = cx - this.x0;
    const y = cy - this.y0;
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return null;
    return y * this.cols + x;
  }

  fits(ox: number, oy: number, cells: Cell[]): boolean {
    for (const cell of cells) {
      const index = this.index(ox + cell.x, oy + cell.y);
      if (index == null || this.data[index]) return false;
    }
    return true;
  }

  stamp(ox: number, oy: number, cells: Cell[]): void {
    for (const cell of cells) {
      const index = this.index(ox + cell.x, oy + cell.y);
      if (index != null) this.data[index] = 1;
    }
  }
}

function* spiral(cx: number, cy: number, maxRings: number): Generator<Cell> {
  yield { x: cx, y: cy };
  for (let ring = 1; ring <= maxRings; ring += 1) {
    for (let x = -ring; x <= ring; x += 1) {
      yield { x: cx + x, y: cy - ring };
      yield { x: cx + x, y: cy + ring };
    }
    for (let y = -ring + 1; y <= ring - 1; y += 1) {
      yield { x: cx - ring, y: cy + y };
      yield { x: cx + ring, y: cy + y };
    }
  }
}

function buildOccupancy(band: { y0: number; y1: number }): Occupancy {
  const x0 = Math.floor(MARGIN / CELL);
  const y0 = Math.floor((band.y0 + MARGIN * 0.25) / CELL);
  const x1 = Math.ceil((CANVAS_WIDTH - MARGIN) / CELL);
  const y1 = Math.ceil((band.y1 - MARGIN * 0.25) / CELL);
  return new Occupancy(x0, y0, Math.max(8, x1 - x0), Math.max(8, y1 - y0));
}

function placeOne(
  occupancy: Occupancy,
  masks: RotMask[],
  gravity: Cell,
  dilated: RotMask[],
): { x: number; y: number; rotation: number } | null {
  for (const cell of spiral(gravity.x, gravity.y, 56)) {
    let best: RotMask | null = null;
    for (let i = 0; i < masks.length; i += 1) {
      const mask = masks[i];
      if (!mask || !occupancy.fits(cell.x, cell.y, mask.cells)) continue;
      if (!best || mask.height < best.height) best = mask;
    }
    if (!best) continue;
    const stamp = dilated.find((row) => row.rotation === best.rotation) ?? best;
    occupancy.stamp(cell.x, cell.y, stamp.cells);
    return { x: cell.x * CELL, y: cell.y * CELL, rotation: best.rotation };
  }
  return null;
}

async function masksForItem(
  item: Item,
  file: Blob | undefined,
  radius: number,
): Promise<{ raw: RotMask[]; dilated: RotMask[] }> {
  const footprint: ItemFootprint = file
    ? await footprintFromFile(file, item.image_width, item.image_height)
    : await footprintForItem(item.image_path, item.image_width, item.image_height);
  const raw = ROTATIONS.map((rotation) => maskForRotation(footprint, item.scale, rotation));
  const dilated = raw.map((mask) => ({
    ...mask,
    cells: dilate(mask.cells, radius),
  }));
  return { raw, dilated };
}

export async function packSection(options: {
  items: Item[];
  section: BoardSection;
  sections: BoardSection[];
  gap: number;
  files?: Record<string, Blob>;
}): Promise<KnollPose[]> {
  const members = [...itemsForSection(options.items, options.section, options.sections)].sort(
    (a, b) => b.image_width * b.image_height * b.scale * b.scale - a.image_width * a.image_height * a.scale * a.scale,
  );
  if (members.length === 0) return [];

  const gravity = sectionGravity(options.section);
  const band = sectionBand(options.section, options.sections);
  const occupancy = buildOccupancy(band);
  const radius = Math.max(1, Math.round(options.gap / CELL / 2));
  const origin = { x: Math.round(gravity.x / CELL), y: Math.round(gravity.y / CELL) };
  const poses: KnollPose[] = [];

  for (const item of members) {
    const { raw, dilated } = await masksForItem(item, options.files?.[item.id], radius);
    const placed = placeOne(occupancy, raw, origin, dilated);
    poses.push(
      placed
        ? { id: item.id, ...placed }
        : { id: item.id, x: gravity.x, y: gravity.y, rotation: 0 },
    );
  }

  return poses;
}

export async function packNewItem(options: {
  item: Item;
  neighbors: Item[];
  section: BoardSection;
  sections: BoardSection[];
  gap: number;
  file?: Blob;
}): Promise<KnollPose> {
  const gravity = sectionGravity(options.section);
  const band = sectionBand(options.section, options.sections);
  const occupancy = buildOccupancy(band);
  const radius = Math.max(1, Math.round(options.gap / CELL / 2));
  const origin = { x: Math.round(gravity.x / CELL), y: Math.round(gravity.y / CELL) };

  for (const neighbor of options.neighbors) {
    const footprint = await footprintForItem(
      neighbor.image_path,
      neighbor.image_width,
      neighbor.image_height,
    );
    const mask = maskForRotation(footprint, neighbor.scale, neighbor.rotation);
    occupancy.stamp(
      Math.round(neighbor.x / CELL),
      Math.round(neighbor.y / CELL),
      dilate(mask.cells, radius),
    );
  }

  const { raw, dilated } = await masksForItem(options.item, options.file, radius);
  const placed = placeOne(occupancy, raw, origin, dilated);
  return placed
    ? { id: options.item.id, ...placed }
    : { id: options.item.id, x: gravity.x, y: gravity.y, rotation: 0 };
}

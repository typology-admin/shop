import { CANVAS_WIDTH, type KnollRotationMode } from '../../shared/constants.ts';
import { footprintForItem, footprintFromFile, type ItemFootprint } from './itemMask.ts';
import type { BoardSection } from './sections.ts';
import type { Item } from './types.ts';
import { wellsForSection, type GravityWell } from './wells.ts';

export type { KnollRotationMode };

export type KnollPose = {
  id: string;
  x: number;
  y: number;
  rotation: number;
};

const MARGIN = 64;
const HALF_PI = Math.PI / 2;
const TAU = Math.PI * 2;
const MAX_STEPS = 2400;
const COLLISION_ITERS = 6;
/** Extra canvas-space separation so soft PNG edges don't visually overlap. */
const HULL_GAP_PAD = 28;

type Well = { x: number; y: number; sectionId?: string };

export type GravityBody = {
  id: string;
  x: number;
  y: number;
  /** Radians */
  a: number;
  w: number;
  h: number;
  /** Scaled local-space convex hull of visible pixels (image-center origin). */
  hull: Pt[];
  vx: number;
  vy: number;
  well: number;
  /** When true, stay locked to assigned well instead of nearest. */
  wellPinned: boolean;
  locked: boolean;
};

type Pt = [number, number];

export function nearestSection(y: number, sections: BoardSection[]): BoardSection | null {
  if (sections.length === 0) return null;
  return [...sections].sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y))[0] ?? null;
}

export function sectionForItem(item: Item, sections: BoardSection[]): BoardSection | null {
  if (item.section_id) {
    return sections.find((row) => row.id === item.section_id) ?? nearestSection(item.y, sections);
  }
  return nearestSection(item.y, sections);
}

export function sectionGravity(section: BoardSection): { x: number; y: number } {
  const primary = wellsForSection(section)[0];
  return primary ? { x: primary.x, y: primary.y } : { x: CANVAS_WIDTH / 2, y: section.y };
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
  return items.filter((item) => sectionForItem(item, sections)?.id === section.id);
}

function nearestWellIndex(x: number, y: number, wells: Well[]): number {
  let best = 0;
  let bestDist = Infinity;
  wells.forEach((well, index) => {
    const d = (well.x - x) ** 2 + (well.y - y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = index;
    }
  });
  return best;
}

function wellIndexForItem(item: Item, wells: Well[]): { index: number; pinned: boolean } {
  if (item.section_id) {
    const pinned = wells.findIndex((well) => well.sectionId === item.section_id);
    if (pinned >= 0) return { index: pinned, pinned: true };
  }
  return { index: nearestWellIndex(item.x, item.y, wells), pinned: false };
}

function sizeFromFootprint(footprint: ItemFootprint, item: Item): { w: number; h: number; hull: Pt[] } {
  const fw = footprint.maxX - footprint.minX;
  const fh = footprint.maxY - footprint.minY;
  const w = fw > 8 ? fw * item.scale : item.image_width * item.scale;
  const h = fh > 8 ? fh * item.scale : item.image_height * item.scale;
  const source = footprint.hull.length >= 3 ? footprint.hull : [
    { x: footprint.minX, y: footprint.minY },
    { x: footprint.maxX, y: footprint.minY },
    { x: footprint.maxX, y: footprint.maxY },
    { x: footprint.minX, y: footprint.maxY },
  ];
  // Bake a small edge pad into the hull so settle leaves breathing room past anti-aliased pixels.
  const edgePad = Math.max(10, 12 * item.scale);
  const scaled: Pt[] = source.map((p) => [p.x * item.scale, p.y * item.scale]);
  const hull = inflateConvex(scaled, edgePad);
  return {
    w: Math.max(16, w + edgePad * 2),
    h: Math.max(16, h + edgePad * 2),
    hull: hull.length >= 3 ? hull : scaled,
  };
}

async function footprintFor(item: Item, file: Blob | undefined): Promise<ItemFootprint> {
  if (file) return footprintFromFile(file, item.image_width, item.image_height);
  return footprintForItem(item.image_path, item.image_width, item.image_height);
}

/** Push a convex CCW polygon outward by `amount` along vertex normals. */
function inflateConvex(pts: Pt[], amount: number): Pt[] {
  if (amount <= 0 || pts.length < 3) return pts;
  const n = pts.length;
  const out: Pt[] = [];
  for (let i = 0; i < n; i += 1) {
    const prev = pts[(i - 1 + n) % n]!;
    const cur = pts[i]!;
    const next = pts[(i + 1) % n]!;
    const e1x = cur[0] - prev[0];
    const e1y = cur[1] - prev[1];
    const e2x = next[0] - cur[0];
    const e2y = next[1] - cur[1];
    const len1 = Math.hypot(e1x, e1y) || 1;
    const len2 = Math.hypot(e2x, e2y) || 1;
    const n1x = -e1y / len1;
    const n1y = e1x / len1;
    const n2x = -e2y / len2;
    const n2y = e2x / len2;
    let nx = n1x + n2x;
    let ny = n1y + n2y;
    const nlen = Math.hypot(nx, ny) || 1;
    nx /= nlen;
    ny /= nlen;
    const dot = Math.min(1, Math.max(0.2, n1x * nx + n1y * ny));
    const miter = amount / dot;
    out.push([cur[0] + nx * miter, cur[1] + ny * miter]);
  }
  return out;
}

function poly(body: GravityBody, gap: number): Pt[] {
  const c = Math.cos(body.a);
  const s = Math.sin(body.a);
  const world: Pt[] = body.hull.map(([px, py]) => [
    body.x + px * c - py * s,
    body.y + px * s + py * c,
  ]);
  if (world.length < 3) {
    const hw = (body.w + gap) / 2;
    const hh = (body.h + gap) / 2;
    const corners: Pt[] = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ];
    return corners.map(([px, py]) => [body.x + px * c - py * s, body.y + px * s + py * c]);
  }
  // gap is full edge-to-edge air; pad covers soft PNG fringes the mask can miss.
  return inflateConvex(world, gap * 0.65 + HULL_GAP_PAD / 2);
}

function overlapDepth(A: Pt[] | undefined, B: Pt[] | undefined): number {
  if (!A || !B) return 0;
  const hit = sat(A, B);
  return hit ? hit.depth : 0;
}

/** Pick 0°/90° (grid) or radial target that packs tighter toward the well. */
function targetAngle(
  body: GravityBody,
  well: Well,
  mode: KnollRotationMode,
  neighborPolys: Array<Pt[] | undefined>,
  selfIndex: number,
  gap: number,
): number {
  const dx = well.x - body.x;
  const dy = well.y - body.y;
  const th = Math.atan2(dy, dx);

  if (mode === 'radial') {
    return body.h >= body.w ? th + HALF_PI : th;
  }

  // grid — score both axis-aligned orientations by overlap + distance to well
  const base = Math.round(body.a / HALF_PI) * HALF_PI;
  const candidates = [base, base + HALF_PI];
  let best = body.a;
  let bestScore = Infinity;
  const saved = body.a;
  for (const cand of candidates) {
    body.a = cand;
    const selfPoly = poly(body, gap);
    let score = Math.hypot(well.x - body.x, well.y - body.y) * 0.02;
    // Prefer long edge tangential to the well (classic knoll ring).
    const longAxis = body.w >= body.h ? cand : cand + HALF_PI;
    const align = Math.abs(Math.sin(longAxis - th));
    score += (1 - align) * 12;
    for (let j = 0; j < neighborPolys.length; j += 1) {
      if (j === selfIndex) continue;
      score += overlapDepth(selfPoly, neighborPolys[j]) * 4;
    }
    if (score < bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  body.a = saved;
  return best;
}

function sat(A: Pt[], B: Pt[]): { nx: number; ny: number; depth: number } | null {
  let depth = 1e9;
  let nx = 0;
  let ny = 0;
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i += 1) {
      const p = P[i];
      const q = P[(i + 1) % P.length];
      if (!p || !q) continue;
      let ax = -(q[1] - p[1]);
      let ay = q[0] - p[0];
      const len = Math.hypot(ax, ay) || 1;
      ax /= len;
      ay /= len;
      let minA = 1e9;
      let maxA = -1e9;
      let minB = 1e9;
      let maxB = -1e9;
      for (const v of A) {
        const d = v[0] * ax + v[1] * ay;
        if (d < minA) minA = d;
        if (d > maxA) maxA = d;
      }
      for (const v of B) {
        const d = v[0] * ax + v[1] * ay;
        if (d < minB) minB = d;
        if (d > maxB) maxB = d;
      }
      const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
      if (overlap <= 0) return null;
      if (overlap < depth) {
        depth = overlap;
        nx = ax;
        ny = ay;
      }
    }
  }
  return { nx, ny, depth };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Shortest signed delta from current → target on the circle. */
function angleDelta(target: number, current: number): number {
  return ((target - current + Math.PI) % TAU + TAU) % TAU - Math.PI;
}

export type GravityStepOptions = {
  bodies: GravityBody[];
  wells: Well[];
  gap: number;
  mode: KnollRotationMode;
  gravity: boolean;
  bounds: { x0: number; x1: number; y0: number; y1: number };
  /** Energy left in the settle (1 → 0). */
  alpha: number;
};

/** One prototype-style frame: a few physics ticks + alpha decay. */
export function stepGravityFrame(options: GravityStepOptions): number {
  const { bodies, wells, gap, mode, gravity, bounds } = options;
  let alpha = options.alpha;
  if (alpha <= 0) return 0;

  for (let tick = 0; tick < 3 && alpha > 0; tick += 1) {
    // Precompute polys for orientation scoring (uses current angles).
    const orientPolys =
      mode !== 'none' ? bodies.map((body) => poly(body, gap)) : null;

    for (let i = 0; i < bodies.length; i += 1) {
      const it = bodies[i]!;
      if (it.locked) {
        it.vx = 0;
        it.vy = 0;
        continue;
      }
      const well = wells[it.well] ?? wells[0];
      if (!well) continue;
      const dx = well.x - it.x;
      const dy = well.y - it.y;
      const d = Math.hypot(dx, dy) || 1;
      if (gravity) {
        const pull = Math.min(d, 480) * 0.01 * alpha;
        it.vx += (dx / d) * pull;
        it.vy += (dy / d) * pull;
        it.vx *= 0.8;
        it.vy *= 0.8;
        it.x += it.vx;
        it.y += it.vy;
      }

      if (mode !== 'none' && orientPolys) {
        const target = targetAngle(it, well, mode, orientPolys, i, gap);
        it.a += angleDelta(target, it.a) * 0.16 * Math.min(1, alpha * 3);
      }
    }

    for (let iter = 0; iter < COLLISION_ITERS; iter += 1) {
      const polys = bodies.map((body) => poly(body, gap));
      for (let i = 0; i < bodies.length; i += 1) {
        for (let j = i + 1; j < bodies.length; j += 1) {
          const A = bodies[i];
          const B = bodies[j];
          if (!A || !B) continue;
          const ra = Math.max(A.w, A.h) / 2 + gap;
          const rb = Math.max(B.w, B.h) / 2 + gap;
          if (Math.hypot(A.x - B.x, A.y - B.y) > (ra + rb) * 1.5) continue;
          const hit = sat(polys[i]!, polys[j]!);
          if (!hit) continue;
          let { nx, ny } = hit;
          if ((B.x - A.x) * nx + (B.y - A.y) * ny < 0) {
            nx = -nx;
            ny = -ny;
          }
          const fa = A.locked ? 0 : 1;
          const fb = B.locked ? 0 : 1;
          const tot = fa + fb;
          if (!tot) continue;
          const push = hit.depth + 0.01;
          A.x -= (nx * push * fa) / tot;
          A.y -= (ny * push * fa) / tot;
          B.x += (nx * push * fb) / tot;
          B.y += (ny * push * fb) / tot;
        }
      }
    }

    for (const it of bodies) {
      if (it.locked) continue;
      it.x = clamp(it.x, bounds.x0, bounds.x1);
      it.y = clamp(it.y, bounds.y0, bounds.y1);
      if (!it.wellPinned) {
        it.well = nearestWellIndex(it.x, it.y, wells);
      }
    }

    alpha *= 0.994;
  }

  return alpha < 0.01 ? 0 : alpha;
}

export function finalizeGravityBodies(bodies: GravityBody[], mode: KnollRotationMode): KnollPose[] {
  for (const it of bodies) {
    it.vx = 0;
    it.vy = 0;
    if (mode === 'grid' && !it.locked) {
      it.a = Math.round(it.a / HALF_PI) * HALF_PI;
    }
    it.a = ((((it.a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  }
  return bodies.map((body) => ({
    id: body.id,
    x: body.x,
    y: body.y,
    rotation: toDegrees(body.a),
  }));
}

export function canvasGravityBounds(): { x0: number; x1: number; y0: number; y1: number } {
  return { x0: MARGIN, x1: CANVAS_WIDTH - MARGIN, y0: MARGIN, y1: 1e7 };
}

export async function buildGravityBodies(
  items: Item[],
  wells: Well[],
  files?: Record<string, Blob>,
): Promise<GravityBody[]> {
  const bodies: GravityBody[] = [];
  for (const item of items) {
    const footprint = await footprintFor(item, files?.[item.id]);
    const { w, h, hull } = sizeFromFootprint(footprint, item);
    const assigned = wellIndexForItem(item, wells);
    bodies.push({
      id: item.id,
      x: item.x,
      y: item.y,
      a: (item.rotation * Math.PI) / 180,
      w,
      h,
      hull,
      vx: 0,
      vy: 0,
      well: assigned.index,
      wellPinned: assigned.pinned,
      locked: false,
    });
  }
  return bodies;
}

function relaxBodies(options: {
  bodies: GravityBody[];
  wells: Well[];
  gap: number;
  mode: KnollRotationMode;
  gravity: boolean;
  bounds: { x0: number; x1: number; y0: number; y1: number };
}): void {
  let alpha = 1;
  let steps = 0;
  while (alpha > 0.01 && steps < MAX_STEPS) {
    alpha = stepGravityFrame({ ...options, alpha });
    steps += 1;
  }
  finalizeGravityBodies(options.bodies, options.mode);
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function seedAroundWells(bodies: GravityBody[], wells: Well[]): void {
  bodies.forEach((body, i) => {
    if (body.locked) return;
    const well = wells[body.well] ?? wells[0];
    if (!well) return;
    const angle = (i / Math.max(1, bodies.length)) * TAU;
    const radius = 48 + i * 18;
    body.x = well.x + Math.cos(angle) * radius;
    body.y = well.y + Math.sin(angle) * radius;
    body.vx = 0;
    body.vy = 0;
  });
}

function resolveWells(section: BoardSection, override?: GravityWell[]): Well[] {
  const list = override && override.length ? override : wellsForSection(section);
  return list.map((well) => ({
    x: well.x,
    y: well.y,
    sectionId: well.sectionId ?? section.id,
  }));
}

export async function packSection(options: {
  items: Item[];
  section: BoardSection;
  sections: BoardSection[];
  gap: number;
  files?: Record<string, Blob>;
  mode?: KnollRotationMode;
  gravity?: boolean;
  wells?: GravityWell[];
}): Promise<KnollPose[]> {
  const members = [...itemsForSection(options.items, options.section, options.sections)].sort(
    (a, b) => b.image_width * b.image_height * b.scale * b.scale - a.image_width * a.image_height * a.scale * a.scale,
  );
  if (members.length === 0) return [];

  const wells = resolveWells(options.section, options.wells);
  const band = sectionBand(options.section, options.sections);
  const bodies: GravityBody[] = [];

  for (const item of members) {
    const footprint = await footprintFor(item, options.files?.[item.id]);
    const { w, h, hull } = sizeFromFootprint(footprint, item);
    const assigned = wellIndexForItem(item, wells);
    bodies.push({
      id: item.id,
      x: item.x,
      y: item.y,
      a: (item.rotation * Math.PI) / 180,
      w,
      h,
      hull,
      vx: 0,
      vy: 0,
      well: assigned.index,
      wellPinned: assigned.pinned,
      locked: false,
    });
  }

  seedAroundWells(bodies, wells);
  relaxBodies({
    bodies,
    wells,
    gap: options.gap,
    mode: options.mode ?? 'grid',
    gravity: options.gravity !== false,
    bounds: {
      x0: MARGIN,
      x1: CANVAS_WIDTH - MARGIN,
      y0: band.y0 + 40,
      y1: band.y1 - 40,
    },
  });

  return bodies.map((body) => ({
    id: body.id,
    x: body.x,
    y: body.y,
    rotation: toDegrees(body.a),
  }));
}

export async function packNewItem(options: {
  item: Item;
  neighbors: Item[];
  section: BoardSection;
  sections: BoardSection[];
  gap: number;
  file?: Blob;
  mode?: KnollRotationMode;
  gravity?: boolean;
  wells?: GravityWell[];
}): Promise<KnollPose> {
  const wells = resolveWells(options.section, options.wells);
  const band = sectionBand(options.section, options.sections);
  const bodies: GravityBody[] = [];

  for (const neighbor of options.neighbors) {
    if (neighbor.id === options.item.id) continue;
    const footprint = await footprintFor(neighbor, undefined);
    const { w, h, hull } = sizeFromFootprint(footprint, neighbor);
    const assigned = wellIndexForItem(neighbor, wells);
    bodies.push({
      id: neighbor.id,
      x: neighbor.x,
      y: neighbor.y,
      a: (neighbor.rotation * Math.PI) / 180,
      w,
      h,
      hull,
      vx: 0,
      vy: 0,
      well: assigned.index,
      wellPinned: assigned.pinned,
      locked: true,
    });
  }

  const footprint = await footprintFor(options.item, options.file);
  const { w, h, hull } = sizeFromFootprint(footprint, options.item);
  const primary = wells[0] ?? { x: CANVAS_WIDTH / 2, y: options.section.y };
  const n = bodies.length;
  const assigned = wellIndexForItem(
    { ...options.item, section_id: options.item.section_id ?? options.section.id },
    wells,
  );
  const newbie: GravityBody = {
    id: options.item.id,
    x: primary.x + Math.cos(n * 1.7) * (60 + n * 8),
    y: primary.y + Math.sin(n * 1.7) * (60 + n * 8),
    a: (options.item.rotation * Math.PI) / 180,
    w,
    h,
    hull,
    vx: 0,
    vy: 0,
    well: assigned.index,
    wellPinned: true,
    locked: false,
  };
  bodies.push(newbie);

  relaxBodies({
    bodies,
    wells,
    gap: options.gap,
    mode: options.mode ?? 'grid',
    gravity: options.gravity !== false,
    bounds: {
      x0: MARGIN,
      x1: CANVAS_WIDTH - MARGIN,
      y0: band.y0 + 40,
      y1: band.y1 - 40,
    },
  });

  return {
    id: newbie.id,
    x: newbie.x,
    y: newbie.y,
    rotation: toDegrees(newbie.a),
  };
}

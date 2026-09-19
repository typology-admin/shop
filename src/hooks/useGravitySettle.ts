import { useCallback, useEffect, useRef } from 'react';
import type { KnollRotationMode } from '../../shared/constants.ts';
import {
  buildGravityBodies,
  canvasGravityBounds,
  finalizeGravityBodies,
  seedAroundWells,
  stepGravityFrame,
  type GravityBody,
} from '../lib/knollLayout.ts';
import type { Item } from '../lib/types.ts';
import type { GravityWell } from '../lib/wells.ts';

type Options = {
  items: Item[];
  wells: GravityWell[];
  gap: number;
  gravity: boolean;
  rotation: KnollRotationMode;
  enabled: boolean;
  onFrame: (poses: Array<{ id: string; x: number; y: number; rotation: number }>) => void;
  onSettled: (poses: Array<{ id: string; x: number; y: number; rotation: number }>) => void;
};

/**
 * Live prototype-style gravity: kickSettle() starts animated pull toward wells.
 * Dragged ids are locked out of the sim until released.
 */
export function useGravitySettle(options: Options) {
  const { items, wells, gap, gravity, rotation, enabled, onFrame, onSettled } = options;
  const bodiesRef = useRef<GravityBody[]>([]);
  const alphaRef = useRef(0);
  const draggingRef = useRef<string | null>(null);
  const runningRef = useRef(false);
  const wellsRef = useRef(wells);
  const gapRef = useRef(gap);
  const gravityRef = useRef(gravity);
  const rotationRef = useRef(rotation);
  const onFrameRef = useRef(onFrame);
  const onSettledRef = useRef(onSettled);
  const itemsRef = useRef(items);

  wellsRef.current = wells;
  gapRef.current = gap;
  gravityRef.current = gravity;
  rotationRef.current = rotation;
  onFrameRef.current = onFrame;
  onSettledRef.current = onSettled;
  itemsRef.current = items;

  const ensureBodies = useCallback(async () => {
    const wellPts = wellsRef.current.map((well) => ({
      x: well.x,
      y: well.y,
      sectionId: well.sectionId,
    }));
    if (wellPts.length === 0) {
      bodiesRef.current = [];
      return;
    }
    const prev = new Map(bodiesRef.current.map((body) => [body.id, body]));
    const next = await buildGravityBodies(itemsRef.current, wellPts);
    for (const body of next) {
      const old = prev.get(body.id);
      if (old) {
        body.x = old.x;
        body.y = old.y;
        body.a = old.a;
        body.vx = old.vx;
        body.vy = old.vy;
        // Keep pinned target from rebuild; only reuse free well affinity mid-settle.
        if (!body.wellPinned) body.well = old.well;
      }
      body.locked = body.id === draggingRef.current;
    }
    bodiesRef.current = next;
  }, []);

  const kickSettle = useCallback(
    async (opts?: { reseeds?: boolean; items?: Item[] }) => {
      if (!enabled) return;
      if (opts?.items) itemsRef.current = opts.items;
      await ensureBodies();
      const wellPts = wellsRef.current.map((well) => ({
        x: well.x,
        y: well.y,
        sectionId: well.sectionId,
      }));
      if (opts?.reseeds && wellPts.length) {
        seedAroundWells(bodiesRef.current, wellPts);
      }
      // Sync unlocked bodies from latest React item poses when not mid-drag.
      const byId = new Map(itemsRef.current.map((item) => [item.id, item]));
      for (const body of bodiesRef.current) {
        if (body.id === draggingRef.current) continue;
        const item = byId.get(body.id);
        if (!item) continue;
        // Keep sim continuity while settling; only snap from items when idle.
        if (alphaRef.current <= 0) {
          body.x = item.x;
          body.y = item.y;
          body.a = (item.rotation * Math.PI) / 180;
          body.vx = 0;
          body.vy = 0;
        }
        body.locked = false;
      }
      alphaRef.current = 1;
    },
    [enabled, ensureBodies],
  );

  const setDragging = useCallback((id: string | null) => {
    draggingRef.current = id;
    for (const body of bodiesRef.current) {
      body.locked = body.id === id;
      if (body.id === id) {
        body.vx = 0;
        body.vy = 0;
      }
    }
  }, []);

  const syncDragPose = useCallback((id: string, x: number, y: number) => {
    const body = bodiesRef.current.find((row) => row.id === id);
    if (!body) return;
    body.x = x;
    body.y = y;
    body.vx = 0;
    body.vy = 0;
    if (alphaRef.current < 0.3) alphaRef.current = 0.3;
  }, []);

  useEffect(() => {
    if (!enabled) {
      alphaRef.current = 0;
      runningRef.current = false;
      return;
    }

    let raf = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      raf = window.requestAnimationFrame(tick);
      if (alphaRef.current <= 0) return;

      const wellPts = wellsRef.current.map((well) => ({
        x: well.x,
        y: well.y,
        sectionId: well.sectionId,
      }));
      if (!wellPts.length || bodiesRef.current.length === 0) {
        alphaRef.current = 0;
        return;
      }

      runningRef.current = true;
      alphaRef.current = stepGravityFrame({
        bodies: bodiesRef.current,
        wells: wellPts,
        gap: gapRef.current,
        mode: rotationRef.current,
        gravity: gravityRef.current,
        bounds: canvasGravityBounds(),
        alpha: alphaRef.current,
      });

      onFrameRef.current(
        bodiesRef.current.map((body) => ({
          id: body.id,
          x: body.x,
          y: body.y,
          rotation: (body.a * 180) / Math.PI,
        })),
      );

      if (alphaRef.current <= 0) {
        runningRef.current = false;
        const poses = finalizeGravityBodies(bodiesRef.current, rotationRef.current);
        onSettledRef.current(poses);
      }
    };

    raf = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [enabled]);

  // Rebuild sizes when membership / footprint inputs change — not every pose frame.
  const bodyKey = items
    .map(
      (item) =>
        `${item.id}:${item.scale}:${item.image_width}x${item.image_height}:${item.image_path}:${item.section_id ?? ''}`,
    )
    .join('|');
  const wellKey = wells.map((well) => `${well.id}:${well.x}:${well.y}:${well.sectionId ?? ''}`).join('|');

  useEffect(() => {
    if (!enabled) return;
    void ensureBodies();
  }, [enabled, bodyKey, wellKey, ensureBodies]);

  return { kickSettle, setDragging, syncDragPose, isSettling: () => alphaRef.current > 0 };
}

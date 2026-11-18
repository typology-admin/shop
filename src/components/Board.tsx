import { Circle, Group, Line, Stage, Layer, Rect } from 'react-konva';
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type Konva from 'konva';
import { DEFAULT_BOARD_COLOR, PUBLIC_BOARD_COPIES } from '../../shared/constants.ts';
import { useStageFit } from '../hooks/useStageFit.ts';
import { bandOverlaps, readViewportBand } from '../hooks/useViewportBand.ts';
import {
  hitMaskContains,
  peekProductHitMask,
  worldToItemLocal,
} from '../lib/productHitMask.ts';
import type { Item, ItemPatch } from '../lib/types.ts';
import type { GravityWell } from '../lib/wells.ts';
import { ProductNode } from './ProductNode.tsx';

export type BoardWell = GravityWell & {
  sectionId: string;
  color: string;
};

type Props = {
  items: Item[];
  mode: 'public' | 'admin';
  zoom?: number;
  selectedId?: string | null;
  backgroundColor?: string;
  onSelect?: (id: string | null) => void;
  onCommit?: (id: string, patch: ItemPatch) => void;
  wells?: BoardWell[];
  onAddAtWell?: (sectionId: string) => void;
  onDragStartItem?: (id: string) => void;
  onDragMoveItem?: (id: string, x: number, y: number) => void;
  onDragEndItem?: (id: string, x: number, y: number) => void;
};

/** Prefetch images a bit ahead of mount so scroll-in is warm.
 *  Keep tight — a wide pad fires every nearby WebP at once and stalls the
 *  browser connection pool (see HAR blocked~1.3s at pad=1400). */
const LOAD_PAD_PX = 640;
/** Only mount Konva nodes near the viewport — keeps draw cost bounded. */
const RENDER_PAD_PX = 320;

function visibleCopyIndexes(
  copies: number,
  canvasHeight: number,
  scale: number,
): number[] {
  if (copies <= 1) return [0];
  const period = canvasHeight * scale;
  if (period <= 0) return [0];
  const mid = window.scrollY + window.innerHeight * 0.5;
  const center = Math.floor(mid / period);
  const set = new Set<number>();
  for (const offset of [-1, 0, 1]) {
    const index = center + offset;
    if (index >= 0 && index < copies) set.add(index);
  }
  if (set.size === 0) set.add(Math.min(copies - 1, Math.max(0, center)));
  return [...set].sort((a, b) => a - b);
}

function nodeKey(copy: number, id: string) {
  return `${copy}:${id}`;
}

function computeNearKeys(
  items: Item[],
  copies: number[],
  canvasHeight: number,
  scale: number,
  padPx: number,
): Set<string> {
  const band = readViewportBand(padPx);
  const keys = new Set<string>();
  for (const copy of copies) {
    for (const item of items) {
      const worldY = item.y + copy * canvasHeight;
      const extent = Math.max(item.image_width, item.image_height) * item.scale * 0.6;
      if (bandOverlaps(band, worldY, extent, scale)) {
        keys.add(nodeKey(copy, item.id));
      }
    }
  }
  return keys;
}

function sameKeys(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const key of a) if (!b.has(key)) return false;
  return true;
}

/** Top-most item under a canvas-space point (shared alpha masks, no Konva hit canvas). */
function pickItemAt(
  itemsTopFirst: Item[],
  copies: number[],
  canvasHeight: number,
  canvasX: number,
  canvasY: number,
): Item | null {
  for (const item of itemsTopFirst) {
    const mask = peekProductHitMask(item.image_path, item.image_rev ?? 0);
    for (const copy of copies) {
      const centerY = item.y + copy * canvasHeight;
      const local = worldToItemLocal(
        canvasX,
        canvasY,
        item.x,
        centerY,
        item.scale,
        item.rotation,
      );
      if (mask) {
        if (hitMaskContains(mask, local.x, local.y, item.image_width, item.image_height)) {
          return item;
        }
      } else {
        // Mask not ready yet — fall back to bounds so early clicks still work.
        const halfW = (item.image_width * item.scale) / 2;
        const halfH = (item.image_height * item.scale) / 2;
        if (
          Math.abs(canvasX - item.x) <= halfW * 1.1 &&
          Math.abs(canvasY - centerY) <= halfH * 1.1
        ) {
          return item;
        }
      }
    }
  }
  return null;
}

export function Board({
  items,
  mode,
  zoom = 1,
  selectedId = null,
  backgroundColor = DEFAULT_BOARD_COLOR,
  onSelect,
  onCommit,
  wells = [],
  onAddAtWell,
  onDragStartItem,
  onDragMoveItem,
  onDragEndItem,
}: Props) {
  const fit = useStageFit(
    items,
    zoom,
    wells.map((well) => well.y),
  );
  const copies = mode === 'public' ? PUBLIC_BOARD_COPIES : 1;
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [activeCopies, setActiveCopies] = useState<number[]>(() =>
    Array.from({ length: Math.min(copies, 2) }, (_, i) => i),
  );
  const [loadNear, setLoadNear] = useState<Set<string>>(() => new Set());
  const [renderNear, setRenderNear] = useState<Set<string>>(() => new Set());
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const stageRef = useRef<Konva.Stage | null>(null);
  const hoverIdRef = useRef<string | null>(null);
  const moveFrameRef = useRef(0);

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.z_index - b.z_index),
    [items],
  );
  const topFirst = useMemo(() => [...sorted].reverse(), [sorted]);

  const pointerCanvas = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    return stage.getRelativePointerPosition();
  }, []);

  const pickAtPointer = useCallback((): Item | null => {
    const pos = pointerCanvas();
    if (!pos) return null;
    return pickItemAt(topFirst, activeCopies, fit.canvasHeight, pos.x, pos.y);
  }, [pointerCanvas, topFirst, activeCopies, fit.canvasHeight]);

  const handlePublicPointer = useCallback(
    (kind: 'move' | 'click') => {
      if (mode !== 'public') return;
      if (kind === 'move') {
        if (moveFrameRef.current) return;
        moveFrameRef.current = window.requestAnimationFrame(() => {
          moveFrameRef.current = 0;
          const hit = pickAtPointer();
          const stage = stageRef.current;
          if (!stage) return;
          const next = hit?.id ?? null;
          if (hoverIdRef.current !== next) {
            hoverIdRef.current = next;
            stage.container().style.cursor = next ? 'pointer' : 'default';
          }
        });
        return;
      }
      onSelect?.(pickAtPointer()?.id ?? null);
    },
    [mode, pickAtPointer, onSelect],
  );

  useEffect(() => {
    let frame = 0;
    function applyNearSets(nextLoad: Set<string>, nextRender: Set<string>, defer: boolean) {
      const update = () => {
        setLoadNear((prev) => (sameKeys(prev, nextLoad) ? prev : nextLoad));
        setRenderNear((prev) => (sameKeys(prev, nextRender) ? prev : nextRender));
      };
      // First paint must not use startTransition — deferred updates can leave the
      // board blank for many seconds (no image requests until a later interaction).
      if (defer) startTransition(update);
      else update();
    }
    function refresh(fromScroll = false) {
      frame = 0;
      // Always follow the scroll position — forcing copy 0 during first load left a
      // blank board when infinite-scroll/landing placed the viewport in another copy.
      const copiesForMount = visibleCopyIndexes(copies, fit.canvasHeight, fit.scale);
      setActiveCopies((prev) =>
        prev.length === copiesForMount.length && prev.every((v, i) => v === copiesForMount[i])
          ? prev
          : copiesForMount,
      );
      const nextLoad = computeNearKeys(
        items,
        copiesForMount,
        fit.canvasHeight,
        fit.scale,
        LOAD_PAD_PX,
      );
      const nextRender = computeNearKeys(
        items,
        copiesForMount,
        fit.canvasHeight,
        fit.scale,
        RENDER_PAD_PX,
      );
      applyNearSets(nextLoad, nextRender, fromScroll && initialLoadComplete);
    }
    function onScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => refresh(true));
    }
    refresh(false);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [copies, fit.canvasHeight, fit.scale, items, initialLoadComplete]);

  const handleLoaded = useCallback((id: string, ok: boolean) => {
    setLoaded((prev) => (prev[id] === ok ? prev : { ...prev, [id]: ok }));
  }, []);

  const loadedCount = items.filter((item) => loaded[item.id]).length;

  // Progress tracks items currently in the load band (not the whole board).
  useEffect(() => {
    if (initialLoadComplete || items.length === 0) return;

    const pendingIds = new Set<string>();
    for (const key of loadNear) {
      const id = key.slice(key.indexOf(':') + 1);
      if (id) pendingIds.add(id);
    }
    // Empty band (e.g. mid-jump) — don't stick on "Loading images…" forever.
    if (pendingIds.size === 0) {
      const timer = setTimeout(() => setInitialLoadComplete(true), 800);
      return () => clearTimeout(timer);
    }

    let ready = 0;
    for (const id of pendingIds) {
      if (loaded[id]) ready += 1;
    }
    const ratio = ready / pendingIds.size;
    if (ready >= pendingIds.size || ratio >= 0.85) {
      const timer = setTimeout(() => setInitialLoadComplete(true), 400);
      return () => clearTimeout(timer);
    }
  }, [items, loaded, loadNear, initialLoadComplete]);

  const showProgress =
    items.length > 0 && !initialLoadComplete && loadedCount < items.length;
  const showWells = mode === 'admin' && wells.length > 0;
  const canAddAtWell = Boolean(onAddAtWell);

  return (
    <div className="board-scroll" data-loop={copies > 1 ? String(copies) : undefined}>
      <Stage
        ref={stageRef}
        width={fit.stageWidth}
        height={fit.stageHeight * copies}
        x={fit.stageX}
        scaleX={fit.scale}
        scaleY={fit.scale}
        onMouseMove={
          mode === 'public'
            ? () => {
                handlePublicPointer('move');
              }
            : undefined
        }
        onMouseDown={(event) => {
          if (mode === 'public') {
            handlePublicPointer('click');
            return;
          }
          if (event.target === event.target.getStage()) onSelect?.(null);
        }}
        onTap={(event) => {
          if (mode === 'public') {
            handlePublicPointer('click');
            return;
          }
          if (event.target === event.target.getStage()) onSelect?.(null);
        }}
      >
        <Layer listening={mode === 'admin'}>
          <Rect
            x={0}
            y={0}
            width={fit.canvasWidth}
            height={fit.canvasHeight * copies}
            fill={backgroundColor}
            listening={false}
          />
          {activeCopies.map((copy) => (
            <Group key={copy} y={copy * fit.canvasHeight}>
              {sorted.map((item) => {
                const key = nodeKey(copy, item.id);
                return (
                  <ProductNode
                    key={key}
                    item={item}
                    mode={mode}
                    selected={selectedId === item.id}
                    loadNear={loadNear.has(key)}
                    renderNear={renderNear.has(key)}
                    stageScale={fit.scale}
                    onSelect={(id) => onSelect?.(id)}
                    onCommit={(id, patch) => onCommit?.(id, patch)}
                    onLoaded={copy === activeCopies[0] ? handleLoaded : undefined}
                    onDragStartItem={onDragStartItem}
                    onDragMoveItem={onDragMoveItem}
                    onDragEndItem={onDragEndItem}
                  />
                );
              })}
            </Group>
          ))}
          {showWells
            ? wells.map((well) => (
                <Group key={well.id} x={well.x} y={well.y}>
                  {[30, 60, 95].map((radius) => (
                    <Circle
                      key={radius}
                      radius={radius}
                      stroke={well.color}
                      strokeWidth={1.5}
                      opacity={0.18}
                      listening={false}
                    />
                  ))}
                  <Group
                    listening={canAddAtWell}
                    onMouseEnter={(event) => {
                      if (!canAddAtWell) return;
                      const stage = event.target.getStage();
                      if (stage) stage.container().style.cursor = 'pointer';
                    }}
                    onMouseLeave={(event) => {
                      const stage = event.target.getStage();
                      if (stage) stage.container().style.cursor = 'default';
                    }}
                    onClick={(event) => {
                      if (!canAddAtWell) return;
                      event.cancelBubble = true;
                      onAddAtWell?.(well.sectionId);
                    }}
                    onTap={(event) => {
                      if (!canAddAtWell) return;
                      event.cancelBubble = true;
                      onAddAtWell?.(well.sectionId);
                    }}
                  >
                    <Circle
                      radius={22}
                      fill="rgba(236, 236, 236, 0.88)"
                      stroke="rgba(34, 34, 34, 0.16)"
                      strokeWidth={1}
                    />
                    <Line
                      points={[-8, 0, 8, 0]}
                      stroke="#222222"
                      strokeWidth={2}
                      lineCap="round"
                      listening={false}
                    />
                    <Line
                      points={[0, -8, 0, 8]}
                      stroke="#222222"
                      strokeWidth={2}
                      lineCap="round"
                      listening={false}
                    />
                  </Group>
                </Group>
              ))
            : null}
        </Layer>
      </Stage>
      {showProgress ? (
        <div className="image-progress" aria-live="polite">
          Loading images…
        </div>
      ) : null}
    </div>
  );
}

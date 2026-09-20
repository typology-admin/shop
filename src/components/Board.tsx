import { Circle, Group, Line, Stage, Layer, Rect } from 'react-konva';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_BOARD_COLOR, PUBLIC_BOARD_COPIES } from '../../shared/constants.ts';
import { useStageFit } from '../hooks/useStageFit.ts';
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
  const fit = useStageFit(items, zoom);
  const copies = mode === 'public' ? PUBLIC_BOARD_COPIES : 1;
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [activeCopies, setActiveCopies] = useState<number[]>(() =>
    Array.from({ length: Math.min(copies, 2) }, (_, i) => i),
  );

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.z_index - b.z_index),
    [items],
  );

  useEffect(() => {
    let frame = 0;
    function refresh() {
      frame = 0;
      setActiveCopies(visibleCopyIndexes(copies, fit.canvasHeight, fit.scale));
    }
    function onScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(refresh);
    }
    refresh();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [copies, fit.canvasHeight, fit.scale]);

  const handleLoaded = useCallback((id: string, ok: boolean) => {
    setLoaded((prev) => (prev[id] === ok ? prev : { ...prev, [id]: ok }));
  }, []);

  const loadedCount = items.filter((item) => loaded[item.id]).length;
  const showProgress = items.length > 0 && loadedCount < items.length;
  const showWells = mode === 'admin' && wells.length > 0;
  const canAddAtWell = Boolean(onAddAtWell);

  return (
    <div className="board-scroll" data-loop={copies > 1 ? String(copies) : undefined}>
      <Stage
        width={fit.stageWidth}
        height={fit.stageHeight * copies}
        x={fit.stageX}
        scaleX={fit.scale}
        scaleY={fit.scale}
        onMouseDown={(event) => {
          if (event.target === event.target.getStage()) onSelect?.(null);
        }}
        onTap={(event) => {
          if (event.target === event.target.getStage()) onSelect?.(null);
        }}
      >
        <Layer>
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
              {sorted.map((item) => (
                <ProductNode
                  key={`${copy}-${item.id}`}
                  item={item}
                  mode={mode}
                  selected={selectedId === item.id}
                  worldY={item.y + copy * fit.canvasHeight}
                  stageScale={fit.scale}
                  onSelect={(id) => onSelect?.(id)}
                  onCommit={(id, patch) => onCommit?.(id, patch)}
                  onLoaded={copy === activeCopies[0] ? handleLoaded : undefined}
                  onDragStartItem={onDragStartItem}
                  onDragMoveItem={onDragMoveItem}
                  onDragEndItem={onDragEndItem}
                />
              ))}
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
          {loadedCount} / {items.length} placed
        </div>
      ) : null}
    </div>
  );
}

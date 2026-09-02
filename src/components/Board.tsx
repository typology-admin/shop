import { Stage, Layer, Rect, Group } from 'react-konva';
import { useCallback, useMemo, useState } from 'react';
import { PUBLIC_BOARD_COPIES } from '../../shared/constants.ts';
import { useStageFit } from '../hooks/useStageFit.ts';
import type { Item, ItemPatch } from '../lib/types.ts';
import { ProductNode } from './ProductNode.tsx';

type Props = {
  items: Item[];
  mode: 'public' | 'admin';
  zoom?: number;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onCommit?: (id: string, patch: ItemPatch) => void;
};

export function Board({
  items,
  mode,
  zoom = 1,
  selectedId = null,
  onSelect,
  onCommit,
}: Props) {
  const fit = useStageFit(items, zoom);
  const copies = mode === 'public' ? PUBLIC_BOARD_COPIES : 1;
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.z_index - b.z_index),
    [items],
  );

  const handleLoaded = useCallback((id: string, ok: boolean) => {
    setLoaded((prev) => (prev[id] === ok ? prev : { ...prev, [id]: ok }));
  }, []);

  const loadedCount = items.filter((item) => loaded[item.id]).length;
  const showProgress = items.length > 0 && loadedCount < items.length;

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
            fill="#c5c1b6"
            listening={false}
          />
          {Array.from({ length: copies }, (_, copy) => (
            <Group key={copy} y={copy * fit.canvasHeight}>
              {sorted.map((item) => (
                <ProductNode
                  key={`${copy}-${item.id}`}
                  item={item}
                  mode={mode}
                  selected={copy === 0 && selectedId === item.id}
                  onSelect={(id) => onSelect?.(id)}
                  onCommit={(id, patch) => onCommit?.(id, patch)}
                  onLoaded={handleLoaded}
                />
              ))}
            </Group>
          ))}
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

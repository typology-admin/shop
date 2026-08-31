import { Stage, Layer, Rect } from 'react-konva';
import { useCallback, useMemo, useState } from 'react';
import { useStageFit } from '../hooks/useStageFit.ts';
import type { Item, ItemPatch } from '../lib/types.ts';
import { ProductNode } from './ProductNode.tsx';

type Props = {
  items: Item[];
  mode: 'public' | 'admin';
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onCommit?: (id: string, patch: ItemPatch) => void;
};

export function Board({ items, mode, selectedId = null, onSelect, onCommit }: Props) {
  const fit = useStageFit(items);
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
    <div className="board-scroll">
      <Stage
        width={fit.stageWidth}
        height={fit.stageHeight}
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
            height={fit.canvasHeight}
            fill="#c5c1b6"
            listening={false}
          />
          {sorted.map((item) => (
            <ProductNode
              key={item.id}
              item={item}
              mode={mode}
              selected={selectedId === item.id}
              onSelect={(id) => onSelect?.(id)}
              onCommit={(id, patch) => onCommit?.(id, patch)}
              onLoaded={handleLoaded}
            />
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

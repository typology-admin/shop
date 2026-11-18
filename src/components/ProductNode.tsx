import { HIT_ALPHA_THRESHOLD } from '../../shared/constants.ts';
import { useLayoutEffect, useRef } from 'react';
import { Image as KonvaImage, Transformer } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Image as KonvaImageNode } from 'konva/lib/shapes/Image';
import type { Transformer as KonvaTransformerNode } from 'konva/lib/shapes/Transformer';
import { useProductImage } from '../hooks/useProductImage.ts';
import { clampScale } from '../lib/canvas.ts';
import type { Item, ItemPatch } from '../lib/types.ts';

type Props = {
  item: Item;
  mode: 'public' | 'admin';
  selected: boolean;
  /** Prefetch / decode when true (shared image cache). */
  loadNear: boolean;
  /** Mount Konva node when true — false unmounts off-screen nodes. */
  renderNear: boolean;
  stageScale: number;
  onSelect: (id: string) => void;
  onCommit: (id: string, patch: ItemPatch) => void;
  onLoaded?: (id: string, ok: boolean) => void;
  onDragStartItem?: (id: string) => void;
  onDragMoveItem?: (id: string, x: number, y: number) => void;
  onDragEndItem?: (id: string, x: number, y: number) => void;
};

function scheduleIdle(work: () => void): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(() => work(), { timeout: 1200 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(work, 48);
  return () => window.clearTimeout(id);
}

export function ProductNode({
  item,
  mode,
  selected,
  loadNear,
  renderNear,
  stageScale,
  onSelect,
  onCommit,
  onLoaded,
  onDragStartItem,
  onDragMoveItem,
  onDragEndItem,
}: Props) {
  const nodeRef = useRef<KonvaImageNode>(null);
  const transformerRef = useRef<KonvaTransformerNode>(null);
  const { image, status } = useProductImage(item.image_path, item.image_rev ?? 0, {
    enabled: loadNear,
    hasWebp: item.has_webp ?? false,
  });

  useLayoutEffect(() => {
    if (!onLoaded) return;
    if (status === 'loaded') onLoaded(item.id, true);
    else if (status === 'failed') onLoaded(item.id, false);
  }, [item.id, onLoaded, status]);

  useLayoutEffect(() => {
    if (!renderNear || !image) return;
    const node = nodeRef.current;
    if (!node) return;

    // Hit masks are expensive (canvas readback). Defer so scroll/wheel stay responsive.
    // Low pixelRatio is enough for click-through on transparent padding.
    const ratio = Math.min(0.25, 1 / Math.max(0.75, stageScale));
    const cancel = scheduleIdle(() => {
      if (!nodeRef.current) return;
      nodeRef.current.cache({ pixelRatio: ratio });
      nodeRef.current.drawHitFromCache(HIT_ALPHA_THRESHOLD);
      nodeRef.current.getLayer()?.batchDraw();
    });
    return cancel;
  }, [image, stageScale, renderNear]);

  useLayoutEffect(() => {
    const transformer = transformerRef.current;
    const node = nodeRef.current;
    if (!transformer) return;
    if (selected && node) {
      transformer.nodes([node]);
      transformer.getLayer()?.batchDraw();
    } else {
      transformer.nodes([]);
    }
  }, [selected, image, item.z_index, renderNear]);

  // Unmount off-screen nodes — decoded bitmaps stay in the shared image cache.
  if (!renderNear) return null;
  if (status !== 'loaded' || !image) return null;

  const admin = mode === 'admin';

  function handleClick(event: KonvaEventObject<MouseEvent | TouchEvent | Event>) {
    event.cancelBubble = true;
    onSelect(item.id);
  }

  return (
    <>
      <KonvaImage
        ref={nodeRef}
        image={image}
        x={item.x}
        y={item.y}
        width={item.image_width}
        height={item.image_height}
        scaleX={item.scale}
        scaleY={item.scale}
        rotation={item.rotation}
        offsetX={item.image_width / 2}
        offsetY={item.image_height / 2}
        draggable={admin}
        perfectDrawEnabled={false}
        imageSmoothingEnabled
        onClick={handleClick}
        onTap={handleClick}
        onMouseEnter={(event) => {
          const container = event.target.getStage()?.container();
          if (container) container.style.cursor = admin ? 'grab' : 'pointer';
        }}
        onMouseLeave={(event) => {
          const container = event.target.getStage()?.container();
          if (container) container.style.cursor = 'default';
        }}
        onDragStart={(event) => {
          event.cancelBubble = true;
          onSelect(item.id);
          onDragStartItem?.(item.id);
          const container = event.target.getStage()?.container();
          if (container) container.style.cursor = 'grabbing';
        }}
        onDragMove={(event) => {
          onDragMoveItem?.(item.id, event.target.x(), event.target.y());
        }}
        onDragEnd={(event) => {
          const container = event.target.getStage()?.container();
          if (container) container.style.cursor = admin ? 'grab' : 'default';
          const x = event.target.x();
          const y = event.target.y();
          if (onDragEndItem) onDragEndItem(item.id, x, y);
          else onCommit(item.id, { x, y });
        }}
        onTransformEnd={() => {
          const node = nodeRef.current;
          if (!node) return;
          const nextScale = clampScale((Math.abs(node.scaleX()) + Math.abs(node.scaleY())) / 2);
          node.scaleX(nextScale);
          node.scaleY(nextScale);
          onCommit(item.id, {
            x: node.x(),
            y: node.y(),
            scale: nextScale,
            rotation: node.rotation(),
          });
        }}
      />
      {admin && selected ? (
        <Transformer
          ref={transformerRef}
          rotateEnabled
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 20 || newBox.height < 20) return oldBox;
            return newBox;
          }}
        />
      ) : null}
    </>
  );
}

import { useLayoutEffect, useRef } from 'react';
import { Image as KonvaImage, Transformer } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Image as KonvaImageNode } from 'konva/lib/shapes/Image';
import type { Transformer as KonvaTransformerNode } from 'konva/lib/shapes/Transformer';
import { useProductImage } from '../hooks/useProductImage.ts';
import { clampScale } from '../lib/canvas.ts';
import { ensureProductHitMask } from '../lib/productHitMask.ts';
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

export function ProductNode({
  item,
  mode,
  selected,
  loadNear,
  renderNear,
  stageScale: _stageScale,
  onSelect,
  onCommit,
  onLoaded,
  onDragStartItem,
  onDragMoveItem,
  onDragEndItem,
}: Props) {
  const nodeRef = useRef<KonvaImageNode>(null);
  const transformerRef = useRef<KonvaTransformerNode>(null);
  const admin = mode === 'admin';
  const { image, status } = useProductImage(item.image_path, item.image_rev ?? 0, {
    enabled: loadNear,
    hasWebp: item.has_webp ?? false,
  });

  useLayoutEffect(() => {
    if (!onLoaded) return;
    if (status === 'loaded') onLoaded(item.id, true);
    else if (status === 'failed') onLoaded(item.id, false);
  }, [item.id, onLoaded, status]);

  // One tiny alpha mask per image (shared across loop copies) — no Konva cache().
  useLayoutEffect(() => {
    if (!image || status !== 'loaded') return;
    void ensureProductHitMask(item.image_path, item.image_rev ?? 0, image);
  }, [image, status, item.image_path, item.image_rev]);

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
        // Public clicks use Board stage picking + shared alpha masks (avoids cache/hit canvases).
        listening={admin}
        perfectDrawEnabled={false}
        imageSmoothingEnabled
        onClick={admin ? handleClick : undefined}
        onTap={admin ? handleClick : undefined}
        onMouseEnter={
          admin
            ? (event) => {
                const container = event.target.getStage()?.container();
                if (container) container.style.cursor = 'grab';
              }
            : undefined
        }
        onMouseLeave={
          admin
            ? (event) => {
                const container = event.target.getStage()?.container();
                if (container) container.style.cursor = 'default';
              }
            : undefined
        }
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

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
  onSelect: (id: string) => void;
  onCommit: (id: string, patch: ItemPatch) => void;
  onLoaded: (id: string, ok: boolean) => void;
};

export function ProductNode({
  item,
  mode,
  selected,
  onSelect,
  onCommit,
  onLoaded,
}: Props) {
  const nodeRef = useRef<KonvaImageNode>(null);
  const transformerRef = useRef<KonvaTransformerNode>(null);
  const { image, status } = useProductImage(item.image_path);

  useLayoutEffect(() => {
    onLoaded(item.id, status === 'loaded');
  }, [item.id, onLoaded, status]);

  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node || !image) return;
    node.cache();
    node.drawHitFromCache(HIT_ALPHA_THRESHOLD);
    node.getLayer()?.batchDraw();
  }, [image]);

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
  }, [selected, image, item.z_index]);

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
          const container = event.target.getStage()?.container();
          if (container) container.style.cursor = 'grabbing';
        }}
        onDragEnd={(event) => {
          const container = event.target.getStage()?.container();
          if (container) container.style.cursor = admin ? 'grab' : 'default';
          onCommit(item.id, { x: event.target.x(), y: event.target.y() });
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
          flipEnabled={false}
          keepRatio
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
          anchorSize={10}
          anchorStroke="#1c1b18"
          anchorFill="#efece3"
          borderStroke="#1c1b18"
          rotateAnchorOffset={22}
          boundBoxFunc={(oldBox, newBox) => {
            if (Math.abs(newBox.width) < 12 || Math.abs(newBox.height) < 12) {
              return oldBox;
            }
            return newBox;
          }}
        />
      ) : null}
    </>
  );
}

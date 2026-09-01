import { useEffect, useState } from 'react';
import { CANVAS_WIDTH } from '../../shared/constants.ts';
import { boardHeight, boardScale, setActiveViewZoom } from '../lib/canvas.ts';
import type { Item } from '../lib/types.ts';

function viewport() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

export function useStageFit(items: Item[], zoom: number) {
  const [size, setSize] = useState(viewport);

  useEffect(() => {
    const onResize = () => setSize(viewport());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    setActiveViewZoom(zoom);
  }, [zoom]);

  const scale = boardScale(size.width, zoom);
  const canvasHeight = boardHeight(items, size.width, size.height, zoom);
  const drawnWidth = CANVAS_WIDTH * scale;

  return {
    scale,
    canvasWidth: CANVAS_WIDTH,
    canvasHeight,
    stageWidth: size.width,
    stageHeight: canvasHeight * scale,
    stageX: (size.width - drawnWidth) / 2,
    viewportWidth: size.width,
    viewportHeight: size.height,
  };
}

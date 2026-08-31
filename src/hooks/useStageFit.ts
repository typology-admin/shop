import { useEffect, useState } from 'react';
import { CANVAS_WIDTH } from '../../shared/constants.ts';
import { boardHeight } from '../lib/canvas.ts';
import type { Item } from '../lib/types.ts';

function viewport() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

export function useStageFit(items: Item[]) {
  const [size, setSize] = useState(viewport);

  useEffect(() => {
    const onResize = () => setSize(viewport());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const scale = size.width / CANVAS_WIDTH;
  const canvasHeight = boardHeight(items, size.width, size.height);

  return {
    scale,
    canvasWidth: CANVAS_WIDTH,
    canvasHeight,
    stageWidth: size.width,
    stageHeight: canvasHeight * scale,
    viewportWidth: size.width,
    viewportHeight: size.height,
  };
}

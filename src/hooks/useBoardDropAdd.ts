import { useCallback, useEffect, useRef, useState } from 'react';
import {
  chromeBlocksBoardDrop,
  clientToCanvas,
  dropHasBoardPayload,
  extractBoardDrop,
  type BoardDropPayload,
} from '../lib/boardDrop.ts';

type Options = {
  enabled: boolean;
  zoom: number;
  onDrop: (payload: BoardDropPayload) => void;
};

/**
 * Window-level drop target for adding items onto the board in edit mode.
 * Accepts image files or http(s) URLs (product links / image URLs).
 */
export function useBoardDropAdd({ enabled, zoom, onDrop }: Options) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const onDropRef = useRef(onDrop);
  const zoomRef = useRef(zoom);
  onDropRef.current = onDrop;
  zoomRef.current = zoom;

  const reset = useCallback(() => {
    depth.current = 0;
    setOver(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      reset();
      return;
    }

    function onDragEnter(event: DragEvent) {
      if (chromeBlocksBoardDrop()) return;
      if (!event.dataTransfer || !dropHasBoardPayload(event.dataTransfer)) return;
      event.preventDefault();
      depth.current += 1;
      setOver(true);
    }

    function onDragOver(event: DragEvent) {
      if (chromeBlocksBoardDrop()) return;
      if (!event.dataTransfer || !dropHasBoardPayload(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }

    function onDragLeave() {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setOver(false);
    }

    function onDropEvent(event: DragEvent) {
      if (chromeBlocksBoardDrop()) {
        reset();
        return;
      }
      if (!event.dataTransfer) return;
      const extracted = extractBoardDrop(event.dataTransfer);
      reset();
      if (!extracted) return;
      event.preventDefault();
      event.stopPropagation();
      const point = clientToCanvas(event.clientX, event.clientY, zoomRef.current);
      onDropRef.current({ ...point, ...extracted });
    }

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDropEvent);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDropEvent);
      reset();
    };
  }, [enabled, reset]);

  return { over };
}

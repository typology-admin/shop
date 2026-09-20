import { CANVAS_WIDTH } from '../../shared/constants.ts';
import { boardScale } from './canvas.ts';
import { assertItemImageFile } from './pngClient.ts';

export type BoardDropPayload = {
  x: number;
  y: number;
  file?: File;
  url?: string;
};

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function clientToCanvas(
  clientX: number,
  clientY: number,
  zoom: number,
): { x: number; y: number } {
  const scale = boardScale(window.innerWidth, zoom);
  const drawnWidth = CANVAS_WIDTH * scale;
  const stageX = (window.innerWidth - drawnWidth) / 2;
  return {
    x: (clientX - stageX) / scale,
    y: (window.scrollY + clientY) / scale,
  };
}

export function extractBoardDrop(data: DataTransfer): { file?: File; url?: string } | null {
  const files = [...data.files];
  for (const file of files) {
    try {
      assertItemImageFile(file);
      return { file };
    } catch {
      // try next
    }
  }

  const uriList = data.getData('text/uri-list').trim();
  const plain = data.getData('text/plain').trim();
  const candidate = (uriList || plain).split(/\r?\n/).find((line) => looksLikeUrl(line));
  if (candidate) return { url: candidate.trim() };

  return null;
}

export function dropHasBoardPayload(data: DataTransfer): boolean {
  if ([...data.files].some((file) => {
    try {
      assertItemImageFile(file);
      return true;
    } catch {
      return false;
    }
  })) {
    return true;
  }
  const types = [...data.types];
  if (types.includes('Files')) return true;
  if (types.includes('text/uri-list') || types.includes('text/plain')) return true;
  return false;
}

export function chromeBlocksBoardDrop(): boolean {
  const html = document.documentElement;
  return (
    html.classList.contains('cutout-editor-open') ||
    html.classList.contains('account-modal-open') ||
    html.classList.contains('item-modal-open') ||
    html.classList.contains('chrome-overlay-open')
  );
}

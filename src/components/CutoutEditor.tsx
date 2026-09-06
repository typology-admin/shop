import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  applyAutoCutout,
  compositeCutout,
  paintCutout,
  resetCutout,
  MAX_BG_TOLERANCE,
  MIN_BG_TOLERANCE,
  type CutoutBrush,
  type CutoutSession,
} from '../lib/cutout.ts';

type Props = {
  session: CutoutSession;
  doneLabel?: string;
  onDone: () => void;
  onCancel: () => void;
};

type Fit = {
  scale: number;
  ox: number;
  oy: number;
};

function fitFor(width: number, height: number, imgW: number, imgH: number): Fit {
  const scale = Math.min(width / imgW, height / imgH);
  return {
    scale,
    ox: (width - imgW * scale) / 2,
    oy: (height - imgH * scale) / 2,
  };
}

function eventToImage(
  event: PointerEvent | React.PointerEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
  imgW: number,
  imgH: number,
) {
  const rect = canvas.getBoundingClientRect();
  const fit = fitFor(rect.width, rect.height, imgW, imgH);
  return {
    x: (event.clientX - rect.left - fit.ox) / fit.scale,
    y: (event.clientY - rect.top - fit.oy) / fit.scale,
    scale: fit.scale,
  };
}

export function CutoutEditor({ session, doneLabel = 'Done', onDone, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<HTMLCanvasElement | null>(null);
  const sourceCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const imageDataRef = useRef<ImageData | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const snapshotRef = useRef({
    alpha: session.alpha.slice(),
    tolerance: session.tolerance,
  });
  const [brush, setBrush] = useState<CutoutBrush>('cut');
  const [brushPx, setBrushPx] = useState(28);
  const [tolerance, setTolerance] = useState(session.tolerance);

  const syncSource = useCallback(() => {
    const source = sourceRef.current;
    const ctx = sourceCtxRef.current;
    if (!source || !ctx) return;
    const image = compositeCutout(session);
    imageDataRef.current = image;
    ctx.putImageData(image, 0, 0);
  }, [session]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const source = sourceRef.current;
    if (!canvas || !source) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    const pixelW = Math.max(1, Math.round(cssW * dpr));
    const pixelH = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#d8d4c8';
    ctx.fillRect(0, 0, cssW, cssH);
    const size = 12;
    ctx.fillStyle = '#eeeae0';
    for (let y = 0; y < cssH; y += size) {
      for (let x = 0; x < cssW; x += size) {
        if (((x / size + y / size) | 0) % 2 === 0) ctx.fillRect(x, y, size, size);
      }
    }
    const fit = fitFor(cssW, cssH, session.width, session.height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(source, fit.ox, fit.oy, session.width * fit.scale, session.height * fit.scale);
  }, [session.height, session.width]);

  useEffect(() => {
    const source = document.createElement('canvas');
    source.width = session.width;
    source.height = session.height;
    const ctx = source.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    sourceRef.current = source;
    sourceCtxRef.current = ctx;
    syncSource();
    redraw();
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => redraw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw, session, syncSource]);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('cutout-editor-open');
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleCancel();
    };
    window.addEventListener('keydown', onKey);
    const onResize = () => redraw();
    window.addEventListener('resize', onResize);
    return () => {
      html.classList.remove('cutout-editor-open');
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [redraw]);

  function stamp(x: number, y: number, scale: number) {
    const radius = brushPx / Math.max(scale, 0.001);
    const dirty = paintCutout(session, x, y, radius, brush);
    const image = imageDataRef.current;
    const ctx = sourceCtxRef.current;
    if (!image || !ctx) return;
    for (let row = 0; row < dirty.h; row += 1) {
      const py = dirty.y + row;
      for (let col = 0; col < dirty.w; col += 1) {
        const px = dirty.x + col;
        const p = py * session.width + px;
        image.data[p * 4 + 3] = session.alpha[p] ?? 0;
      }
    }
    ctx.putImageData(image, 0, 0, dirty.x, dirty.y, dirty.w, dirty.h);
  }

  function strokeTo(x: number, y: number, scale: number) {
    const last = lastRef.current;
    if (!last) {
      stamp(x, y, scale);
      lastRef.current = { x, y };
      redraw();
      return;
    }
    const dx = x - last.x;
    const dy = y - last.y;
    const dist = Math.hypot(dx, dy);
    const step = Math.max(1, (brushPx / Math.max(scale, 0.001)) * 0.35);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let i = 1; i <= n; i += 1) {
      stamp(last.x + (dx * i) / n, last.y + (dy * i) / n, scale);
    }
    lastRef.current = { x, y };
    redraw();
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastRef.current = null;
    const point = eventToImage(event, canvas, session.width, session.height);
    strokeTo(point.x, point.y, point.scale);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const point = eventToImage(event, canvas, session.width, session.height);
    strokeTo(point.x, point.y, point.scale);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    lastRef.current = null;
    if (canvasRef.current?.hasPointerCapture(event.pointerId)) {
      canvasRef.current.releasePointerCapture(event.pointerId);
    }
  }

  function handleTolerance(next: number) {
    try {
      applyAutoCutout(session, next);
      setTolerance(next);
      syncSource();
      redraw();
    } catch {
      // Keep the previous mask if the new reach eats the whole object.
    }
  }

  function handleReset() {
    try {
      resetCutout(session);
      setTolerance(session.tolerance);
      syncSource();
      redraw();
    } catch {
      // Leave the painted mask in place.
    }
  }

  function handleCancel() {
    session.alpha = snapshotRef.current.alpha.slice();
    session.tolerance = snapshotRef.current.tolerance;
    onCancel();
  }

  return createPortal(
    <div className="cutout-editor-backdrop">
      <div className="cutout-editor" role="dialog" aria-labelledby="cutout-editor-title">
        <header className="cutout-editor-head">
          <h2 id="cutout-editor-title">Edit cutout</h2>
          <p>Keep restores highlights the auto-cut ate. Cut removes leftover shadows.</p>
        </header>
        <canvas
          ref={canvasRef}
          className={`cutout-editor-canvas is-${brush}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        <div className="cutout-editor-tools">
          <div className="btn-row">
            <button
              type="button"
              className={`btn ${brush === 'keep' ? '' : 'btn-ghost'}`}
              onClick={() => setBrush('keep')}
            >
              Keep
            </button>
            <button
              type="button"
              className={`btn ${brush === 'cut' ? '' : 'btn-ghost'}`}
              onClick={() => setBrush('cut')}
            >
              Cut
            </button>
          </div>
          <label className="range-field">
            <header>
              <span>Brush</span>
              <span>{brushPx}px</span>
            </header>
            <input
              type="range"
              min={8}
              max={80}
              step={1}
              value={brushPx}
              onChange={(event) => setBrushPx(Number(event.target.value))}
            />
          </label>
          {session.canAuto ? (
            <label className="range-field">
              <header>
                <span>Background reach</span>
                <span>{tolerance}</span>
              </header>
              <input
                type="range"
                min={MIN_BG_TOLERANCE}
                max={MAX_BG_TOLERANCE}
                step={1}
                value={tolerance}
                onChange={(event) => handleTolerance(Number(event.target.value))}
              />
            </label>
          ) : null}
          <div className="btn-row">
            <button type="button" className="btn btn-ghost" onClick={handleReset}>
              Reset auto
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleCancel}>
              Cancel
            </button>
            <button type="button" className="btn" onClick={onDone}>
              {doneLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

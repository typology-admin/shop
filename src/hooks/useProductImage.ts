import { useEffect, useState } from 'react';
import {
  forgetSharedProductImage,
  loadSharedProductImage,
  peekSharedProductImage,
} from '../lib/productImageCache.ts';

export function useProductImage(
  imagePath: string,
  revision = 0,
  options: { enabled?: boolean; hasWebp?: boolean } = {},
) {
  const enabled = options.enabled !== false;
  const hasWebp = options.hasWebp ?? false;
  const peeked = enabled ? peekSharedProductImage(imagePath, revision) : null;
  const [image, setImage] = useState<HTMLImageElement | null>(peeked);
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'failed'>(
    peeked ? 'loaded' : enabled ? 'loading' : 'idle',
  );

  useEffect(() => {
    // Keep already-decoded images in memory when off-screen (lazy gate only
    // controls whether we *start* a load — clearing would re-fetch on scroll).
    if (!enabled) {
      setStatus((prev) => (prev === 'loading' ? 'idle' : prev));
      return;
    }

    const warm = peekSharedProductImage(imagePath, revision);
    if (warm) {
      setImage(warm);
      setStatus('loaded');
      return;
    }

    let cancelled = false;
    setImage(null);
    setStatus('loading');

    void loadSharedProductImage(imagePath, revision, hasWebp)
      .then((next) => {
        if (cancelled) return;
        setImage(next);
        setStatus('loaded');
      })
      .catch(() => {
        if (cancelled) return;
        setImage(null);
        setStatus('failed');
      });

    return () => {
      cancelled = true;
    };
    // Do NOT depend on `status` — that caused Maximum update depth exceeded
    // (failed → loading → failed loop) and crashed the whole board.
  }, [imagePath, revision, enabled, hasWebp]);

  return { image, status, forget: () => forgetSharedProductImage(imagePath, revision) };
}

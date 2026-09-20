import { useEffect, useState } from 'react';
import {
  forgetSharedProductImage,
  loadSharedProductImage,
  peekSharedProductImage,
} from '../lib/productImageCache.ts';

export function useProductImage(
  imagePath: string,
  revision = 0,
  options: { enabled?: boolean } = {},
) {
  const enabled = options.enabled !== false;
  const peeked = enabled ? peekSharedProductImage(imagePath, revision) : null;
  const [image, setImage] = useState<HTMLImageElement | null>(peeked);
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'failed'>(
    peeked ? 'loaded' : enabled ? 'loading' : 'idle',
  );

  useEffect(() => {
    if (!enabled) {
      setImage(null);
      setStatus('idle');
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

    void loadSharedProductImage(imagePath, revision)
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
  }, [imagePath, revision, enabled]);

  return { image, status, forget: () => forgetSharedProductImage(imagePath, revision) };
}

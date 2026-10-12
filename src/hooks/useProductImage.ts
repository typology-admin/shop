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
    // If disabled and not yet loaded, stay idle
    if (!enabled) {
      // Don't clear already-loaded images! Just don't start new loads.
      if (status === 'idle' || status === 'loading') {
        setStatus('idle');
      }
      return;
    }

    const warm = peekSharedProductImage(imagePath, revision);
    if (warm) {
      setImage(warm);
      setStatus('loaded');
      return;
    }

    // Only start loading if not already loaded
    if (status === 'loaded') return;

    let cancelled = false;
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
  }, [imagePath, revision, enabled, hasWebp, status]);

  return { image, status, forget: () => forgetSharedProductImage(imagePath, revision) };
}

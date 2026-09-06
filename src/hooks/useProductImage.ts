import { useEffect, useState } from 'react';
import { resolveImageUrl } from '../lib/images.ts';

export function useProductImage(imagePath: string, revision = 0) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');

  useEffect(() => {
    let cancelled = false;
    let element: HTMLImageElement | null = null;

    setImage(null);
    setStatus('loading');

    void resolveImageUrl(imagePath).then((url) => {
      if (cancelled || !url) {
        if (!cancelled) setStatus('failed');
        return;
      }
      element = new window.Image();
      if (url.startsWith('http://') || url.startsWith('https://')) {
        element.crossOrigin = 'anonymous';
      }
      element.onload = () => {
        if (cancelled) return;
        setImage(element);
        setStatus('loaded');
      };
      element.onerror = () => {
        if (cancelled) return;
        setImage(null);
        setStatus('failed');
      };
      element.src = url;
    });

    return () => {
      cancelled = true;
      if (element) {
        element.onload = null;
        element.onerror = null;
      }
    };
  }, [imagePath, revision]);

  return { image, status };
}

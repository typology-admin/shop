import { resolveImageUrl } from './images.ts';

type Entry = {
  image: HTMLImageElement | null;
  status: 'loading' | 'loaded' | 'failed';
  waiters: Array<(entry: Entry) => void>;
};

const cache = new Map<string, Entry>();

function keyFor(path: string, revision: number) {
  return `${path}::${revision}`;
}

function notify(entry: Entry) {
  const waiters = entry.waiters.splice(0, entry.waiters.length);
  for (const wake of waiters) wake(entry);
}

/** Shared loader so looped board copies decode each product photo once. */
export function loadSharedProductImage(
  imagePath: string,
  revision = 0,
  hasWebp = false,
): Promise<HTMLImageElement> {
  const key = keyFor(imagePath, revision);
  let entry = cache.get(key);
  if (!entry) {
    entry = { image: null, status: 'loading', waiters: [] };
    cache.set(key, entry);
    void resolveImageUrl(imagePath, hasWebp).then((url) => {
      const current = cache.get(key);
      if (!current) return;
      if (!url) {
        current.status = 'failed';
        notify(current);
        return;
      }
      const element = new window.Image();
      if (url.startsWith('http://') || url.startsWith('https://')) {
        element.crossOrigin = 'anonymous';
      }
      element.decoding = 'async';
      element.onload = () => {
        current.image = element;
        current.status = 'loaded';
        notify(current);
      };
      element.onerror = () => {
        // If WebP failed and we expected it to exist, try PNG fallback
        if (url.endsWith('.webp') && imagePath.endsWith('.png') && hasWebp) {
          const pngUrl = url.replace(/\.webp$/i, '.png');
          const fallbackElement = new window.Image();
          if (pngUrl.startsWith('http://') || pngUrl.startsWith('https://')) {
            fallbackElement.crossOrigin = 'anonymous';
          }
          fallbackElement.decoding = 'async';
          fallbackElement.onload = () => {
            current.image = fallbackElement;
            current.status = 'loaded';
            notify(current);
          };
          fallbackElement.onerror = () => {
            current.image = null;
            current.status = 'failed';
            notify(current);
          };
          fallbackElement.src = pngUrl;
        } else {
          current.image = null;
          current.status = 'failed';
          notify(current);
        }
      };
      element.src = url;
    });
  }

  if (entry.status === 'loaded' && entry.image) {
    return Promise.resolve(entry.image);
  }
  if (entry.status === 'failed') {
    return Promise.reject(new Error('Could not load that photo.'));
  }

  return new Promise((resolve, reject) => {
    entry!.waiters.push((next) => {
      if (next.status === 'loaded' && next.image) resolve(next.image);
      else reject(new Error('Could not load that photo.'));
    });
  });
}

export function peekSharedProductImage(
  imagePath: string,
  revision = 0,
): HTMLImageElement | null {
  const entry = cache.get(keyFor(imagePath, revision));
  return entry?.status === 'loaded' ? entry.image : null;
}

export function forgetSharedProductImage(imagePath: string, revision = 0): void {
  cache.delete(keyFor(imagePath, revision));
}

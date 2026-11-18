import { resolveImageUrl } from './images.ts';

type Entry = {
  image: HTMLImageElement | null;
  status: 'loading' | 'loaded' | 'failed';
  waiters: Array<(entry: Entry) => void>;
};

const cache = new Map<string, Entry>();

/** Cap parallel image network+decode work so the browser connection pool
 *  does not stall dozens of WebPs (HAR showed ~1.3s blocked at 27-wide). */
const MAX_CONCURRENT_LOADS = 6;
let activeLoads = 0;
const loadQueue: Array<() => void> = [];

function acquireLoadSlot(): Promise<void> {
  if (activeLoads < MAX_CONCURRENT_LOADS) {
    activeLoads += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    loadQueue.push(() => {
      activeLoads += 1;
      resolve();
    });
  });
}

function releaseLoadSlot() {
  activeLoads = Math.max(0, activeLoads - 1);
  const next = loadQueue.shift();
  if (next) next();
}

function keyFor(path: string, revision: number) {
  return `${path}::${revision}`;
}

function notify(entry: Entry) {
  const waiters = entry.waiters.splice(0, entry.waiters.length);
  for (const wake of waiters) wake(entry);
}

function startImageElement(
  url: string,
  imagePath: string,
  hasWebp: boolean,
  current: Entry,
): void {
  const element = new window.Image();
  if (url.startsWith('http://') || url.startsWith('https://')) {
    element.crossOrigin = 'anonymous';
  }
  element.decoding = 'async';

  const settle = () => {
    releaseLoadSlot();
  };

  const finish = (img: HTMLImageElement) => {
    const ready = () => {
      current.image = img;
      current.status = 'loaded';
      settle();
      notify(current);
    };
    // Decode off the critical path before React/Konva paint with the bitmap.
    if (typeof img.decode === 'function') {
      void img.decode().then(ready).catch(ready);
    } else {
      ready();
    }
  };

  const fail = () => {
    current.image = null;
    current.status = 'failed';
    settle();
    notify(current);
  };

  element.onload = () => finish(element);
  element.onerror = () => {
    // If WebP failed and we expected it to exist, try PNG fallback
    if (url.endsWith('.webp') && imagePath.endsWith('.png') && hasWebp) {
      const pngUrl = url.replace(/\.webp$/i, '.png');
      const fallbackElement = new window.Image();
      if (pngUrl.startsWith('http://') || pngUrl.startsWith('https://')) {
        fallbackElement.crossOrigin = 'anonymous';
      }
      fallbackElement.decoding = 'async';
      fallbackElement.onload = () => finish(fallbackElement);
      fallbackElement.onerror = fail;
      fallbackElement.src = pngUrl;
    } else {
      fail();
    }
  };
  element.src = url;
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
    void (async () => {
      const current = cache.get(key);
      if (!current) return;
      let url: string | null;
      try {
        url = await resolveImageUrl(imagePath, hasWebp);
      } catch {
        current.status = 'failed';
        notify(current);
        return;
      }
      if (!url) {
        current.status = 'failed';
        notify(current);
        return;
      }
      await acquireLoadSlot();
      // Entry may have been forgotten while waiting for a slot.
      if (cache.get(key) !== current) {
        releaseLoadSlot();
        return;
      }
      startImageElement(url, imagePath, hasWebp, current);
    })();
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

import type { Item, ItemInsert, ItemPatch } from './types.ts';

const DB_NAME = 'knoll';
const DB_VERSION = 1;
const ITEMS = 'items';
const BLOBS = 'blobs';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ITEMS)) {
        db.createObjectStore(ITEMS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(BLOBS)) {
        db.createObjectStore(BLOBS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

function reqAs<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

export async function localListItems(): Promise<Item[]> {
  const db = await openDb();
  const tx = db.transaction(ITEMS, 'readonly');
  const rows = await reqAs<Item[]>(tx.objectStore(ITEMS).getAll());
  return rows
    .sort((a, b) => a.z_index - b.z_index)
    .map((row) => ({ ...row, tags: row.tags ?? [], section_id: row.section_id ?? null }));
}

export async function localInsertItem(item: Item): Promise<Item> {
  const db = await openDb();
  const tx = db.transaction(ITEMS, 'readwrite');
  await reqAs(tx.objectStore(ITEMS).put(item));
  return item;
}

export async function localUpdateItem(id: string, patch: ItemPatch): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(ITEMS, 'readwrite');
  const store = tx.objectStore(ITEMS);
  const current = await reqAs<Item | undefined>(store.get(id));
  if (!current) return;
  await reqAs(store.put({ ...current, ...patch }));
}

export async function localDeleteItem(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([ITEMS, BLOBS], 'readwrite');
  await reqAs(tx.objectStore(ITEMS).delete(id));
  await reqAs(tx.objectStore(BLOBS).delete(`local:${id}`));
}

export async function localPutBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(BLOBS, 'readwrite');
  await reqAs(tx.objectStore(BLOBS).put(blob, key));
}

export async function localGetBlob(key: string): Promise<Blob | undefined> {
  const db = await openDb();
  const tx = db.transaction(BLOBS, 'readonly');
  return reqAs<Blob | undefined>(tx.objectStore(BLOBS).get(key));
}

export function newLocalItem(partial: ItemInsert): Item {
  const id = partial.id ?? crypto.randomUUID();
  return {
    id,
    title: partial.title,
    affiliate_url: partial.affiliate_url,
    store: partial.store,
    image_path: partial.image_path,
    image_width: partial.image_width,
    image_height: partial.image_height,
    x: partial.x,
    y: partial.y,
    scale: partial.scale,
    rotation: partial.rotation,
    z_index: partial.z_index,
    tags: partial.tags ?? [],
    section_id: partial.section_id ?? null,
    created_at: partial.created_at ?? new Date().toISOString(),
  };
}

const LOCAL_SESSION_KEY = 'knoll-local-admin';

export function localSignIn(email: string): void {
  localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ email, at: Date.now() }));
}

export function localSignOut(): void {
  localStorage.removeItem(LOCAL_SESSION_KEY);
}

export function localSessionEmail(): string | null {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string };
    return parsed.email ?? null;
  } catch {
    return null;
  }
}

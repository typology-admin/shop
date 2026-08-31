import { hasSupabaseConfig } from './env.ts';
import {
  localDeleteItem,
  localInsertItem,
  localListItems,
  localPutBlob,
  localUpdateItem,
  newLocalItem,
} from './localStore.ts';
import { getSupabase } from './supabase.ts';
import type { Item, ItemInsert, ItemPatch } from './types.ts';

export async function fetchItems(): Promise<Item[]> {
  if (!hasSupabaseConfig()) {
    return localListItems();
  }
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('items')
    .select(
      'id, title, affiliate_url, store, image_path, image_width, image_height, x, y, scale, rotation, z_index, created_at',
    )
    .order('z_index', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Item[];
}

export async function createItem(input: ItemInsert): Promise<Item> {
  if (!hasSupabaseConfig()) {
    const item = newLocalItem(input);
    return localInsertItem(item);
  }
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('items').insert(input).select().single();
  if (error) throw error;
  return data as Item;
}

export async function updateItem(id: string, patch: ItemPatch): Promise<void> {
  if (!hasSupabaseConfig()) {
    await localUpdateItem(id, patch);
    return;
  }
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('items').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteItem(id: string): Promise<void> {
  if (!hasSupabaseConfig()) {
    await localDeleteItem(id);
    return;
  }
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('items').delete().eq('id', id);
  if (error) throw error;
}

export async function saveLocalBlob(itemId: string, blob: Blob): Promise<string> {
  const key = `local:${itemId}`;
  await localPutBlob(key, blob);
  return key;
}

export type UploadResult = {
  path: string;
  width: number;
  height: number;
};

export async function uploadPng(
  file: Blob,
  accessToken: string | null,
): Promise<UploadResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'image/png',
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers,
    body: file,
  });

  const payload = (await response.json().catch(() => ({}))) as {
    path?: string;
    width?: number;
    height?: number;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? `Upload failed (${response.status})`);
  }
  if (!payload.path || !payload.width || !payload.height) {
    throw new Error('Upload did not return image metadata.');
  }
  return { path: payload.path, width: payload.width, height: payload.height };
}

import { useCallback, useEffect, useState } from 'react';
import { fetchItems } from '../lib/items.ts';
import type { Item } from '../lib/types.ts';

export function useItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const rows = await fetchItems();
      setItems(rows);
      setStatus('ready');
    } catch (err) {
      setItems([]);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Could not load items.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, setItems, status, error, reload };
}

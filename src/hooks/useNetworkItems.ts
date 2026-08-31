import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_NETWORK_ITEMS, fetchNetworkItems } from '../lib/network.ts';
import type { NetworkItem } from '../lib/network.ts';

export function useNetworkItems() {
  const [items, setItems] = useState<NetworkItem[]>(DEFAULT_NETWORK_ITEMS);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('ready');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const rows = await fetchNetworkItems();
      setItems(rows);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Could not load the network.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, setItems, status, error, reload };
}

import { useCallback, useEffect, useState } from 'react';
import { fetchBoardSections, type BoardSection } from '../lib/sections.ts';

export function useBoardSections() {
  const [sections, setSections] = useState<BoardSection[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setSections(await fetchBoardSections());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load sections.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { sections, setSections, error, reload };
}

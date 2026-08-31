import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_CONTACT_LINKS, fetchContactLinks, type ContactLink } from '../lib/contact.ts';

export function useContactLinks() {
  const [links, setLinks] = useState<ContactLink[]>(DEFAULT_CONTACT_LINKS);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setLinks(await fetchContactLinks());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load contact links.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { links, setLinks, error, reload };
}

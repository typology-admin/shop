import { useCallback, useEffect, useState } from 'react';
import {
  fetchAffiliateProducts,
  fetchAffiliatePrograms,
  SEED_PROGRAMS,
  type AffiliateProduct,
  type AffiliateProgram,
} from '../lib/affiliates.ts';

export function useAffiliatePrograms() {
  const [programs, setPrograms] = useState<AffiliateProgram[]>(SEED_PROGRAMS);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setPrograms(await fetchAffiliatePrograms());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load programs.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { programs, setPrograms, error, reload };
}

export function useAffiliateProducts() {
  const [products, setProducts] = useState<AffiliateProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setProducts(await fetchAffiliateProducts());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load products.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { products, setProducts, error, reload };
}

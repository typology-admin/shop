import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MOBILE_BREAKPOINT } from '../../shared/constants.ts';
import {
  DEFAULT_SITE_SETTINGS,
  fetchSiteSettings,
  saveSiteSettings,
  type SiteSettings,
} from '../lib/siteSettings.ts';
import { useMediaQuery } from './useMediaQuery.ts';

type SiteSettingsContextValue = {
  settings: SiteSettings;
  setSettings: (next: SiteSettings) => void;
  error: string | null;
  reload: () => Promise<void>;
  save: (next: SiteSettings) => Promise<SiteSettings>;
};

const SiteSettingsContext = createContext<SiteSettingsContextValue | null>(null);

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setSettings(await fetchSiteSettings());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load site settings.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(async (next: SiteSettings) => {
    const stored = await saveSiteSettings(next);
    setSettings(stored);
    return stored;
  }, []);

  const value = useMemo(
    () => ({ settings, setSettings, error, reload, save }),
    [settings, error, reload, save],
  );

  return createElement(SiteSettingsContext.Provider, { value }, children);
}

export function useSiteSettings(): SiteSettingsContextValue {
  const ctx = useContext(SiteSettingsContext);
  if (!ctx) {
    throw new Error('useSiteSettings must be used within SiteSettingsProvider.');
  }
  return ctx;
}

export function useBoardZoom(): number {
  const { settings } = useSiteSettings();
  const isMobile = useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT}px)`);
  return isMobile ? settings.mobileZoom : settings.desktopZoom;
}

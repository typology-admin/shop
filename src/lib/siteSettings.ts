import {
  DEFAULT_DESKTOP_ZOOM,
  DEFAULT_MOBILE_ZOOM,
} from '../../shared/constants.ts';
import { clampViewZoom } from './canvas.ts';
import { hasSupabaseConfig } from './env.ts';
import { getSupabase } from './supabase.ts';

export const DEFAULT_ABOUT_TEXT =
  'this is a carefully curated selection of objects we think are desirable to own. although the store references might majorly be from one source, we are not associated with any store — but take advantage of affiliation benefits. get in touch for questions about items, items you want to see, items you\'re selling.';

export const DEFAULT_CONTACT_EMAIL = 'info@typology.network';

export type SiteSettings = {
  desktopZoom: number;
  mobileZoom: number;
  aboutText: string;
  contactEmail: string;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  desktopZoom: DEFAULT_DESKTOP_ZOOM,
  mobileZoom: DEFAULT_MOBILE_ZOOM,
  aboutText: DEFAULT_ABOUT_TEXT,
  contactEmail: DEFAULT_CONTACT_EMAIL,
};

const LOCAL_KEY = 'typology-site-settings';

type SettingsRow = {
  desktop_zoom: number | string;
  mobile_zoom: number | string;
  about_text: string;
  contact_email: string;
};

function asZoom(value: number | string | null | undefined, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return clampViewZoom(Number.isFinite(n) ? n : fallback);
}

export function rowToSettings(row: SettingsRow): SiteSettings {
  return {
    desktopZoom: asZoom(row.desktop_zoom, DEFAULT_DESKTOP_ZOOM),
    mobileZoom: asZoom(row.mobile_zoom, DEFAULT_MOBILE_ZOOM),
    aboutText: (row.about_text || DEFAULT_ABOUT_TEXT).trim() || DEFAULT_ABOUT_TEXT,
    contactEmail: (row.contact_email || DEFAULT_CONTACT_EMAIL).trim() || DEFAULT_CONTACT_EMAIL,
  };
}

function readLocal(): SiteSettings {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return DEFAULT_SITE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SiteSettings>;
    return {
      desktopZoom: asZoom(parsed.desktopZoom ?? DEFAULT_DESKTOP_ZOOM, DEFAULT_DESKTOP_ZOOM),
      mobileZoom: asZoom(parsed.mobileZoom ?? DEFAULT_MOBILE_ZOOM, DEFAULT_MOBILE_ZOOM),
      aboutText: parsed.aboutText?.trim() || DEFAULT_ABOUT_TEXT,
      contactEmail: parsed.contactEmail?.trim() || DEFAULT_CONTACT_EMAIL,
    };
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}

function writeLocal(settings: SiteSettings): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(settings));
}

export function mailtoHref(email: string): string {
  const next = email.trim() || DEFAULT_CONTACT_EMAIL;
  return next.startsWith('mailto:') ? next : `mailto:${next}`;
}

export async function fetchSiteSettings(): Promise<SiteSettings> {
  if (!hasSupabaseConfig()) return readLocal();
  const supabase = getSupabase();
  if (!supabase) return readLocal();
  const { data, error } = await supabase
    .from('site_settings')
    .select('desktop_zoom, mobile_zoom, about_text, contact_email')
    .eq('id', 'shop')
    .maybeSingle();
  if (error || !data) return DEFAULT_SITE_SETTINGS;
  return rowToSettings(data as SettingsRow);
}

export async function saveSiteSettings(settings: SiteSettings): Promise<SiteSettings> {
  const next: SiteSettings = {
    desktopZoom: clampViewZoom(settings.desktopZoom),
    mobileZoom: clampViewZoom(settings.mobileZoom),
    aboutText: settings.aboutText.trim() || DEFAULT_ABOUT_TEXT,
    contactEmail: settings.contactEmail.trim() || DEFAULT_CONTACT_EMAIL,
  };
  if (!hasSupabaseConfig()) {
    writeLocal(next);
    return next;
  }
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('site_settings')
    .upsert({
      id: 'shop',
      desktop_zoom: next.desktopZoom,
      mobile_zoom: next.mobileZoom,
      about_text: next.aboutText,
      contact_email: next.contactEmail,
      updated_at: new Date().toISOString(),
    })
    .select('desktop_zoom, mobile_zoom, about_text, contact_email')
    .single();
  if (error) throw error;
  return rowToSettings(data as SettingsRow);
}

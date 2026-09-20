import {
  DEFAULT_BOARD_COLOR,
  DEFAULT_DESKTOP_ZOOM,
  DEFAULT_KNOLL_GAP,
  DEFAULT_KNOLL_GRAVITY,
  DEFAULT_KNOLL_ROTATION,
  DEFAULT_MOBILE_ZOOM,
  DEFAULT_SECTION_HOOKS_HIDE_MS,
  MAX_KNOLL_GAP,
  MAX_SECTION_HOOKS_HIDE_MS,
  MIN_KNOLL_GAP,
  MIN_SECTION_HOOKS_HIDE_MS,
  type KnollRotationMode,
} from '../../shared/constants.ts';
import { clampViewZoom } from './canvas.ts';
import { hasSupabaseConfig } from './env.ts';
import { getSupabase } from './supabase.ts';

export type { KnollRotationMode };

export const DEFAULT_ABOUT_TEXT =
  'this is a carefully curated selection of objects we think are desirable to own. although the store references might majorly be from one source, we are not associated with any store — but take advantage of affiliation benefits. get in touch for questions about items, items you want to see, items you\'re selling.';

export const DEFAULT_CONTACT_EMAIL = 'info@typology.network';

export type SiteSettings = {
  desktopZoom: number;
  mobileZoom: number;
  aboutText: string;
  contactEmail: string;
  sectionHooksHideMs: number;
  knollGap: number;
  knollGravity: boolean;
  knollRotation: KnollRotationMode;
  boardColor: string;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  desktopZoom: DEFAULT_DESKTOP_ZOOM,
  mobileZoom: DEFAULT_MOBILE_ZOOM,
  aboutText: DEFAULT_ABOUT_TEXT,
  contactEmail: DEFAULT_CONTACT_EMAIL,
  sectionHooksHideMs: DEFAULT_SECTION_HOOKS_HIDE_MS,
  knollGap: DEFAULT_KNOLL_GAP,
  knollGravity: DEFAULT_KNOLL_GRAVITY,
  knollRotation: DEFAULT_KNOLL_ROTATION,
  boardColor: DEFAULT_BOARD_COLOR,
};

const LOCAL_KEY = 'typology-site-settings';

type SettingsRow = {
  desktop_zoom: number | string;
  mobile_zoom: number | string;
  about_text: string;
  contact_email: string;
  section_hooks_hide_ms?: number | string | null;
  knoll_gap?: number | string | null;
  board_color?: string | null;
};

function asZoom(value: number | string | null | undefined, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return clampViewZoom(Number.isFinite(n) ? n : fallback);
}

export function clampSectionHooksHideMs(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SECTION_HOOKS_HIDE_MS;
  return Math.min(MAX_SECTION_HOOKS_HIDE_MS, Math.max(MIN_SECTION_HOOKS_HIDE_MS, Math.round(value)));
}

function asHideMs(value: number | string | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value);
  return clampSectionHooksHideMs(Number.isFinite(n) ? n : DEFAULT_SECTION_HOOKS_HIDE_MS);
}

export function clampKnollGap(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_KNOLL_GAP;
  return Math.min(MAX_KNOLL_GAP, Math.max(MIN_KNOLL_GAP, Math.round(value)));
}

function asGap(value: number | string | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value);
  return clampKnollGap(Number.isFinite(n) ? n : DEFAULT_KNOLL_GAP);
}

function asRotation(value: unknown): KnollRotationMode {
  if (value === 'grid' || value === 'radial' || value === 'none') return value;
  return DEFAULT_KNOLL_ROTATION;
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return fallback;
}

function localKnollPrefs(): Pick<SiteSettings, 'knollGravity' | 'knollRotation'> {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) {
      return { knollGravity: DEFAULT_KNOLL_GRAVITY, knollRotation: DEFAULT_KNOLL_ROTATION };
    }
    const parsed = JSON.parse(raw) as Partial<SiteSettings>;
    return {
      knollGravity: asBool(parsed.knollGravity, DEFAULT_KNOLL_GRAVITY),
      knollRotation: asRotation(parsed.knollRotation),
    };
  } catch {
    return { knollGravity: DEFAULT_KNOLL_GRAVITY, knollRotation: DEFAULT_KNOLL_ROTATION };
  }
}

function asBoardColor(value: unknown): string {
  if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    return value.trim().toLowerCase();
  }
  return DEFAULT_BOARD_COLOR;
}

export function rowToSettings(row: SettingsRow): SiteSettings {
  const prefs = localKnollPrefs();
  return {
    desktopZoom: asZoom(row.desktop_zoom, DEFAULT_DESKTOP_ZOOM),
    mobileZoom: asZoom(row.mobile_zoom, DEFAULT_MOBILE_ZOOM),
    aboutText: (row.about_text || DEFAULT_ABOUT_TEXT).trim() || DEFAULT_ABOUT_TEXT,
    contactEmail: (row.contact_email || DEFAULT_CONTACT_EMAIL).trim() || DEFAULT_CONTACT_EMAIL,
    sectionHooksHideMs: asHideMs(row.section_hooks_hide_ms),
    knollGap: asGap(row.knoll_gap),
    knollGravity: prefs.knollGravity,
    knollRotation: prefs.knollRotation,
    boardColor: asBoardColor(row.board_color),
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
      sectionHooksHideMs: asHideMs(parsed.sectionHooksHideMs),
      knollGap: asGap(parsed.knollGap),
      knollGravity: asBool(parsed.knollGravity, DEFAULT_KNOLL_GRAVITY),
      knollRotation: asRotation(parsed.knollRotation),
      boardColor: asBoardColor(parsed.boardColor),
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
    .select('desktop_zoom, mobile_zoom, about_text, contact_email, section_hooks_hide_ms, knoll_gap, board_color')
    .eq('id', 'shop')
    .maybeSingle();
  if (error || !data) return { ...DEFAULT_SITE_SETTINGS, ...localKnollPrefs() };
  return rowToSettings(data as SettingsRow);
}

export async function saveSiteSettings(settings: SiteSettings): Promise<SiteSettings> {
  const next: SiteSettings = {
    desktopZoom: clampViewZoom(settings.desktopZoom),
    mobileZoom: clampViewZoom(settings.mobileZoom),
    aboutText: settings.aboutText.trim() || DEFAULT_ABOUT_TEXT,
    contactEmail: settings.contactEmail.trim() || DEFAULT_CONTACT_EMAIL,
    sectionHooksHideMs: clampSectionHooksHideMs(settings.sectionHooksHideMs),
    knollGap: clampKnollGap(settings.knollGap),
    knollGravity: Boolean(settings.knollGravity),
    knollRotation: asRotation(settings.knollRotation),
    boardColor: asBoardColor(settings.boardColor),
  };
  writeLocal(next);
  if (!hasSupabaseConfig()) return next;
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
      section_hooks_hide_ms: next.sectionHooksHideMs,
      knoll_gap: next.knollGap,
      board_color: next.boardColor,
      updated_at: new Date().toISOString(),
    })
    .select('desktop_zoom, mobile_zoom, about_text, contact_email, section_hooks_hide_ms, knoll_gap, board_color')
    .single();
  if (error) throw error;
  return { ...rowToSettings(data as SettingsRow), knollGravity: next.knollGravity, knollRotation: next.knollRotation };
}

import type { NavigateFunction } from 'react-router-dom';
import { hasSupabaseConfig } from './env.ts';
import { getSupabase } from './supabase.ts';

export type HoverDisplayMode = 'emoji' | 'icon_url' | 'none';

export const NETWORK_ITEM_COLUMNS =
  'id, item_id, prefix, suffix, hover_emoji, description, is_main, sort_order, hover_display_mode, hover_icon_url, hover_bg_image_url, shell_style_index, is_hidden' as const;

export type NetworkItem = {
  id: string;
  dbId?: string;
  prefix: string;
  suffix: string;
  hoverEmoji: string | null;
  description: string;
  isMain: boolean;
  isHidden: boolean;
  sortOrder: number;
  hoverDisplayMode: HoverDisplayMode;
  hoverIconUrl: string | null;
  hoverBgImageUrl: string | null;
  shellStyleIndex: number;
};

export type NetworkItemRow = {
  id: string;
  item_id: string;
  prefix: string;
  suffix: string;
  hover_emoji: string | null;
  description: string;
  is_main: boolean;
  sort_order: number;
  hover_display_mode?: string | null;
  hover_icon_url?: string | null;
  hover_bg_image_url?: string | null;
  shell_style_index?: number | null;
  is_hidden?: boolean | null;
};

export const DEFAULT_NETWORK_ITEMS: NetworkItem[] = [
  {
    id: 'main',
    prefix: 'typology',
    suffix: '.network',
    hoverEmoji: null,
    description: '',
    isMain: true,
    isHidden: false,
    sortOrder: 0,
    hoverDisplayMode: 'emoji',
    hoverIconUrl: null,
    hoverBgImageUrl: null,
    shellStyleIndex: 0,
  },
  {
    id: 'graphics',
    prefix: 'graphics',
    suffix: '.typology.network',
    hoverEmoji: '🎨',
    description: 'generative wall decoration',
    isMain: false,
    isHidden: false,
    sortOrder: 1,
    hoverDisplayMode: 'emoji',
    hoverIconUrl: null,
    hoverBgImageUrl: null,
    shellStyleIndex: 1,
  },
  {
    id: 'grid',
    prefix: 'grid',
    suffix: '.typology.network',
    hoverEmoji: '📏',
    description: 'physical measuring grid on a digital screen',
    isMain: false,
    isHidden: false,
    sortOrder: 3,
    hoverDisplayMode: 'emoji',
    hoverIconUrl: null,
    hoverBgImageUrl: null,
    shellStyleIndex: 3,
  },
  {
    id: 'time',
    prefix: 'time',
    suffix: '.typology.network',
    hoverEmoji: '⏳',
    description: 'Explore time in a giant Gantt chart',
    isMain: false,
    isHidden: false,
    sortOrder: 5,
    hoverDisplayMode: 'emoji',
    hoverIconUrl: null,
    hoverBgImageUrl: null,
    shellStyleIndex: 5,
  },
  {
    id: 'shop',
    prefix: 'shop',
    suffix: '.typology.network',
    hoverEmoji: '🛍️',
    description: 'curated items',
    isMain: false,
    isHidden: false,
    sortOrder: 6,
    hoverDisplayMode: 'emoji',
    hoverIconUrl: null,
    hoverBgImageUrl: null,
    shellStyleIndex: 6,
  },
];

export function visibleNetworkItems(items: NetworkItem[]): NetworkItem[] {
  return items.filter((item) => !item.isHidden);
}

export function rowToNetworkItem(row: NetworkItemRow): NetworkItem {
  const mode = row.hover_display_mode;
  const hoverDisplayMode: HoverDisplayMode =
    mode === 'icon_url' || mode === 'none' || mode === 'emoji' ? mode : 'emoji';
  return {
    id: row.item_id,
    dbId: row.id,
    prefix: row.prefix,
    suffix: row.suffix,
    hoverEmoji: row.hover_emoji,
    description: row.description,
    isMain: row.is_main,
    isHidden: Boolean(row.is_hidden),
    sortOrder: row.sort_order,
    hoverDisplayMode,
    hoverIconUrl: row.hover_icon_url ?? null,
    hoverBgImageUrl: row.hover_bg_image_url ?? null,
    shellStyleIndex: Math.min(7, Math.max(0, row.shell_style_index ?? 0)),
  };
}

/** Internal routes for properties that live in this app; others stay on their subdomain. */
export function itemHref(item: NetworkItem): string {
  if (item.isMain) return '/network';
  if (item.prefix === 'shop') return '/';
  return `https://${item.prefix}.typology.network`;
}

export function itemAriaLabel(item: NetworkItem): string {
  if (item.isMain) return 'typology.network home';
  return `${item.prefix}.typology.network`;
}

export function visitNetworkItem(item: NetworkItem, navigate: NavigateFunction): void {
  const href = itemHref(item);
  if (href.startsWith('/')) navigate(href);
  else window.location.assign(href);
}

export async function fetchNetworkItems(): Promise<NetworkItem[]> {
  if (!hasSupabaseConfig()) return DEFAULT_NETWORK_ITEMS;
  const supabase = getSupabase();
  if (!supabase) return DEFAULT_NETWORK_ITEMS;
  const { data, error } = await supabase
    .from('network_items')
    .select(NETWORK_ITEM_COLUMNS)
    .order('sort_order', { ascending: true });
  if (error || !data?.length) return DEFAULT_NETWORK_ITEMS;
  return (data as NetworkItemRow[]).map(rowToNetworkItem);
}

export async function insertNetworkItem(item: Omit<NetworkItem, 'dbId'>): Promise<NetworkItem> {
  if (!hasSupabaseConfig()) return { ...item };
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('network_items')
    .insert({
      item_id: item.id,
      prefix: item.prefix,
      suffix: item.suffix,
      hover_emoji: item.hoverEmoji,
      description: item.description,
      is_main: item.isMain,
      sort_order: item.sortOrder,
      hover_display_mode: item.hoverDisplayMode,
      hover_icon_url: item.hoverIconUrl,
      hover_bg_image_url: item.hoverBgImageUrl,
      shell_style_index: item.shellStyleIndex,
      is_hidden: item.isHidden,
    })
    .select(NETWORK_ITEM_COLUMNS)
    .single();
  if (error) throw error;
  return rowToNetworkItem(data as NetworkItemRow);
}

export async function updateNetworkItem(
  item: NetworkItem,
  patch: Partial<
    Pick<
      NetworkItem,
      | 'prefix'
      | 'suffix'
      | 'description'
      | 'hoverEmoji'
      | 'hoverDisplayMode'
      | 'hoverIconUrl'
      | 'hoverBgImageUrl'
      | 'shellStyleIndex'
      | 'isHidden'
    >
  >,
): Promise<NetworkItem> {
  if (!hasSupabaseConfig()) return { ...item, ...patch };
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const q = item.dbId
    ? supabase.from('network_items').update({
        prefix: patch.prefix ?? item.prefix,
        suffix: patch.suffix ?? item.suffix,
        description: patch.description ?? item.description,
        hover_emoji: patch.hoverEmoji === undefined ? item.hoverEmoji : patch.hoverEmoji,
        hover_display_mode: patch.hoverDisplayMode ?? item.hoverDisplayMode,
        hover_icon_url: patch.hoverIconUrl === undefined ? item.hoverIconUrl : patch.hoverIconUrl,
        hover_bg_image_url:
          patch.hoverBgImageUrl === undefined ? item.hoverBgImageUrl : patch.hoverBgImageUrl,
        shell_style_index: patch.shellStyleIndex ?? item.shellStyleIndex,
        is_hidden: patch.isHidden ?? item.isHidden,
      }).eq('id', item.dbId)
    : supabase.from('network_items').update({
        is_hidden: patch.isHidden ?? item.isHidden,
      }).eq('item_id', item.id);
  const { data, error } = await q.select(NETWORK_ITEM_COLUMNS).single();
  if (error) throw error;
  return rowToNetworkItem(data as NetworkItemRow);
}

export async function deleteNetworkItem(item: NetworkItem): Promise<void> {
  if (item.isMain) return;
  if (!hasSupabaseConfig()) return;
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('network_items').delete().eq('item_id', item.id);
  if (error) throw error;
}

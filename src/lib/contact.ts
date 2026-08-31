import { hasSupabaseConfig } from './env.ts';
import { getSupabase } from './supabase.ts';

export type ContactLink = {
  id: string;
  slug: string;
  label: string;
  href: string;
  sortOrder: number;
};

export const DEFAULT_CONTACT_LINKS: ContactLink[] = [
  { id: 'support', slug: 'support', label: 'support', href: 'mailto:support@typology.network', sortOrder: 0 },
  { id: 'sale', slug: 'sale', label: 'sale', href: 'mailto:sale@typology.network', sortOrder: 1 },
  { id: 'buy', slug: 'buy', label: 'buy', href: '/', sortOrder: 2 },
];

type ContactRow = {
  id: string;
  slug: string;
  label: string;
  href: string;
  sort_order: number;
};

function rowToLink(row: ContactRow): ContactLink {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    href: row.href,
    sortOrder: row.sort_order,
  };
}

export async function fetchContactLinks(): Promise<ContactLink[]> {
  if (!hasSupabaseConfig()) return DEFAULT_CONTACT_LINKS;
  const supabase = getSupabase();
  if (!supabase) return DEFAULT_CONTACT_LINKS;
  const { data, error } = await supabase
    .from('contact_links')
    .select('id, slug, label, href, sort_order')
    .order('sort_order', { ascending: true });
  if (error || !data?.length) return DEFAULT_CONTACT_LINKS;
  return (data as ContactRow[]).map(rowToLink);
}

export async function insertContactLink(input: {
  slug: string;
  label: string;
  href: string;
  sortOrder: number;
}): Promise<ContactLink> {
  if (!hasSupabaseConfig()) {
    return {
      id: input.slug,
      slug: input.slug,
      label: input.label,
      href: input.href,
      sortOrder: input.sortOrder,
    };
  }
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('contact_links')
    .insert({
      slug: input.slug,
      label: input.label,
      href: input.href,
      sort_order: input.sortOrder,
    })
    .select('id, slug, label, href, sort_order')
    .single();
  if (error) throw error;
  return rowToLink(data as ContactRow);
}

export async function updateContactLink(
  link: ContactLink,
  patch: Partial<Pick<ContactLink, 'label' | 'href' | 'slug'>>,
): Promise<ContactLink> {
  if (!hasSupabaseConfig()) return { ...link, ...patch };
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('contact_links')
    .update({
      label: patch.label ?? link.label,
      href: patch.href ?? link.href,
      slug: patch.slug ?? link.slug,
    })
    .eq('id', link.id)
    .select('id, slug, label, href, sort_order')
    .single();
  if (error) throw error;
  return rowToLink(data as ContactRow);
}

export async function deleteContactLink(link: ContactLink): Promise<void> {
  if (!hasSupabaseConfig()) return;
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('contact_links').delete().eq('id', link.id);
  if (error) throw error;
}

export function openContactHref(href: string, navigate: (path: string) => void): void {
  const next = href.trim();
  if (!next) return;
  if (next.startsWith('/')) {
    navigate(next);
    return;
  }
  if (next.startsWith('mailto:') || next.startsWith('tel:')) {
    window.location.assign(next);
    return;
  }
  window.open(next, '_blank', 'noopener,noreferrer');
}

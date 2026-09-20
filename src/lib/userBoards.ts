import { CANVAS_WIDTH } from '../../shared/constants.ts';
import { getSupabase } from './supabase.ts';

export type BoardVisibility = 'private' | 'unlisted' | 'public';

export type UserBoard = {
  id: string;
  owner_id: string;
  title: string;
  slug: string;
  visibility: BoardVisibility;
  share_token: string | null;
  wishlist_enabled: boolean;
  suggestions_enabled: boolean;
  og_image_path: string | null;
  thumbnail_emoji: string | null;
  background_color: string;
  created_at: string;
  updated_at: string;
};

export type UserBoardSection = {
  id: string;
  board_id: string;
  title: string;
  x: number;
  y: number;
  strength: number;
  sort_order: number;
  created_at: string;
};

export type UserBoardItem = {
  id: string;
  board_id: string;
  section_id: string | null;
  url: string;
  title: string;
  price: number | null;
  currency: string;
  image_path: string | null;
  source_image_url: string | null;
  image_width: number;
  image_height: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  locked: boolean;
  z_index: number;
  created_at: string;
  updated_at: string;
};

export type UserBoardClaim = {
  id: string;
  item_id: string;
  board_id: string;
  claimed_by: string;
  claimer_id: string | null;
  created_at: string;
};

export type UserBoardSuggestion = {
  id: string;
  board_id: string;
  url: string;
  title: string;
  price: number | null;
  currency: string;
  image_url: string | null;
  note: string;
  suggested_by: string;
  suggester_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

export type BoardBundle = {
  board: UserBoard;
  sections: UserBoardSection[];
  items: UserBoardItem[];
  claims: UserBoardClaim[];
};

const BOARD_COLS =
  'id, owner_id, title, slug, visibility, share_token, wishlist_enabled, suggestions_enabled, og_image_path, thumbnail_emoji, background_color, created_at, updated_at';
const SECTION_COLS = 'id, board_id, title, x, y, strength, sort_order, created_at';
const ITEM_COLS =
  'id, board_id, section_id, url, title, price, currency, image_path, source_image_url, image_width, image_height, x, y, rotation, scale, locked, z_index, created_at, updated_at';

export function slugifyTitle(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'board';
}

export function itemImageSrc(item: UserBoardItem): string {
  return item.image_path || item.source_image_url || '';
}

export function nearestSectionId(
  x: number,
  y: number,
  sections: UserBoardSection[],
): string | null {
  if (sections.length === 0) return null;
  let best: UserBoardSection | null = null;
  let bestD = Infinity;
  for (const section of sections) {
    const d = Math.hypot(section.x - x, section.y - y) / Math.max(section.strength, 0.25);
    if (d < bestD) {
      bestD = d;
      best = section;
    }
  }
  return best?.id ?? null;
}

function requireClient() {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function listOwnBoards(ownerId: string): Promise<UserBoard[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('user_boards')
    .select(BOARD_COLS)
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false });
  if (error) {
    throw new Error(error.message || error.details || error.hint || 'Could not load boards.');
  }
  return (data ?? []).map(normalizeBoard);
}

function normalizeBoard(row: UserBoard): UserBoard {
  return {
    ...row,
    thumbnail_emoji: row.thumbnail_emoji ?? null,
    background_color: row.background_color || '#bfbfbf',
  };
}

export async function listPublicBoards(ownerId: string): Promise<UserBoard[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('user_boards')
    .select(BOARD_COLS)
    .eq('owner_id', ownerId)
    .eq('visibility', 'public')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message || error.details || 'Could not load boards.');
  return (data ?? []).map(normalizeBoard);
}

export async function createBoard(
  ownerId: string,
  input: { title: string; slug?: string },
): Promise<UserBoard> {
  const supabase = requireClient();
  const title = input.title.trim() || 'Untitled';
  let slug = slugifyTitle(input.slug || title);
  for (let i = 0; i < 8; i += 1) {
    const { data, error } = await supabase
      .from('user_boards')
      .insert({ owner_id: ownerId, title, slug, visibility: 'private' })
      .select(BOARD_COLS)
      .single();
    if (!error && data) return data as UserBoard;
    if (error?.code !== '23505') throw error ?? new Error('Could not create the board.');
    slug = `${slugifyTitle(title).slice(0, 40)}-${i + 2}`;
  }
  throw new Error('Could not create a unique slug.');
}

export async function updateBoard(
  id: string,
  patch: Partial<
    Pick<
      UserBoard,
      | 'title'
      | 'slug'
      | 'visibility'
      | 'wishlist_enabled'
      | 'suggestions_enabled'
      | 'og_image_path'
      | 'thumbnail_emoji'
      | 'background_color'
    >
  >,
): Promise<UserBoard> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('user_boards')
    .update(patch)
    .eq('id', id)
    .select(BOARD_COLS)
    .single();
  if (error) throw error;
  return data as UserBoard;
}

export async function deleteBoard(id: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from('user_boards').delete().eq('id', id);
  if (error) throw error;
}

export async function loadBoardBySlug(ownerId: string, slug: string): Promise<BoardBundle | null> {
  const supabase = requireClient();
  const { data: board, error } = await supabase
    .from('user_boards')
    .select(BOARD_COLS)
    .eq('owner_id', ownerId)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!board) return null;
  return loadBoardParts(board as UserBoard);
}

export async function loadSharedBoard(token: string): Promise<BoardBundle> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc('open_shared_board', { p_token: token });
  if (error) throw new Error('This share link is not valid.');
  const payload = data as BoardBundle;
  return {
    board: payload.board,
    sections: payload.sections ?? [],
    items: payload.items ?? [],
    claims: payload.claims ?? [],
  };
}

async function loadBoardParts(board: UserBoard): Promise<BoardBundle> {
  const supabase = requireClient();
  const [{ data: sections, error: sectionError }, { data: items, error: itemError }] =
    await Promise.all([
      supabase
        .from('user_board_sections')
        .select(SECTION_COLS)
        .eq('board_id', board.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('user_board_items')
        .select(ITEM_COLS)
        .eq('board_id', board.id)
        .order('z_index', { ascending: true }),
    ]);
  if (sectionError) throw sectionError;
  if (itemError) throw itemError;

  let claims: UserBoardClaim[] = [];
  const { data: claimRows, error: claimError } = await supabase
    .from('user_board_item_claims')
    .select('id, item_id, board_id, claimed_by, claimer_id, created_at')
    .eq('board_id', board.id);
  if (!claimError) claims = (claimRows ?? []) as UserBoardClaim[];

  return {
    board,
    sections: (sections ?? []) as UserBoardSection[],
    items: (items ?? []) as UserBoardItem[],
    claims,
  };
}

export async function addSection(
  boardId: string,
  input?: Partial<Pick<UserBoardSection, 'title' | 'x' | 'y' | 'strength' | 'sort_order'>>,
): Promise<UserBoardSection> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('user_board_sections')
    .insert({
      board_id: boardId,
      title: input?.title?.trim() || 'section',
      x: input?.x ?? CANVAS_WIDTH / 2,
      y: input?.y ?? 900,
      strength: input?.strength ?? 1,
      sort_order: input?.sort_order ?? 0,
    })
    .select(SECTION_COLS)
    .single();
  if (error) throw error;
  return data as UserBoardSection;
}

export async function updateSection(
  id: string,
  patch: Partial<Pick<UserBoardSection, 'title' | 'x' | 'y' | 'strength'>>,
): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from('user_board_sections').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteSection(id: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from('user_board_sections').delete().eq('id', id);
  if (error) throw error;
}

export async function addItem(
  boardId: string,
  input: Partial<UserBoardItem> & { title?: string },
): Promise<UserBoardItem> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('user_board_items')
    .insert({
      board_id: boardId,
      section_id: input.section_id ?? null,
      url: input.url ?? '',
      title: input.title ?? '',
      price: input.price ?? null,
      currency: input.currency ?? 'EUR',
      image_path: input.image_path ?? null,
      source_image_url: input.source_image_url ?? null,
      image_width: input.image_width ?? 0,
      image_height: input.image_height ?? 0,
      x: input.x ?? CANVAS_WIDTH / 2,
      y: input.y ?? 900,
      rotation: input.rotation ?? 0,
      scale: input.scale ?? 1,
      locked: input.locked ?? false,
      z_index: input.z_index ?? Math.floor(Date.now() / 1000),
    })
    .select(ITEM_COLS)
    .single();
  if (error) throw error;
  return data as UserBoardItem;
}

export async function updateItem(
  id: string,
  patch: Partial<
    Pick<
      UserBoardItem,
      | 'section_id'
      | 'url'
      | 'title'
      | 'price'
      | 'currency'
      | 'image_path'
      | 'source_image_url'
      | 'image_width'
      | 'image_height'
      | 'x'
      | 'y'
      | 'rotation'
      | 'scale'
      | 'locked'
      | 'z_index'
    >
  >,
): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from('user_board_items').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteItem(id: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from('user_board_items').delete().eq('id', id);
  if (error) throw error;
}

export async function rotateShareToken(boardId: string): Promise<string> {
  const supabase = requireClient();
  const { data, error } = await supabase.rpc('rotate_share_token', { p_board_id: boardId });
  if (error) throw error;
  return String(data);
}

export async function claimItem(
  boardId: string,
  itemId: string,
  claimedBy: string,
  claimerId: string | null,
  shareToken?: string,
): Promise<void> {
  const supabase = requireClient();
  if (shareToken) {
    const { error } = await supabase.rpc('claim_shared_item', {
      p_token: shareToken,
      p_item_id: itemId,
      p_claimed_by: claimedBy.trim(),
    });
    if (error) {
      if (error.code === '23505') throw new Error('Someone already claimed this.');
      throw error;
    }
    return;
  }
  const { error } = await supabase.from('user_board_item_claims').insert({
    board_id: boardId,
    item_id: itemId,
    claimed_by: claimedBy.trim(),
    claimer_id: claimerId,
  });
  if (error) {
    if (error.code === '23505') throw new Error('Someone already claimed this.');
    throw error;
  }
}

export async function listSuggestions(boardId: string): Promise<UserBoardSuggestion[]> {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('user_board_suggestions')
    .select(
      'id, board_id, url, title, price, currency, image_url, note, suggested_by, suggester_id, status, created_at',
    )
    .eq('board_id', boardId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as UserBoardSuggestion[];
}

export async function suggestItem(
  boardId: string,
  input: {
    url: string;
    title: string;
    price: number | null;
    currency: string;
    image_url: string | null;
    note: string;
    suggested_by: string;
    suggester_id: string | null;
  },
): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase.from('user_board_suggestions').insert({
    board_id: boardId,
    url: input.url,
    title: input.title,
    price: input.price,
    currency: input.currency,
    image_url: input.image_url,
    note: input.note,
    suggested_by: input.suggested_by,
    suggester_id: input.suggester_id,
    status: 'pending',
  });
  if (error) throw error;
}

export async function resolveSuggestion(
  suggestion: UserBoardSuggestion,
  action: 'approved' | 'rejected',
): Promise<void> {
  const supabase = requireClient();
  if (action === 'approved') {
    await addItem(suggestion.board_id, {
      url: suggestion.url,
      title: suggestion.title,
      price: suggestion.price,
      currency: suggestion.currency,
      source_image_url: suggestion.image_url,
    });
  }
  const { error } = await supabase
    .from('user_board_suggestions')
    .update({ status: action })
    .eq('id', suggestion.id);
  if (error) throw error;
}

export async function deleteAccount(): Promise<void> {
  const supabase = requireClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch('/api/account', {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? 'Could not delete the account.');
  await supabase.auth.signOut();
}

import { scrollTopForCanvasY } from './canvas.ts';
import { hasSupabaseConfig } from './env.ts';
import { getSupabase } from './supabase.ts';

export type SceneItem = {
  emoji: string;
  label: string;
};

export type BoardSection = {
  id: string;
  name: string;
  slug: string;
  y: number;
  sortOrder: number;
  items: SceneItem[];
};

const LOCAL_KEY = 'knoll-board-sections';
const LAST_SCENE_KEY = 'typology-last-scene';

export const SCENE_SPACING = 1400;
export const SCENE_START_Y = 900;

export const SCENE_KITS: Array<Omit<BoardSection, 'id'>> = [
  {
    name: 'morning',
    slug: 'morning',
    y: SCENE_START_Y,
    sortOrder: 0,
    items: [
      { emoji: '☕', label: 'Coffee' },
      { emoji: '📖', label: 'Book' },
      { emoji: '⌚', label: 'Watch' },
      { emoji: '💡', label: 'Lamp' },
      { emoji: '🖊', label: 'Pen' },
      { emoji: '🪑', label: 'Chair' },
    ],
  },
  {
    name: 'desk',
    slug: 'desk',
    y: SCENE_START_Y + SCENE_SPACING,
    sortOrder: 1,
    items: [
      { emoji: '💻', label: 'Computer' },
      { emoji: '🖊', label: 'Pen' },
      { emoji: '📓', label: 'Notebook' },
      { emoji: '🎧', label: 'Headphones' },
      { emoji: '💡', label: 'Lamp' },
      { emoji: '🗄', label: 'Storage' },
    ],
  },
  {
    name: 'weekend',
    slug: 'weekend',
    y: SCENE_START_Y + SCENE_SPACING * 2,
    sortOrder: 2,
    items: [
      { emoji: '🧺', label: 'Picnic' },
      { emoji: '🔪', label: 'Knife' },
      { emoji: '☕', label: 'Thermos' },
      { emoji: '🕶', label: 'Sunglasses' },
      { emoji: '📻', label: 'Speaker' },
      { emoji: '🧥', label: 'Jacket' },
    ],
  },
  {
    name: 'workshop',
    slug: 'workshop',
    y: SCENE_START_Y + SCENE_SPACING * 3,
    sortOrder: 3,
    items: [
      { emoji: '🔨', label: 'Hammer' },
      { emoji: '📏', label: 'Ruler' },
      { emoji: '✏️', label: 'Pencil' },
      { emoji: '🔧', label: 'Screwdriver' },
      { emoji: '🧤', label: 'Gloves' },
      { emoji: '🪚', label: 'Saw' },
    ],
  },
  {
    name: 'boat',
    slug: 'boat',
    y: SCENE_START_Y + SCENE_SPACING * 4,
    sortOrder: 4,
    items: [
      { emoji: '🧭', label: 'Compass' },
      { emoji: '☕', label: 'Mug' },
      { emoji: '🧥', label: 'Jacket' },
      { emoji: '🔦', label: 'Flashlight' },
      { emoji: '🔪', label: 'Knife' },
      { emoji: '🪢', label: 'Rope' },
    ],
  },
];

const DUMMY_SLUGS = new Set(['top', 'boot']);

type SectionRow = {
  id: string;
  name: string;
  slug: string | null;
  y: number;
  sort_order: number;
  items: SceneItem[] | null;
};

function kitFor(name: string, slug?: string | null): SceneItem[] {
  const key = (slug || name).toLowerCase();
  return SCENE_KITS.find((kit) => kit.slug === key)?.items ?? [];
}

function rowToSection(row: SectionRow): BoardSection {
  const slug = (row.slug || row.name).toLowerCase().trim();
  return {
    id: row.id,
    name: row.name,
    slug,
    y: row.y,
    sortOrder: row.sort_order,
    items: Array.isArray(row.items) && row.items.length ? row.items : kitFor(row.name, slug),
  };
}

function defaultSections(): BoardSection[] {
  return SCENE_KITS.map((kit) => ({ ...kit, id: kit.slug }));
}

export function mergeDefaultScenes(existing: BoardSection[]): BoardSection[] {
  const usable = existing.filter((row) => !DUMMY_SLUGS.has(row.slug || row.name.toLowerCase()));
  const bySlug = new Map(usable.map((row) => [row.slug || row.name.toLowerCase(), row]));
  const scenes = SCENE_KITS.map((kit) => {
    const found = bySlug.get(kit.slug);
    if (found) {
      return {
        ...found,
        slug: kit.slug,
        items: found.items.length ? found.items : kit.items,
      };
    }
    return { ...kit, id: kit.slug };
  });
  const extras = usable.filter((row) => !SCENE_KITS.some((kit) => kit.slug === (row.slug || row.name.toLowerCase())));
  return [...scenes, ...extras].sort((a, b) => a.y - b.y || a.sortOrder - b.sortOrder);
}

function readLocal(): BoardSection[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return defaultSections();
    const parsed = JSON.parse(raw) as BoardSection[];
    return mergeDefaultScenes(Array.isArray(parsed) ? parsed : []);
  } catch {
    return defaultSections();
  }
}

function writeLocal(sections: BoardSection[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(sections));
}

export function pickLandingSection(sections: BoardSection[]): BoardSection | null {
  if (sections.length === 0) return null;
  let last = '';
  try {
    last = sessionStorage.getItem(LAST_SCENE_KEY) ?? '';
  } catch {
    last = '';
  }
  const pool = sections.length > 1 ? sections.filter((row) => row.slug !== last) : sections;
  const pick = pool[Math.floor(Math.random() * pool.length)] ?? sections[0];
  try {
    sessionStorage.setItem(LAST_SCENE_KEY, pick.slug);
  } catch {
    /* ignore */
  }
  return pick;
}

export function jumpToSection(section: BoardSection, behavior: ScrollBehavior = 'instant') {
  window.scrollTo({ top: scrollTopForCanvasY(section.y), behavior });
}

export async function fetchBoardSections(): Promise<BoardSection[]> {
  if (!hasSupabaseConfig()) {
    return readLocal().sort((a, b) => a.y - b.y || a.sortOrder - b.sortOrder);
  }
  const supabase = getSupabase();
  if (!supabase) return defaultSections();
  const { data, error } = await supabase
    .from('board_sections')
    .select('id, name, slug, y, sort_order, items')
    .order('y', { ascending: true });
  if (error) throw error;
  return mergeDefaultScenes((data as SectionRow[]).map(rowToSection));
}

export async function insertBoardSection(input: {
  name: string;
  y: number;
  sortOrder: number;
}): Promise<BoardSection> {
  const slug = input.name.trim().toLowerCase().replace(/\s+/g, '-');
  const items = kitFor(input.name, slug);
  if (!hasSupabaseConfig()) {
    const next: BoardSection = {
      id: crypto.randomUUID(),
      name: input.name,
      slug,
      y: input.y,
      sortOrder: input.sortOrder,
      items,
    };
    writeLocal([...readLocal(), next]);
    return next;
  }
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('board_sections')
    .insert({ name: input.name, slug, y: input.y, sort_order: input.sortOrder, items })
    .select('id, name, slug, y, sort_order, items')
    .single();
  if (error) throw error;
  return rowToSection(data as SectionRow);
}

export async function updateBoardSection(
  section: BoardSection,
  patch: Partial<Pick<BoardSection, 'name' | 'y' | 'sortOrder'>>,
): Promise<BoardSection> {
  const next = { ...section, ...patch };
  if (!hasSupabaseConfig()) {
    writeLocal(readLocal().map((row) => (row.id === section.id ? next : row)));
    return next;
  }
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('board_sections')
    .update({
      name: patch.name ?? section.name,
      y: patch.y ?? section.y,
      sort_order: patch.sortOrder ?? section.sortOrder,
    })
    .eq('id', section.id)
    .select('id, name, slug, y, sort_order, items')
    .single();
  if (error) throw error;
  return rowToSection(data as SectionRow);
}

/** Spread scenes on an even vertical rhythm (canvas Y). */
export function evenSectionPositions(sections: BoardSection[]): BoardSection[] {
  const ranked = [...sections].sort((a, b) => a.y - b.y || a.sortOrder - b.sortOrder);
  return ranked.map((section, index) => ({
    ...section,
    y: SCENE_START_Y + index * SCENE_SPACING,
    sortOrder: index,
  }));
}

export async function spaceBoardSectionsEvenly(sections: BoardSection[]): Promise<BoardSection[]> {
  const next = evenSectionPositions(sections);
  await Promise.all(
    next.map((section) => updateBoardSection(section, { y: section.y, sortOrder: section.sortOrder })),
  );
  if (!hasSupabaseConfig()) {
    writeLocal(next);
  }
  return next;
}

export async function deleteBoardSection(section: BoardSection): Promise<void> {
  if (!hasSupabaseConfig()) {
    writeLocal(readLocal().filter((row) => row.id !== section.id));
    return;
  }
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('board_sections').delete().eq('id', section.id);
  if (error) throw error;
}

import { hasSupabaseConfig } from './env.ts';
import { getSupabase } from './supabase.ts';

export type BoardSection = {
  id: string;
  name: string;
  y: number;
  sortOrder: number;
};

const LOCAL_KEY = 'knoll-board-sections';

type SectionRow = {
  id: string;
  name: string;
  y: number;
  sort_order: number;
};

function rowToSection(row: SectionRow): BoardSection {
  return {
    id: row.id,
    name: row.name,
    y: row.y,
    sortOrder: row.sort_order,
  };
}

function readLocal(): BoardSection[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BoardSection[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(sections: BoardSection[]) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(sections));
}

export async function fetchBoardSections(): Promise<BoardSection[]> {
  if (!hasSupabaseConfig()) {
    return readLocal().sort((a, b) => a.y - b.y || a.sortOrder - b.sortOrder);
  }
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('board_sections')
    .select('id, name, y, sort_order')
    .order('y', { ascending: true });
  if (error) throw error;
  return (data as SectionRow[]).map(rowToSection);
}

export async function insertBoardSection(input: {
  name: string;
  y: number;
  sortOrder: number;
}): Promise<BoardSection> {
  if (!hasSupabaseConfig()) {
    const next: BoardSection = {
      id: crypto.randomUUID(),
      name: input.name,
      y: input.y,
      sortOrder: input.sortOrder,
    };
    writeLocal([...readLocal(), next]);
    return next;
  }
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('board_sections')
    .insert({ name: input.name, y: input.y, sort_order: input.sortOrder })
    .select('id, name, y, sort_order')
    .single();
  if (error) throw error;
  return rowToSection(data as SectionRow);
}

export async function updateBoardSection(
  section: BoardSection,
  patch: Partial<Pick<BoardSection, 'name' | 'y'>>,
): Promise<BoardSection> {
  if (!hasSupabaseConfig()) {
    const next = { ...section, ...patch };
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
    })
    .eq('id', section.id)
    .select('id, name, y, sort_order')
    .single();
  if (error) throw error;
  return rowToSection(data as SectionRow);
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

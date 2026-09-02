const MAX_TAG_LENGTH = 32;
const MAX_TAGS = 16;

export function parseTags(raw: string | string[] | null | undefined): string[] {
  const parts = Array.isArray(raw) ? raw : String(raw ?? '').split(/[,;\n]+/);
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of parts) {
    const tag = part.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= MAX_TAGS) break;
  }
  return tags;
}

export function tagsToInput(tags: string[]): string {
  return tags.join(', ');
}

export function itemMatchesQuery(hay: string, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  const haystack = hay.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

import { WELL_COLORS } from './wells.ts';
import type { Item } from './types.ts';
import type { UserBoardItem, UserBoardSection } from './userBoards.ts';
import { itemImageSrc } from './userBoards.ts';

export function toCanvasItem(item: UserBoardItem): Item {
  return {
    id: item.id,
    title: item.title,
    affiliate_url: item.url,
    store: '',
    image_path: itemImageSrc(item),
    image_width: item.image_width || 400,
    image_height: item.image_height || 400,
    x: item.x,
    y: item.y,
    scale: item.scale,
    rotation: item.rotation,
    z_index: item.z_index,
    tags: [],
    section_id: item.section_id,
    created_at: item.created_at,
  };
}

export function userWells(sections: UserBoardSection[]) {
  return sections.map((section, index) => ({
    id: section.id,
    x: section.x,
    y: section.y,
    sectionId: section.id,
    color: WELL_COLORS[index % WELL_COLORS.length] ?? WELL_COLORS[0]!,
  }));
}

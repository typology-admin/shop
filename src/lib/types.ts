export type Item = {
  id: string;
  title: string;
  affiliate_url: string;
  store: string;
  image_path: string;
  image_width: number;
  image_height: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  z_index: number;
  tags: string[];
  /** Scene / gravity well this object is attracted to. */
  section_id: string | null;
  created_at: string;
  image_rev?: number;
};

export type ItemInsert = Omit<Item, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type ItemPatch = Partial<
  Pick<
    Item,
    | 'title'
    | 'affiliate_url'
    | 'store'
    | 'image_path'
    | 'image_width'
    | 'image_height'
    | 'x'
    | 'y'
    | 'scale'
    | 'rotation'
    | 'z_index'
    | 'tags'
    | 'section_id'
  >
>;

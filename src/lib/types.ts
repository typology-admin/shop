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
  created_at: string;
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
    | 'x'
    | 'y'
    | 'scale'
    | 'rotation'
    | 'z_index'
    | 'tags'
  >
>;

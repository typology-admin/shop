import { hasSupabaseConfig } from './env.ts';
import { getSupabase } from './supabase.ts';

export type AffiliateNetwork = 'awin' | 'amazon' | 'etsy' | 'ebay' | 'other';
export type AffiliateStatus = 'live' | 'pending' | 'api';

export type AffiliateProgram = {
  id: string;
  slug: string;
  name: string;
  network: AffiliateNetwork;
  commissionLabel: string;
  rating: number;
  status: AffiliateStatus;
  awinAdvertiserId: string | null;
  clicks: number;
  conversions: number;
  commissionEur: number;
  sortOrder: number;
  featured: boolean;
};

export type AffiliateProduct = {
  id: string;
  programId: string | null;
  title: string;
  object: string;
  function: string;
  material: string;
  brand: string;
  price: number | null;
  currency: string;
  retailer: string;
  country: string;
  style: string;
  era: string;
  color: string;
  form: string;
  context: string;
  sustainability: string;
  designScore: number | null;
  typologyScore: number | null;
  affiliateValue: number | null;
  affiliateUrl: string;
  imageUrl: string | null;
  boardItemId: string | null;
};

export const PRODUCT_FIELDS = [
  ['object', 'Object'],
  ['function', 'Function'],
  ['material', 'Material'],
  ['brand', 'Brand'],
  ['retailer', 'Retailer'],
  ['country', 'Country'],
  ['style', 'Style'],
  ['era', 'Era'],
  ['color', 'Color'],
  ['form', 'Form'],
  ['context', 'Context'],
  ['sustainability', 'Sustainability'],
] as const;

export const SEED_PROGRAMS: AffiliateProgram[] = [
  { id: 'design-bestseller', slug: 'design-bestseller', name: 'design-bestseller', network: 'awin', commissionLabel: 'bis 10 %', rating: 5, status: 'live', awinAdvertiserId: null, clicks: 0, conversions: 0, commissionEur: 0, sortOrder: 1, featured: true },
  { id: 'nordic-nest', slug: 'nordic-nest', name: 'Nordic Nest', network: 'awin', commissionLabel: 'mind. 8 %', rating: 5, status: 'live', awinAdvertiserId: null, clicks: 0, conversions: 0, commissionEur: 0, sortOrder: 2, featured: true },
  { id: 'kitchentime', slug: 'kitchentime', name: 'KitchenTime', network: 'awin', commissionLabel: 'mind. 8 %', rating: 5, status: 'live', awinAdvertiserId: null, clicks: 0, conversions: 0, commissionEur: 0, sortOrder: 3, featured: true },
  { id: 'connox', slug: 'connox', name: 'Connox', network: 'awin', commissionLabel: '8 % ohne Gutschein / 4 % mit', rating: 5, status: 'live', awinAdvertiserId: null, clicks: 0, conversions: 0, commissionEur: 0, sortOrder: 4, featured: true },
  { id: 'westwing', slug: 'westwing', name: 'Westwing', network: 'awin', commissionLabel: 'verhandelbar', rating: 4, status: 'live', awinAdvertiserId: null, clicks: 0, conversions: 0, commissionEur: 0, sortOrder: 5, featured: true },
  { id: 'archiproducts', slug: 'archiproducts', name: 'Archiproducts', network: 'awin', commissionLabel: 'variabel', rating: 5, status: 'pending', awinAdvertiserId: null, clicks: 0, conversions: 0, commissionEur: 0, sortOrder: 6, featured: false },
  { id: 'designtorget', slug: 'designtorget', name: 'Designtorget', network: 'awin', commissionLabel: 'nicht öffentlich angegeben', rating: 5, status: 'pending', awinAdvertiserId: null, clicks: 0, conversions: 0, commissionEur: 0, sortOrder: 7, featured: true },
  { id: 'lanna-mobler', slug: 'lanna-mobler', name: 'Länna Möbler', network: 'awin', commissionLabel: 'nicht öffentlich angegeben', rating: 5, status: 'pending', awinAdvertiserId: null, clicks: 0, conversions: 0, commissionEur: 0, sortOrder: 8, featured: true },
  { id: 'svenssons', slug: 'svenssons', name: 'Svenssons', network: 'awin', commissionLabel: 'nicht öffentlich angegeben', rating: 5, status: 'live', awinAdvertiserId: null, clicks: 0, conversions: 0, commissionEur: 0, sortOrder: 9, featured: true },
  { id: 'ambientedirect', slug: 'ambientedirect', name: 'AmbienteDirect', network: 'awin', commissionLabel: 'ca. 8 %', rating: 4, status: 'live', awinAdvertiserId: null, clicks: 0, conversions: 0, commissionEur: 0, sortOrder: 10, featured: false },
  { id: 'hay', slug: 'hay', name: 'HAY', network: 'other', commissionLabel: 'ca. 2 %', rating: 5, status: 'pending', awinAdvertiserId: null, clicks: 0, conversions: 0, commissionEur: 0, sortOrder: 11, featured: false },
  { id: 'amazon', slug: 'amazon', name: 'Amazon', network: 'amazon', commissionLabel: 'kategorieabhängig', rating: 3, status: 'api', awinAdvertiserId: null, clicks: 0, conversions: 0, commissionEur: 0, sortOrder: 12, featured: false },
  { id: 'etsy', slug: 'etsy', name: 'Etsy', network: 'etsy', commissionLabel: 'variabel', rating: 4, status: 'api', awinAdvertiserId: null, clicks: 0, conversions: 0, commissionEur: 0, sortOrder: 13, featured: false },
  { id: 'galaxus', slug: 'galaxus', name: 'Galaxus', network: 'other', commissionLabel: 'variabel', rating: 4, status: 'pending', awinAdvertiserId: null, clicks: 0, conversions: 0, commissionEur: 0, sortOrder: 14, featured: false },
  { id: 'decathlon', slug: 'decathlon', name: 'Decathlon', network: 'other', commissionLabel: 'variabel', rating: 3, status: 'pending', awinAdvertiserId: null, clicks: 0, conversions: 0, commissionEur: 0, sortOrder: 15, featured: false },
  { id: 'ebay', slug: 'ebay', name: 'eBay', network: 'ebay', commissionLabel: 'variabel', rating: 3, status: 'api', awinAdvertiserId: null, clicks: 0, conversions: 0, commissionEur: 0, sortOrder: 16, featured: false },
  { id: 'mohd', slug: 'mohd', name: 'MOHD', network: 'awin', commissionLabel: 'variabel', rating: 4, status: 'live', awinAdvertiserId: null, clicks: 0, conversions: 0, commissionEur: 0, sortOrder: 17, featured: false },
  { id: 'fonq', slug: 'fonq', name: 'FonQ', network: 'awin', commissionLabel: 'variabel', rating: 4, status: 'pending', awinAdvertiserId: null, clicks: 0, conversions: 0, commissionEur: 0, sortOrder: 18, featured: false },
  { id: 'royaldesign', slug: 'royaldesign', name: 'RoyalDesign', network: 'awin', commissionLabel: 'variabel', rating: 4, status: 'pending', awinAdvertiserId: null, clicks: 0, conversions: 0, commissionEur: 0, sortOrder: 19, featured: false },
  { id: 'the-poster-club', slug: 'the-poster-club', name: 'The Poster Club', network: 'awin', commissionLabel: 'variabel', rating: 4, status: 'pending', awinAdvertiserId: null, clicks: 0, conversions: 0, commissionEur: 0, sortOrder: 20, featured: false },
];

const PROGRAMS_KEY = 'knoll-affiliate-programs';
const PRODUCTS_KEY = 'knoll-affiliate-products';

type ProgramRow = {
  id: string;
  slug: string;
  name: string;
  network: AffiliateNetwork;
  commission_label: string;
  rating: number;
  status: AffiliateStatus;
  awin_advertiser_id: string | null;
  clicks: number;
  conversions: number;
  commission_eur: number | string;
  sort_order: number;
  featured: boolean;
};

type ProductRow = {
  id: string;
  program_id: string | null;
  title: string;
  object: string;
  function: string;
  material: string;
  brand: string;
  price: number | string | null;
  currency: string;
  retailer: string;
  country: string;
  style: string;
  era: string;
  color: string;
  form: string;
  context: string;
  sustainability: string;
  design_score: number | string | null;
  typology_score: number | string | null;
  affiliate_value: number | string | null;
  affiliate_url: string;
  image_url: string | null;
  board_item_id: string | null;
};

function num(value: number | string | null | undefined): number {
  if (value == null || value === '') return 0;
  return typeof value === 'number' ? value : Number(value);
}

function numOrNull(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) ? next : null;
}

function rowToProgram(row: ProgramRow): AffiliateProgram {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    network: row.network,
    commissionLabel: row.commission_label,
    rating: row.rating,
    status: row.status,
    awinAdvertiserId: row.awin_advertiser_id,
    clicks: num(row.clicks),
    conversions: num(row.conversions),
    commissionEur: num(row.commission_eur),
    sortOrder: row.sort_order,
    featured: row.featured,
  };
}

function rowToProduct(row: ProductRow): AffiliateProduct {
  return {
    id: row.id,
    programId: row.program_id,
    title: row.title,
    object: row.object,
    function: row.function,
    material: row.material,
    brand: row.brand,
    price: numOrNull(row.price),
    currency: row.currency,
    retailer: row.retailer,
    country: row.country,
    style: row.style,
    era: row.era,
    color: row.color,
    form: row.form,
    context: row.context,
    sustainability: row.sustainability,
    designScore: numOrNull(row.design_score),
    typologyScore: numOrNull(row.typology_score),
    affiliateValue: numOrNull(row.affiliate_value),
    affiliateUrl: row.affiliate_url,
    imageUrl: row.image_url,
    boardItemId: row.board_item_id,
  };
}

function readLocalPrograms(): AffiliateProgram[] {
  try {
    const raw = localStorage.getItem(PROGRAMS_KEY);
    if (!raw) return SEED_PROGRAMS.map((row) => ({ ...row }));
    const parsed = JSON.parse(raw) as AffiliateProgram[];
    return Array.isArray(parsed) && parsed.length ? parsed : SEED_PROGRAMS.map((row) => ({ ...row }));
  } catch {
    return SEED_PROGRAMS.map((row) => ({ ...row }));
  }
}

function writeLocalPrograms(programs: AffiliateProgram[]) {
  localStorage.setItem(PROGRAMS_KEY, JSON.stringify(programs));
}

function readLocalProducts(): AffiliateProduct[] {
  try {
    const raw = localStorage.getItem(PRODUCTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AffiliateProduct[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalProducts(products: AffiliateProduct[]) {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
}

export function statusMark(status: AffiliateStatus): string {
  if (status === 'live') return '✅';
  if (status === 'api') return 'API';
  return '?';
}

export function starLabel(rating: number): string {
  const filled = Math.max(1, Math.min(5, Math.round(rating)));
  return `${'★'.repeat(filled)}${'☆'.repeat(5 - filled)}`;
}

export function earningsPerClick(program: AffiliateProgram): number {
  if (program.clicks <= 0) return 0;
  return program.commissionEur / program.clicks;
}

export function rankPrograms(programs: AffiliateProgram[]): AffiliateProgram[] {
  const hasLive = programs.some((row) => row.commissionEur > 0 || row.clicks > 0);
  return [...programs].sort((a, b) => {
    if (hasLive) {
      const earn = b.commissionEur - a.commissionEur;
      if (earn !== 0) return earn;
      const epc = earningsPerClick(b) - earningsPerClick(a);
      if (epc !== 0) return epc;
      const clicks = b.clicks - a.clicks;
      if (clicks !== 0) return clicks;
    }
    const rating = b.rating - a.rating;
    if (rating !== 0) return rating;
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });
}

export function emptyProduct(): Omit<AffiliateProduct, 'id'> {
  return {
    programId: null,
    title: '',
    object: '',
    function: '',
    material: '',
    brand: '',
    price: null,
    currency: 'EUR',
    retailer: '',
    country: '',
    style: '',
    era: '',
    color: '',
    form: '',
    context: '',
    sustainability: '',
    designScore: null,
    typologyScore: null,
    affiliateValue: null,
    affiliateUrl: '',
    imageUrl: null,
    boardItemId: null,
  };
}

export async function fetchAffiliatePrograms(): Promise<AffiliateProgram[]> {
  if (!hasSupabaseConfig()) return readLocalPrograms();
  const supabase = getSupabase();
  if (!supabase) return readLocalPrograms();
  const { data, error } = await supabase
    .from('affiliate_programs')
    .select(
      'id, slug, name, network, commission_label, rating, status, awin_advertiser_id, clicks, conversions, commission_eur, sort_order, featured',
    )
    .order('sort_order', { ascending: true });
  if (error) throw error;
  if (!data?.length) return SEED_PROGRAMS.map((row) => ({ ...row }));
  return (data as ProgramRow[]).map(rowToProgram);
}

export async function updateAffiliateProgram(
  program: AffiliateProgram,
  patch: Partial<Pick<AffiliateProgram, 'clicks' | 'conversions' | 'commissionEur' | 'awinAdvertiserId' | 'status'>>,
): Promise<AffiliateProgram> {
  const next = { ...program, ...patch };
  if (!hasSupabaseConfig()) {
    writeLocalPrograms(readLocalPrograms().map((row) => (row.id === program.id ? next : row)));
    return next;
  }
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('affiliate_programs')
    .update({
      clicks: next.clicks,
      conversions: next.conversions,
      commission_eur: next.commissionEur,
      awin_advertiser_id: next.awinAdvertiserId,
      status: next.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', program.id)
    .select(
      'id, slug, name, network, commission_label, rating, status, awin_advertiser_id, clicks, conversions, commission_eur, sort_order, featured',
    )
    .single();
  if (error) throw error;
  return rowToProgram(data as ProgramRow);
}

export async function fetchAffiliateProducts(): Promise<AffiliateProduct[]> {
  if (!hasSupabaseConfig()) return readLocalProducts();
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('affiliate_products')
    .select(
      'id, program_id, title, object, function, material, brand, price, currency, retailer, country, style, era, color, form, context, sustainability, design_score, typology_score, affiliate_value, affiliate_url, image_url, board_item_id',
    )
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ProductRow[]).map(rowToProduct);
}

function productWritePayload(input: Omit<AffiliateProduct, 'id'> | AffiliateProduct) {
  return {
    program_id: input.programId,
    title: input.title,
    object: input.object,
    function: input.function,
    material: input.material,
    brand: input.brand,
    price: input.price,
    currency: input.currency,
    retailer: input.retailer,
    country: input.country,
    style: input.style,
    era: input.era,
    color: input.color,
    form: input.form,
    context: input.context,
    sustainability: input.sustainability,
    design_score: input.designScore,
    typology_score: input.typologyScore,
    affiliate_value: input.affiliateValue,
    affiliate_url: input.affiliateUrl,
    image_url: input.imageUrl,
    board_item_id: input.boardItemId,
  };
}

export async function insertAffiliateProduct(input: Omit<AffiliateProduct, 'id'>): Promise<AffiliateProduct> {
  if (!hasSupabaseConfig()) {
    const created: AffiliateProduct = { ...input, id: crypto.randomUUID() };
    writeLocalProducts([created, ...readLocalProducts()]);
    return created;
  }
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('affiliate_products')
    .insert(productWritePayload(input))
    .select(
      'id, program_id, title, object, function, material, brand, price, currency, retailer, country, style, era, color, form, context, sustainability, design_score, typology_score, affiliate_value, affiliate_url, image_url, board_item_id',
    )
    .single();
  if (error) throw error;
  return rowToProduct(data as ProductRow);
}

export async function updateAffiliateProduct(product: AffiliateProduct): Promise<AffiliateProduct> {
  if (!hasSupabaseConfig()) {
    writeLocalProducts(readLocalProducts().map((row) => (row.id === product.id ? product : row)));
    return product;
  }
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('affiliate_products')
    .update({ ...productWritePayload(product), updated_at: new Date().toISOString() })
    .eq('id', product.id)
    .select(
      'id, program_id, title, object, function, material, brand, price, currency, retailer, country, style, era, color, form, context, sustainability, design_score, typology_score, affiliate_value, affiliate_url, image_url, board_item_id',
    )
    .single();
  if (error) throw error;
  return rowToProduct(data as ProductRow);
}

export async function deleteAffiliateProduct(product: AffiliateProduct): Promise<void> {
  if (!hasSupabaseConfig()) {
    writeLocalProducts(readLocalProducts().filter((row) => row.id !== product.id));
    return;
  }
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('affiliate_products').delete().eq('id', product.id);
  if (error) throw error;
}

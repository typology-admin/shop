import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SiteChrome } from '../components/SiteChrome.tsx';
import { useNetworkItems } from '../hooks/useNetworkItems.ts';
import { getSupabase } from '../lib/supabase.ts';

type BlockRow = {
  id: string;
  sort_order: number;
  block_type: string;
  payload: Record<string, unknown>;
};

type PageRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
};

function payloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' ? value : '';
}

function BlockView({ row }: { row: BlockRow }) {
  const payload = row.payload ?? {};
  switch (row.block_type) {
    case 'heading': {
      const text = payloadString(payload, 'text');
      return <h2>{text}</h2>;
    }
    case 'paragraph':
      return <p>{payloadString(payload, 'text')}</p>;
    case 'markdown':
      return <p>{payloadString(payload, 'markdown')}</p>;
    case 'image': {
      const src = payloadString(payload, 'src');
      if (!src) return null;
      return (
        <figure>
          <img src={src} alt={payloadString(payload, 'alt')} />
        </figure>
      );
    }
    case 'link': {
      const href = payloadString(payload, 'href');
      if (!href) return null;
      return (
        <p>
          <a href={href}>{payloadString(payload, 'label') || href}</a>
        </p>
      );
    }
    case 'divider':
      return <hr />;
    default:
      return payloadString(payload, 'text') ? <p>{payloadString(payload, 'text')}</p> : null;
  }
}

export function SiteContentPage({ slug }: { slug: string }) {
  const { items } = useNetworkItems();
  const [page, setPage] = useState<PageRow | null>(null);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = getSupabase();
      if (!supabase) {
        setError('This page is empty until Supabase is configured.');
        return;
      }
      const { data: pg, error: pageError } = await supabase
        .from('site_pages')
        .select('id, slug, title, summary')
        .eq('slug', slug)
        .maybeSingle();
      if (pageError || !pg) {
        if (!cancelled) setError(pageError?.message ?? 'Page not found.');
        return;
      }
      const { data: bl, error: blockError } = await supabase
        .from('page_content_blocks')
        .select('id, sort_order, block_type, payload')
        .eq('page_id', pg.id)
        .order('sort_order', { ascending: true });
      if (blockError) {
        if (!cancelled) setError(blockError.message);
        return;
      }
      if (!cancelled) {
        setPage(pg as PageRow);
        setBlocks((bl ?? []) as BlockRow[]);
        setError(null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="network-page">
      <SiteChrome variant="network" networkItems={items} />
      <main className="site-subpage">
        <div className="site-subpage-prose">
          <p>
            <Link to="/network">← typology.network</Link>
          </p>
          {error ? (
            <p className="form-error">{error}</p>
          ) : page ? (
            <>
              <h1>{page.title}</h1>
              {page.summary ? <p className="site-subpage-lead">{page.summary}</p> : null}
              {blocks.map((row) => (
                <BlockView key={row.id} row={row} />
              ))}
            </>
          ) : (
            <p>Loading…</p>
          )}
        </div>
      </main>
    </div>
  );
}

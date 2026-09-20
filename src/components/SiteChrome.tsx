import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MOBILE_BREAKPOINT } from '../../shared/constants.ts';
import { useAuth } from '../hooks/useAuth.ts';
import { useMediaQuery } from '../hooks/useMediaQuery.ts';
import { useSiteSettings } from '../hooks/useSiteSettings.ts';
import { openAffiliate } from '../lib/images.ts';
import {
  itemHref,
  visibleNetworkItems,
  visitNetworkItem,
  type NetworkItem,
} from '../lib/network.ts';
import { sectionForItem } from '../lib/knollLayout.ts';
import { mailtoHref } from '../lib/siteSettings.ts';
import { itemMatchesQuery } from '../lib/tags.ts';
import type { Item } from '../lib/types.ts';
import type { BoardSection } from '../lib/sections.ts';
import { HeaderChromePortal } from './HeaderChrome.tsx';

type Hit =
  | { kind: 'shop'; item: Item }
  | { kind: 'network'; item: NetworkItem };

type Props = {
  variant: 'shop' | 'network';
  shopItems?: Item[];
  networkItems?: NetworkItem[];
  sections?: BoardSection[];
  onShopItem?: (item: Item) => void;
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeWidth={2} d="M5 7h14M5 12h14M5 17h14" />
    </svg>
  );
}

export function SiteChrome({
  variant,
  shopItems = [],
  networkItems = [],
  sections = [],
  onShopItem,
}: Props) {
  const navigate = useNavigate();
  const auth = useAuth();
  const signedIn = Boolean(auth.session);
  const { settings } = useSiteSettings();
  const isMobile = useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT}px)`);
  const [searchOpen, setSearchOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!isMobile) setMenuOpen(false);
  }, [isMobile]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setAboutOpen(false);
        setMenuOpen(false);
      }
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if ((target as Element).closest?.('.admin-bar-extras')) return;
      setSearchOpen(false);
      setAboutOpen(false);
      setMenuOpen(false);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointer);
    };
  }, []);

  const catalog = useMemo(() => {
    return shopItems.map((item) => {
      const scene = sectionForItem(item, sections);
      const tags = item.tags ?? [];
      const hay = `${item.title} ${item.store} ${tags.join(' ')} ${scene?.name ?? ''}`;
      return { item, scene, tags, hay };
    });
  }, [shopItems, sections]);

  const tagIndex = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of catalog) {
      for (const tag of row.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
      if (row.scene?.name) {
        const name = row.scene.name.toLowerCase();
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag);
  }, [catalog]);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const next: Hit[] = [];
    for (const row of catalog) {
      if (itemMatchesQuery(row.hay, q)) next.push({ kind: 'shop', item: row.item });
    }
    for (const item of visibleNetworkItems(networkItems)) {
      const hay = `${item.prefix}${item.suffix} ${item.description}`;
      if (itemMatchesQuery(hay, q)) next.push({ kind: 'network', item });
    }
    return next.slice(0, 12);
  }, [query, catalog, networkItems]);

  const suggestedTags = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tagIndex.slice(0, 16);
    return tagIndex.filter((tag) => tag.includes(q) && tag !== q).slice(0, 12);
  }, [query, tagIndex]);

  const overlayOpen =
    (isMobile && menuOpen) ||
    (searchOpen && (hits.length > 0 || suggestedTags.length > 0));

  useEffect(() => {
    document.documentElement.classList.toggle('chrome-overlay-open', overlayOpen);
    return () => document.documentElement.classList.remove('chrome-overlay-open');
  }, [overlayOpen]);

  function pick(hit: Hit) {
    setSearchOpen(false);
    setMenuOpen(false);
    setQuery('');
    if (hit.kind === 'shop') {
      if (onShopItem) onShopItem(hit.item);
      else openAffiliate(hit.item.affiliate_url);
    } else visitNetworkItem(hit.item, navigate);
  }

  const searchControl = searchOpen ? (
    <div className="chrome-search">
      <label className="chrome-search-field">
        <SearchIcon />
        <span className="sr-only">Search</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={variant === 'shop' ? 'Search tags, objects…' : 'Search network…'}
        />
      </label>
      {searchOpen && (suggestedTags.length > 0 || hits.length > 0) ? (
        <div className="chrome-search-results" role="listbox">
          {suggestedTags.length > 0 ? (
            <div className="chrome-search-tags">
              {suggestedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="chrome-search-tag"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setQuery(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          ) : null}
          {hits.length > 0 ? (
          <div className="chrome-search-results-scroll">
            {hits.map((hit) =>
              hit.kind === 'shop' ? (
                <button
                  key={`shop-${hit.item.id}`}
                  type="button"
                  className="chrome-search-hit"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(hit)}
                >
                  <strong>{hit.item.title || 'Untitled'}</strong>
                  <span>
                    {(hit.item.tags ?? []).length
                      ? hit.item.tags.join(' · ')
                      : hit.item.store || 'shop'}
                  </span>
                </button>
              ) : (
                <button
                  key={`net-${hit.item.id}`}
                  type="button"
                  className="chrome-search-hit"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(hit)}
                >
                  <strong>
                    {hit.item.prefix}
                    <span>{hit.item.suffix}</span>
                  </strong>
                  <span>{itemHref(hit.item).replace(/^https?:\/\//, '')}</span>
                </button>
              ),
            )}
          </div>
          ) : null}
        </div>
      ) : null}
    </div>
  ) : (
    <button
      type="button"
      className="chrome-search-toggle"
      aria-label="Search"
      onClick={() => {
        setAboutOpen(false);
        setSearchOpen(true);
      }}
    >
      <SearchIcon />
    </button>
  );

  const aboutControl = (
    <div className="chrome-contact">
      <button
        type="button"
        className={`chrome-pill${aboutOpen ? ' is-open' : ''}`}
        aria-expanded={aboutOpen}
        aria-haspopup="dialog"
        onClick={() => {
          setSearchOpen(false);
          setAboutOpen((open) => !open);
        }}
      >
        about
      </button>
      {aboutOpen ? (
        <div className="chrome-about-menu" role="dialog" aria-label="About">
          {settings.aboutText
            .replace(/\r\n/g, '\n')
            .split(/\n{2,}/)
            .map((block) => block.trim())
            .filter(Boolean)
            .map((block, index) => (
              <p key={index}>{block}</p>
            ))}
          <a
            className="chrome-pill chrome-about-mail"
            href={mailtoHref(settings.contactEmail)}
            onClick={() => setAboutOpen(false)}
          >
            contact
          </a>
          <p className="chrome-about-legal">
            © {new Date().getFullYear()} typology.network®. Images link to their sources; we don’t
            claim ownership.{' '}
            <Link to="/terms" onClick={() => setAboutOpen(false)}>
              terms
            </Link>
            {' · '}
            <Link to="/privacy" onClick={() => setAboutOpen(false)}>
              privacy
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className={`site-chrome${signedIn ? ' is-docked' : ''}`} ref={wrapRef}>
      {signedIn ? (
        <HeaderChromePortal>
          {searchControl}
          {aboutControl}
        </HeaderChromePortal>
      ) : null}
      {isMobile && !signedIn ? (
        <button
          type="button"
          className={`chrome-search-toggle chrome-menu-toggle${menuOpen ? ' is-open' : ''}`}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => {
            setMenuOpen((open) => !open);
            setSearchOpen(false);
            setAboutOpen(false);
          }}
        >
          <MenuIcon />
        </button>
      ) : null}

      {signedIn ? null : (
        <div className={`chrome-actions${isMobile && menuOpen ? ' is-open' : ''}`}>
          {searchControl}
          {variant === 'network' ? (
            <Link className="chrome-pill" to="/">
              home
            </Link>
          ) : null}
          {aboutControl}
          {!auth.isLocal ? (
            <Link className="chrome-pill" to="/login">
              sign in
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}

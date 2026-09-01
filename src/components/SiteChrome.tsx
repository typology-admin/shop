import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MOBILE_BREAKPOINT } from '../../shared/constants.ts';
import { useMediaQuery } from '../hooks/useMediaQuery.ts';
import { useSiteSettings } from '../hooks/useSiteSettings.ts';
import { openAffiliate } from '../lib/images.ts';
import {
  itemHref,
  visibleNetworkItems,
  visitNetworkItem,
  type NetworkItem,
} from '../lib/network.ts';
import { mailtoHref } from '../lib/siteSettings.ts';
import type { Item } from '../lib/types.ts';

type Hit =
  | { kind: 'shop'; item: Item }
  | { kind: 'network'; item: NetworkItem };

type Props = {
  variant: 'shop' | 'network';
  shopItems?: Item[];
  networkItems?: NetworkItem[];
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
  onShopItem,
}: Props) {
  const navigate = useNavigate();
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
      if (!wrapRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
        setAboutOpen(false);
        setMenuOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointer);
    };
  }, []);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const next: Hit[] = [];
    for (const item of shopItems) {
      const hay = `${item.title} ${item.store}`.toLowerCase();
      if (hay.includes(q)) next.push({ kind: 'shop', item });
    }
    for (const item of visibleNetworkItems(networkItems)) {
      const hay = `${item.prefix}${item.suffix} ${item.description}`.toLowerCase();
      if (hay.includes(q)) next.push({ kind: 'network', item });
    }
    return next.slice(0, 12);
  }, [query, shopItems, networkItems]);

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
          placeholder={variant === 'shop' ? 'Search shop & network…' : 'Search network…'}
        />
      </label>
      {query.trim() && hits.length > 0 ? (
        <div className="chrome-search-results" role="listbox">
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
                <span>{hit.item.store || 'shop'}</span>
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
          <p>{settings.aboutText}</p>
          <a
            className="chrome-pill chrome-about-mail"
            href={mailtoHref(settings.contactEmail)}
            onClick={() => setAboutOpen(false)}
          >
            contact
          </a>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="site-chrome" ref={wrapRef}>
      {isMobile ? (
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

      <div className={`chrome-actions${isMobile && menuOpen ? ' is-open' : ''}`}>
        {searchControl}
        {variant === 'network' ? (
          <Link className="chrome-pill" to="/">
            shop
          </Link>
        ) : null}
        {aboutControl}
      </div>
    </div>
  );
}

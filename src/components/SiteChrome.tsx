import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useContactLinks } from '../hooks/useContactLinks.ts';
import { openContactHref } from '../lib/contact.ts';
import { openAffiliate } from '../lib/images.ts';
import {
  itemHref,
  visibleNetworkItems,
  visitNetworkItem,
  type NetworkItem,
} from '../lib/network.ts';
import type { Item } from '../lib/types.ts';

type Hit =
  | { kind: 'shop'; item: Item }
  | { kind: 'network'; item: NetworkItem };

type Props = {
  variant: 'shop' | 'network';
  shopItems?: Item[];
  networkItems?: NetworkItem[];
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

export function SiteChrome({ variant, shopItems = [], networkItems = [] }: Props) {
  const navigate = useNavigate();
  const { links } = useContactLinks();
  const [searchOpen, setSearchOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setContactOpen(false);
      }
    }
    function onPointer(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
        setContactOpen(false);
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
    setQuery('');
    if (hit.kind === 'shop') openAffiliate(hit.item.affiliate_url);
    else visitNetworkItem(hit.item, navigate);
  }

  return (
    <div className="site-chrome" ref={wrapRef}>
      {searchOpen ? (
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
            setContactOpen(false);
            setSearchOpen(true);
          }}
        >
          <SearchIcon />
        </button>
      )}

      {variant === 'shop' ? (
        <Link className="chrome-pill" to="/network">
          network
        </Link>
      ) : (
        <Link className="chrome-pill" to="/">
          shop
        </Link>
      )}

      <div className="chrome-contact">
        <button
          type="button"
          className={`chrome-pill${contactOpen ? ' is-open' : ''}`}
          aria-expanded={contactOpen}
          aria-haspopup="menu"
          onClick={() => {
            setSearchOpen(false);
            setContactOpen((open) => !open);
          }}
        >
          contact
        </button>
        {contactOpen ? (
          <div className="chrome-contact-menu" role="menu">
            {links.map((link) => (
              <button
                key={link.id}
                type="button"
                role="menuitem"
                className="chrome-search-hit"
                onClick={() => {
                  setContactOpen(false);
                  openContactHref(link.href, navigate);
                }}
              >
                <strong>{link.label}</strong>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { openAffiliate, resolveImageUrl } from '../lib/images.ts';
import { copyItemLink, exportInstagramPostPng } from '../lib/itemShare.ts';
import type { Item } from '../lib/types.ts';

type Props = {
  item: Item;
  onClose: () => void;
};

export function ItemModal({ item, onClose }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void resolveImageUrl(item.image_path).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [item.image_path]);

  useEffect(() => {
    setShareOpen(false);
    setCopied(false);
    setShareError(null);
  }, [item.id]);

  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = 'hidden';
    html.classList.add('item-modal-open');

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      html.style.overflow = previous;
      html.classList.remove('item-modal-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  async function onCopy() {
    setShareError(null);
    try {
      await copyItemLink(item.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setShareError('Could not copy the link.');
    }
  }

  async function onExport() {
    setShareError(null);
    setExporting(true);
    try {
      await exportInstagramPostPng(item);
      setShareOpen(false);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Could not export PNG.');
    } finally {
      setExporting(false);
    }
  }

  const title = item.title.trim();
  const store = item.store.trim();

  return createPortal(
    <div
      className="item-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="item-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Object'}
      >
        <button type="button" className="item-modal-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <div className="item-modal-stage">
          {src ? (
            <img
              src={src}
              alt={title || ''}
              draggable={false}
            />
          ) : (
            <div className="item-modal-missing">no image</div>
          )}
        </div>
        <hr className="item-modal-rule" />
        <div className="item-modal-body">
          {title || store ? (
            <div className="item-modal-copy">
              {title ? <p>{title}</p> : null}
              {store ? <span>{store}</span> : null}
            </div>
          ) : null}
          {shareError ? <p className="item-modal-error">{shareError}</p> : null}
          <div className="item-modal-actions">
            {item.affiliate_url ? (
              <button
                type="button"
                className="chrome-pill item-modal-buy"
                onClick={() => openAffiliate(item.affiliate_url)}
              >
                buy
              </button>
            ) : null}
            <div className="item-modal-share">
              <button
                type="button"
                className={`chrome-pill${shareOpen ? ' is-open' : ''}`}
                aria-expanded={shareOpen}
                onClick={() => setShareOpen((open) => !open)}
              >
                share
              </button>
              {shareOpen ? (
                <div className="item-modal-share-menu" role="menu">
                  <button type="button" role="menuitem" className="chrome-search-hit" onClick={() => void onCopy()}>
                    <strong>{copied ? 'copied' : 'copy link'}</strong>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="chrome-search-hit"
                    disabled={exporting}
                    onClick={() => void onExport()}
                  >
                    <strong>{exporting ? 'exporting…' : 'export png'}</strong>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

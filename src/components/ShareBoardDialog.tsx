import { useEffect, useState } from 'react';
import type { BoardVisibility, UserBoard } from '../lib/userBoards.ts';

type Props = {
  board: UserBoard;
  username: string;
  onClose: () => void;
  onVisibility: (visibility: BoardVisibility) => Promise<void>;
  onFlags: (patch: { wishlist_enabled?: boolean; suggestions_enabled?: boolean }) => Promise<void>;
  onRotate: () => Promise<string>;
};

export function ShareBoardDialog({ board, username, onClose, onVisibility, onFlags, onRotate }: Props) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.add('account-modal-open');
    return () => document.documentElement.classList.remove('account-modal-open');
  }, []);

  const publicUrl = `${window.location.origin}/u/${username}/${board.slug}`;
  const unlistedUrl = board.share_token ? `${window.location.origin}/s/${board.share_token}` : '';
  const link = board.visibility === 'unlisted' ? unlistedUrl : publicUrl;

  async function copy() {
    const text = board.visibility === 'private' ? '' : link;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function setVisibility(visibility: BoardVisibility) {
    setBusy(true);
    setError(null);
    try {
      await onVisibility(visibility);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update sharing.');
    } finally {
      setBusy(false);
    }
  }

  async function rotate() {
    setBusy(true);
    setError(null);
    try {
      const token = await onRotate();
      await navigator.clipboard.writeText(`${window.location.origin}/s/${token}`);
      setCopied(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rotate the link.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="account-modal-backdrop" onClick={onClose}>
      <div className="account-modal" role="dialog" aria-label="Share" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="account-modal-close" aria-label="Close" onClick={onClose}>
          <IconClose />
        </button>
        <h2>Share</h2>
        <p className="lede">{board.title}</p>
        <div className="btn-row">
          {(['private', 'unlisted', 'public'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`btn ${board.visibility === value ? '' : 'btn-ghost'}`}
              disabled={busy}
              onClick={() => void setVisibility(value)}
            >
              {value}
            </button>
          ))}
        </div>
        {board.visibility === 'private' ? (
          <p className="hint">Only you can open this board.</p>
        ) : (
          <p className="lede">
            {link}
          </p>
        )}
        <div className="btn-row">
          {board.visibility !== 'private' ? (
            <button type="button" className="btn" onClick={() => void copy()}>
              {copied ? 'Copied' : 'Copy link'}
            </button>
          ) : null}
          {board.visibility === 'unlisted' ? (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void rotate()}>
              Rotate link
            </button>
          ) : null}
        </div>
        <label className="field field-check">
          <input
            type="checkbox"
            checked={board.wishlist_enabled}
            onChange={(event) => void onFlags({ wishlist_enabled: event.target.checked })}
          />
          <span>Wishlist claims</span>
        </label>
        <label className="field field-check">
          <input
            type="checkbox"
            checked={board.suggestions_enabled}
            onChange={(event) => void onFlags({ suggestions_enabled: event.target.checked })}
          />
          <span>Gift suggestions</span>
        </label>
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </div>
  );
}

function IconClose() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3 3l8 8M11 3 3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

import { useState } from 'react';
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
        <p className="auth-kicker">Share</p>
        <h2 className="wordmark-ui" style={{ fontSize: 28, margin: '0 0 16px' }}>
          {board.title}
        </h2>
        <div className="btn-row" style={{ marginBottom: 16 }}>
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
          <p className="lede" style={{ marginBottom: 12 }}>
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
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <label className="field">
          <span>
            <input
              type="checkbox"
              checked={board.wishlist_enabled}
              onChange={(event) => void onFlags({ wishlist_enabled: event.target.checked })}
            />{' '}
            Wishlist claims
          </span>
        </label>
        <label className="field">
          <span>
            <input
              type="checkbox"
              checked={board.suggestions_enabled}
              onChange={(event) => void onFlags({ suggestions_enabled: event.target.checked })}
            />{' '}
            Gift suggestions
          </span>
        </label>
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </div>
  );
}

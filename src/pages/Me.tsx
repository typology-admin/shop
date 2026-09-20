import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreateBoardDialog } from '../components/CreateBoardDialog.tsx';
import { ShareBoardDialog } from '../components/ShareBoardDialog.tsx';
import { useAuth } from '../hooks/useAuth.ts';
import { usernameError } from '../lib/profile.ts';
import {
  createBoard,
  deleteBoard,
  listOwnBoards,
  listSuggestions,
  resolveSuggestion,
  rotateShareToken,
  updateBoard,
  type BoardVisibility,
  type UserBoard,
  type UserBoardSuggestion,
} from '../lib/userBoards.ts';

function IconShare() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="12" cy="4" r="1.6" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="4" cy="8" r="1.6" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M5.5 7.2 10.5 4.8M5.5 8.8l5 2.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M11.5 2.5a1.4 1.4 0 0 1 2 2L5.2 12.8 2 13.5l.7-3.2L11.5 2.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 4.5h9M6 4.5V3h4v1.5M5.5 4.5l.5 8h4l.5-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Me() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [boards, setBoards] = useState<UserBoard[]>([]);
  const [inbox, setInbox] = useState<UserBoardSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [shareBoard, setShareBoard] = useState<UserBoard | null>(null);

  const handle = auth.profile?.username;

  useEffect(() => {
    document.title = 'your boards — typology network';
  }, []);

  useEffect(() => {
    if (!auth.user) return;
    void listOwnBoards(auth.user.id)
      .then(setBoards)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load boards.'));
  }, [auth.user]);

  useEffect(() => {
    if (boards.length === 0) {
      setInbox([]);
      return;
    }
    void Promise.all(boards.map((board) => listSuggestions(board.id).catch(() => []))).then((rows) => {
      setInbox(rows.flat());
    });
  }, [boards]);

  async function onClaim(event: FormEvent) {
    event.preventDefault();
    const invalid = usernameError(username);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await auth.claimUsername(username);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the username.');
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(title: string) {
    if (!auth.user) return;
    setBusy(true);
    setCreateError(null);
    try {
      const board = await createBoard(auth.user.id, { title });
      setBoards((list) => [board, ...list]);
      setCreateOpen(false);
      if (handle) navigate(`/u/${handle}/${board.slug}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create the board.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleVisibility(board: UserBoard) {
    const visibility: BoardVisibility = board.visibility === 'public' ? 'private' : 'public';
    setError(null);
    try {
      const next = await updateBoard(board.id, { visibility });
      setBoards((list) => list.map((row) => (row.id === board.id ? next : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update visibility.');
    }
  }

  return (
    <main className="account-page">
      <div className="account-wrap">
        {!handle ? (
          <form className="account-form" onSubmit={(event) => void onClaim(event)}>
            <p className="lede">Pick a username. It becomes your public URL.</p>
            <label className="field">
              <span>Username</span>
              <input
                value={username}
                autoComplete="username"
                spellCheck={false}
                onChange={(event) => setUsername(event.target.value.toLowerCase())}
                placeholder="your_name"
                minLength={3}
                maxLength={24}
                required
              />
            </label>
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save username'}
            </button>
          </form>
        ) : null}

        <section className="account-boards">
          <div className="account-section-head">
            <h2>Boards</h2>
            {handle ? (
              <button type="button" className="btn" onClick={() => setCreateOpen(true)}>
                Create board
              </button>
            ) : null}
          </div>
          {!handle ? <p className="hint">Save a username first.</p> : null}
          <ul className="account-board-list">
            {boards.map((board) => (
              <li key={board.id} className="account-board-tile">
                <span className="account-board-thumb" aria-hidden="true">
                  {board.thumbnail_emoji || '▢'}
                </span>
                <div className="account-board-tile-main">
                  {handle ? (
                    <Link className="account-board-title" to={`/u/${handle}/${board.slug}`}>
                      {board.title}
                    </Link>
                  ) : (
                    <span className="account-board-title">{board.title}</span>
                  )}
                  <button
                    type="button"
                    className={`account-board-visibility is-${board.visibility === 'public' ? 'public' : 'private'}`}
                    onClick={() => void toggleVisibility(board)}
                    aria-pressed={board.visibility === 'public'}
                    title={board.visibility === 'public' ? 'Public — click for private' : 'Private — click for public'}
                  >
                    {board.visibility === 'public' ? 'public' : 'private'}
                  </button>
                </div>
                <div className="account-board-actions">
                  {handle ? (
                    <button
                      type="button"
                      className="account-board-icon-btn"
                      aria-label={`Share ${board.title}`}
                      title="Share"
                      onClick={() => setShareBoard(board)}
                    >
                      <IconShare />
                    </button>
                  ) : null}
                  {handle ? (
                    <Link
                      className="account-board-icon-btn"
                      to={`/u/${handle}/${board.slug}`}
                      aria-label={`Edit ${board.title}`}
                      title="Edit"
                    >
                      <IconEdit />
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="account-board-icon-btn is-danger"
                    aria-label={`Delete ${board.title}`}
                    title="Delete"
                    onClick={() => {
                      if (!window.confirm(`Delete “${board.title}”? This cannot be undone.`)) return;
                      void deleteBoard(board.id).then(() => {
                        setBoards((list) => list.filter((row) => row.id !== board.id));
                      });
                    }}
                  >
                    <IconTrash />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {inbox.length > 0 ? (
          <section className="account-boards">
            <h2>Gift inbox</h2>
            <ul className="account-board-list">
              {inbox.map((row) => (
                <li key={row.id}>
                  <span>
                    {row.title || row.note} {row.suggested_by ? `— ${row.suggested_by}` : ''}
                  </span>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => {
                      void resolveSuggestion(row, 'approved').then(() => {
                        setInbox((list) => list.filter((item) => item.id !== row.id));
                      });
                    }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => {
                      void resolveSuggestion(row, 'rejected').then(() => {
                        setInbox((list) => list.filter((item) => item.id !== row.id));
                      });
                    }}
                  >
                    Reject
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {error ? <p className="form-error">{error}</p> : null}
      </div>

      <CreateBoardDialog
        open={createOpen}
        busy={busy}
        error={createError}
        onClose={() => {
          setCreateOpen(false);
          setCreateError(null);
        }}
        onSubmit={onCreate}
      />
      {shareBoard && handle ? (
        <ShareBoardDialog
          board={shareBoard}
          username={handle}
          onClose={() => setShareBoard(null)}
          onVisibility={async (visibility: BoardVisibility) => {
            const next = await updateBoard(shareBoard.id, { visibility });
            setBoards((list) => list.map((row) => (row.id === next.id ? next : row)));
            setShareBoard(next);
          }}
          onFlags={async (patch) => {
            const next = await updateBoard(shareBoard.id, patch);
            setBoards((list) => list.map((row) => (row.id === next.id ? next : row)));
            setShareBoard(next);
          }}
          onRotate={async () => {
            const nextToken = await rotateShareToken(shareBoard.id);
            const next = { ...shareBoard, visibility: 'unlisted' as const, share_token: nextToken };
            setBoards((list) => list.map((row) => (row.id === next.id ? next : row)));
            setShareBoard(next);
            return nextToken;
          }}
        />
      ) : null}
    </main>
  );
}

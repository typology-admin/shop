import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';
import { usernameError } from '../lib/profile.ts';
import {
  createBoard,
  deleteAccount,
  deleteBoard,
  listOwnBoards,
  listSuggestions,
  resolveSuggestion,
  type UserBoard,
  type UserBoardSuggestion,
} from '../lib/userBoards.ts';

export function Me() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [title, setTitle] = useState('');
  const [boards, setBoards] = useState<UserBoard[]>([]);
  const [inbox, setInbox] = useState<UserBoardSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!auth.user) return;
    setBusy(true);
    setError(null);
    try {
      const board = await createBoard(auth.user.id, { title });
      setBoards((list) => [board, ...list]);
      setTitle('');
      if (handle) navigate(`/u/${handle}/${board.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the board.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="account-page">
      <header className="account-bar">
        <Link className="account-bar-brand" to="/">
          typology network
        </Link>
        <div className="account-bar-actions">
          <span className="account-bar-meta">{auth.email}</span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              void auth.signOut().then(() => navigate('/login'));
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="account-wrap">
        <p className="auth-kicker">You</p>
        <h1 className="wordmark wordmark-ui">your boards</h1>

        {handle ? (
          <p className="lede">
            Public page: <Link to={`/u/${handle}`}>/u/{handle}</Link>
          </p>
        ) : (
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
        )}

        <section className="account-boards">
          <h2>Boards</h2>
          {handle ? (
            <form className="account-form" onSubmit={(event) => void onCreate(event)}>
              <label className="field">
                <span>New board</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Kitchen, gifts, desk…"
                  required
                />
              </label>
              <button className="btn" type="submit" disabled={busy}>
                Create board
              </button>
            </form>
          ) : (
            <p className="hint">Save a username first.</p>
          )}
          <ul className="account-board-list">
            {boards.map((board) => (
              <li key={board.id}>
                {handle ? (
                  <Link to={`/u/${handle}/${board.slug}`}>{board.title}</Link>
                ) : (
                  <span>{board.title}</span>
                )}
                <span className="account-bar-meta">{board.visibility}</span>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => {
                    void deleteBoard(board.id).then(() => {
                      setBoards((list) => list.filter((row) => row.id !== board.id));
                    });
                  }}
                >
                  Delete
                </button>
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

        <section className="account-boards">
          <h2>Account</h2>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              if (!window.confirm('Delete your account and boards? This cannot be undone.')) return;
              void deleteAccount()
                .then(() => navigate('/login'))
                .catch((err) => setError(err instanceof Error ? err.message : 'Could not delete the account.'));
            }}
          >
            Delete account
          </button>
        </section>
      </div>
    </main>
  );
}

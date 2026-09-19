import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';
import { usernameError } from '../lib/profile.ts';

export function Me() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'your boards — typology network';
  }, []);

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

  const handle = auth.profile?.username;

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
            Public page:{' '}
            <Link to={`/u/${handle}`}>/u/{handle}</Link>
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
            {error ? <p className="form-error">{error}</p> : null}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save username'}
            </button>
          </form>
        )}

        <section className="account-boards">
          <h2>Boards</h2>
          <p className="hint" style={{ margin: 0 }}>
            Boards connect to the canvas in the next step. Nothing is stored here yet.
          </p>
        </section>
      </div>
    </main>
  );
}

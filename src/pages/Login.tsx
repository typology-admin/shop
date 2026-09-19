import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';

export function Login() {
  const auth = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const dest = from && from !== '/login' && !from.startsWith('/admin') ? from : '/me';
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'magic' | 'google' | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    document.title = 'sign in — typology network';
  }, []);

  if (auth.ready && auth.session) {
    return <Navigate to={dest} replace />;
  }

  async function onMagicLink(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy('magic');
    try {
      await auth.signInWithMagicLink(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the link.');
    } finally {
      setBusy(null);
    }
  }

  async function onGoogle() {
    setError(null);
    setBusy('google');
    try {
      await auth.signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
      setBusy(null);
    }
  }

  return (
    <main className="auth-screen">
      <form className="auth-panel" onSubmit={(event) => void onMagicLink(event)}>
        <p className="auth-kicker">Account</p>
        <h1 className="wordmark wordmark-ui" style={{ fontSize: 42 }}>
          typology network
        </h1>
        <p className="hint" style={{ margin: '0 0 20px' }}>
          Sign in to keep your boards. A magic link or Google both work.
        </p>

        {!auth.ready ? (
          <p className="hint">Signing you in…</p>
        ) : auth.isLocal ? (
          <p className="hint">
            Local demo mode has no user accounts. Add Supabase credentials, then enable Email
            magic links and Google in the Auth providers dashboard.
          </p>
        ) : sent ? (
          <p className="form-ok">Check your email for a sign-in link.</p>
        ) : (
          <>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="btn" type="submit" disabled={busy !== null}>
              {busy === 'magic' ? 'Sending…' : 'Email me a link'}
            </button>
            <p className="auth-split">or</p>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={busy !== null}
              onClick={() => void onGoogle()}
            >
              {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
            </button>
          </>
        )}

        <p className="hint">
          <Link to="/">Back to the shop</Link>
          {' · '}
          <Link to="/admin/login">Admin</Link>
        </p>
      </form>
    </main>
  );
}

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
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    document.title = 'sign in — typology network';
  }, []);

  if (auth.ready && auth.session) {
    return <Navigate to={dest} replace />;
  }

  function requireTerms(): boolean {
    if (acceptedTerms) return true;
    setError('Please confirm you have read and agree to the Terms and Privacy Policy.');
    return false;
  }

  async function onMagicLink(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!requireTerms()) return;
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
    if (!requireTerms()) return;
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
            <label className="check-field">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
              />
              <span>
                I have read and agree to the{' '}
                <Link to="/terms" target="_blank" rel="noreferrer">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" target="_blank" rel="noreferrer">
                  Privacy Policy
                </Link>
                , including the ban on weapons, violence, sexual, drug, and other NSFW content.
              </span>
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="btn" type="submit" disabled={busy !== null || !acceptedTerms}>
              {busy === 'magic' ? 'Sending…' : 'Email me a link'}
            </button>
            <p className="auth-split">or</p>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={busy !== null || !acceptedTerms}
              onClick={() => void onGoogle()}
            >
              {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
            </button>
          </>
        )}

        <p className="hint">
          <Link to="/">Back to the shop</Link>
        </p>
      </form>
    </main>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';

function GoogleLogo() {
  return (
    <svg className="oauth-logo" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function FacebookLogo() {
  return (
    <svg className="oauth-logo" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.79-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.26h3.32l-.53 3.49h-2.79V24C19.62 23.09 24 18.1 24 12.07z"
      />
    </svg>
  );
}

export function Login() {
  const auth = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const dest = from && from !== '/login' && !from.startsWith('/admin') ? from : '/me';
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'magic' | 'google' | 'facebook' | null>(null);
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

  async function onFacebook() {
    setError(null);
    if (!requireTerms()) return;
    setBusy('facebook');
    try {
      await auth.signInWithFacebook();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Facebook sign-in failed.');
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
          Sign in to keep your boards. Email, Google, or Facebook all work.
        </p>

        {!auth.ready ? (
          <p className="hint">Signing you in…</p>
        ) : auth.isLocal ? (
          <p className="hint">
            Local demo mode has no user accounts. Add Supabase credentials, then enable Email
            magic links, Google, and Facebook in the Auth providers dashboard.
          </p>
        ) : sent ? (
          <p className="form-ok">Check your email for a sign-in link.</p>
        ) : (
          <>
            <div className="oauth-row">
              <button
                className="btn btn-ghost oauth-btn"
                type="button"
                disabled={busy !== null || !acceptedTerms}
                onClick={() => void onGoogle()}
              >
                <GoogleLogo />
                {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
              </button>
              <button
                className="btn btn-ghost oauth-btn"
                type="button"
                disabled={busy !== null || !acceptedTerms}
                onClick={() => void onFacebook()}
              >
                <FacebookLogo />
                {busy === 'facebook' ? 'Opening Facebook…' : 'Continue with Facebook'}
              </button>
            </div>
            <p className="auth-split">or</p>
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
            <button className="btn" type="submit" disabled={busy !== null || !acceptedTerms}>
              {busy === 'magic' ? 'Sending…' : 'Email me a link'}
            </button>
            <label className="check-field">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
              />
              <span>
                I confirm I am at least 13 years old and have read and agree to the{' '}
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
          </>
        )}

        <div className="auth-back-row">
          <Link className="btn btn-ghost auth-back" to="/">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M8.5 2.5 4 7l4.5 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            back
          </Link>
        </div>
      </form>
    </main>
  );
}

import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';

export function AdminLogin() {
  const auth = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/admin';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (auth.ready && auth.admin) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await auth.signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <form className="auth-panel" onSubmit={(event) => void onSubmit(event)}>
        <p className="auth-kicker">Admin</p>
        <h1 className="wordmark">Knoll</h1>
        {auth.isLocal ? (
          <p className="hint">
            Local demo mode — any email and password will open the board. Add Supabase
            credentials to use a real admin account.
          </p>
        ) : null}

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
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required={!auth.isLocal}
            minLength={auth.isLocal ? 0 : 6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Entering…' : 'Enter'}
        </button>
      </form>
    </main>
  );
}

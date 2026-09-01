import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';

export function AdminLogin() {
  const auth = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/admin';
  const [tab, setTab] = useState<'shop' | 'network' | 'contact' | 'affiliates'>(() => {
    if (from.startsWith('/admin/network')) return 'network';
    if (from.startsWith('/admin/contact')) return 'contact';
    if (from.startsWith('/admin/affiliates')) return 'affiliates';
    return 'shop';
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (auth.ready && auth.admin) {
    const shopDest =
      from.startsWith('/admin') &&
      from !== '/admin/login' &&
      !from.startsWith('/admin/network') &&
      !from.startsWith('/admin/contact') &&
      !from.startsWith('/admin/affiliates')
        ? from
        : '/admin';
    const dest =
      tab === 'network'
        ? '/admin/network'
        : tab === 'contact'
          ? '/admin/contact'
          : tab === 'affiliates'
            ? '/admin/affiliates'
            : shopDest;
    return <Navigate to={dest} replace />;
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
        <h1 className="wordmark wordmark-ui" style={{ fontSize: 42 }}>
          typology network
        </h1>
        <div className="admin-tabs" style={{ margin: '0 0 24px' }}>
          <button
            type="button"
            className={tab === 'shop' ? 'is-active' : undefined}
            onClick={() => setTab('shop')}
          >
            Shop
          </button>
          <button
            type="button"
            className={tab === 'network' ? 'is-active' : undefined}
            onClick={() => setTab('network')}
          >
            Network
          </button>
          <button
            type="button"
            className={tab === 'contact' ? 'is-active' : undefined}
            onClick={() => setTab('contact')}
          >
            Contact
          </button>
          <button
            type="button"
            className={tab === 'affiliates' ? 'is-active' : undefined}
            onClick={() => setTab('affiliates')}
          >
            Affiliates
          </button>
        </div>
        <p className="hint" style={{ margin: '0 0 20px' }}>
          {tab === 'shop'
            ? 'Sign in to lay out the shop board.'
            : tab === 'network'
              ? 'Sign in to edit the typology.network landing page.'
              : tab === 'affiliates'
                ? 'Sign in to manage AWIN programs and the product catalog.'
                : 'Sign in to edit the contact popup.'}
        </p>
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

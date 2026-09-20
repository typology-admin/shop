import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';
import { authRedirectUrl, updateDisplayName } from '../lib/profile.ts';
import { getSupabase } from '../lib/supabase.ts';
import { deleteAccount } from '../lib/userBoards.ts';

export function AccountSettings() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(auth.profile?.display_name ?? '');
  const [email, setEmail] = useState(auth.email ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'account settings — typology network';
  }, []);

  useEffect(() => {
    setDisplayName(auth.profile?.display_name ?? '');
    setEmail(auth.email ?? '');
  }, [auth.profile?.display_name, auth.email]);

  async function saveDisplayName(event: FormEvent) {
    event.preventDefault();
    if (!auth.user) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await updateDisplayName(auth.user.id, displayName);
      await auth.refreshProfile();
      setMessage('Display name saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the display name.');
    } finally {
      setBusy(false);
    }
  }

  async function saveEmail(event: FormEvent) {
    event.preventDefault();
    const next = email.trim();
    if (!next || next === auth.email) return;
    const supabase = getSupabase();
    if (!supabase) {
      setError('Email changes need Supabase.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ email: next });
      if (updateError) throw updateError;
      setMessage('Check your inbox to confirm the new email.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update email.');
    } finally {
      setBusy(false);
    }
  }

  async function sendPasswordReset() {
    if (!auth.email) {
      setError('No email on this account.');
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setError('Password reset needs Supabase.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(auth.email, {
        redirectTo: authRedirectUrl(),
      });
      if (resetError) throw resetError;
      setMessage('Password reset email sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset email.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="account-page">
      <div className="account-wrap">
        <p className="auth-kicker">Account</p>
        <h1 className="wordmark wordmark-ui" style={{ fontSize: 28, marginBottom: 8 }}>
          settings
        </h1>
        <p className="lede">
          <Link to="/me">← Boards</Link>
        </p>

        <section className="account-boards">
          <h2>Display name</h2>
          <form className="account-form" onSubmit={(event) => void saveDisplayName(event)}>
            <label className="field">
              <span>Name</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={80}
                placeholder="Your name"
              />
            </label>
            <button className="btn" type="submit" disabled={busy}>
              Save name
            </button>
          </form>
        </section>

        <section className="account-boards">
          <h2>Email</h2>
          <form className="account-form" onSubmit={(event) => void saveEmail(event)}>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <p className="hint">Changing email sends a confirmation link to the new address.</p>
            <button className="btn" type="submit" disabled={busy || email.trim() === (auth.email ?? '')}>
              Update email
            </button>
          </form>
        </section>

        <section className="account-boards">
          <h2>Password</h2>
          <p className="hint" style={{ marginTop: 0 }}>
            We’ll email a reset link to {auth.email || 'your address'}.
          </p>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void sendPasswordReset()}>
            Send reset email
          </button>
        </section>

        <section className="account-boards">
          <h2>Danger zone</h2>
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy}
            onClick={() => {
              if (!window.confirm('Delete your account and boards? This cannot be undone.')) return;
              setBusy(true);
              void deleteAccount()
                .then(() => navigate('/login'))
                .catch((err) => {
                  setError(err instanceof Error ? err.message : 'Could not delete the account.');
                  setBusy(false);
                });
            }}
          >
            Delete account
          </button>
        </section>

        {message ? <p className="hint">{message}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </main>
  );
}

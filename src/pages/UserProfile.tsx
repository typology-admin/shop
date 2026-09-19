import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';
import { hasSupabaseConfig } from '../lib/env.ts';
import { fetchPublicProfile, type Profile } from '../lib/profile.ts';

export function UserProfile() {
  const { username = '' } = useParams();
  const auth = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!hasSupabaseConfig()) {
      setStatus('error');
      setError('This page needs Supabase.');
      return;
    }
    setStatus('loading');
    void fetchPublicProfile(username)
      .then((next) => {
        if (cancelled) return;
        setProfile(next);
        setStatus(next ? 'ready' : 'missing');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load this profile.');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  useEffect(() => {
    if (profile) {
      document.title = `${profile.display_name || profile.username} — typology network`;
    }
  }, [profile]);

  const nav = (
    <header className="account-bar">
      <Link className="account-bar-brand" to="/">
        typology network
      </Link>
      <div className="account-bar-actions">
        {auth.session ? (
          <Link className="btn btn-ghost" to="/me">
            {auth.profile?.username ? `@${auth.profile.username}` : 'account'}
          </Link>
        ) : (
          <Link className="btn btn-ghost" to="/login">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );

  if (status === 'loading') {
    return (
      <div className="loading-screen">
        {nav}
        <div>
          <div className="loading-mark" />
          <h1 className="wordmark wordmark-ui">typology network</h1>
          <p className="lede">Looking up @{username}…</p>
        </div>
      </div>
    );
  }

  if (status !== 'ready' || !profile) {
    return (
      <div className="empty-screen">
        {nav}
        <div>
          <h1 className="wordmark wordmark-ui">typology network</h1>
          <p className="lede">
            {status === 'missing'
              ? `No public profile at /u/${username}.`
              : (error ?? 'This profile could not be loaded.')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="account-page">
      {nav}
      <div className="account-wrap">
        <p className="auth-kicker">@{profile.username}</p>
        <h1 className="wordmark wordmark-ui">{profile.display_name || profile.username}</h1>
        <p className="lede">No public boards yet.</p>
      </div>
    </div>
  );
}

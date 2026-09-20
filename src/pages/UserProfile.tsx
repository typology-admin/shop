import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AccountBar } from '../components/AccountBar.tsx';
import { useAuth } from '../hooks/useAuth.ts';
import { hasSupabaseConfig } from '../lib/env.ts';
import { fetchPublicProfile, type Profile } from '../lib/profile.ts';
import { listPublicBoards, type UserBoard } from '../lib/userBoards.ts';

export function UserProfile() {
  const { username = '' } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [boards, setBoards] = useState<UserBoard[]>([]);
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
      .then(async (next) => {
        if (cancelled) return;
        if (!next) {
          setStatus('missing');
          return;
        }
        setProfile(next);
        setBoards(await listPublicBoards(next.id));
        setStatus('ready');
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
    <AccountBar
      email={auth.session ? auth.email : null}
      signedIn={Boolean(auth.session)}
      onSignOut={
        auth.session
          ? () => {
              void auth.signOut().then(() => navigate('/login'));
            }
          : undefined
      }
    />
  );

  if (status === 'loading') {
    return (
      <div className="loading-screen">
        {nav}
        <div>
          <div className="loading-mark" />
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
        {boards.length === 0 ? (
          <p className="lede">No public boards yet.</p>
        ) : (
          <ul className="account-board-list">
            {boards.map((board) => (
              <li key={board.id}>
                <Link to={`/u/${profile.username}/${board.slug}`}>{board.title}</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

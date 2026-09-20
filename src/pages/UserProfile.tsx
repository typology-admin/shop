import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';
import { hasSupabaseConfig } from '../lib/env.ts';
import { fetchPublicProfile, type Profile } from '../lib/profile.ts';
import { listPublicBoards, type UserBoard } from '../lib/userBoards.ts';

export function UserProfile() {
  const { username = '' } = useParams();
  const auth = useAuth();
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

  const signedInChrome = auth.session ? null : (
    <header className="user-board-chrome">
      <Link className="chrome-pill" to="/">
        typology network
      </Link>
      <Link className="chrome-pill" to="/login">
        sign in
      </Link>
    </header>
  );

  if (status === 'loading') {
    return (
      <div className="loading-screen">
        {signedInChrome}
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
        {signedInChrome}
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
      {signedInChrome}
      <div className="account-wrap">
        <p className="auth-kicker">@{profile.username}</p>
        <h1 className="wordmark wordmark-ui">{profile.display_name || profile.username}</h1>
        {boards.length === 0 ? (
          <p className="lede">No public boards yet.</p>
        ) : (
          <ul className="account-board-list">
            {boards.map((board) => (
              <li key={board.id} className="account-board-tile">
                <span className="account-board-thumb" aria-hidden="true">
                  {board.thumbnail_emoji || '▢'}
                </span>
                <div className="account-board-tile-main">
                  <Link className="account-board-title" to={`/u/${profile.username}/${board.slug}`}>
                    {board.title}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

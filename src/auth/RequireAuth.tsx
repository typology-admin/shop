import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';

export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.ready) {
    return (
      <div className="loading-screen">
        <div>
          <div className="loading-mark" />
          <h1 className="wordmark wordmark-ui">typology network</h1>
          <p className="lede">Checking access…</p>
        </div>
      </div>
    );
  }

  if (auth.isLocal) {
    return (
      <div className="empty-screen">
        <div>
          <h1 className="wordmark wordmark-ui">typology network</h1>
          <p className="lede">
            User accounts need Supabase. Add credentials to <code>.env</code>, then open{' '}
            <Link to="/login">/login</Link>.
          </p>
        </div>
      </div>
    );
  }

  if (!auth.session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

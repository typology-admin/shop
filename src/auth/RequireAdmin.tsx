import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth.ts';

export function RequireAdmin({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  const signedIn = Boolean(auth.session || auth.email);

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

  if (!signedIn) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  if (!auth.admin) {
    return (
      <div className="empty-screen">
        <div>
          <h1 className="wordmark wordmark-ui">typology network</h1>
          <p className="lede">
            This account does not have the admin role. In Supabase, set{' '}
            <code>raw_app_meta_data.role</code> to <code>admin</code> (not user_metadata),
            then sign out and back in so the JWT refreshes.
          </p>
        </div>
      </div>
    );
  }

  return children;
}

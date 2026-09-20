import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';
import { AccountBar } from './AccountBar.tsx';

/** Fixed account chrome for every non-admin page while signed in. */
export function SignedInHeader() {
  const auth = useAuth();
  const navigate = useNavigate();

  if (!auth.ready || !auth.session) return null;

  return (
    <AccountBar
      email={auth.email}
      username={auth.profile?.username ?? null}
      displayName={auth.profile?.display_name ?? null}
      onSignOut={() => {
        void auth.signOut().then(() => navigate('/login'));
      }}
    />
  );
}

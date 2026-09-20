import { Link, NavLink } from 'react-router-dom';

type Props = {
  email?: string | null;
  onSignOut?: () => void;
  signedIn?: boolean;
};

export function AccountBar({ email, onSignOut, signedIn = true }: Props) {
  return (
    <header className="admin-bar">
      <Link className="admin-bar-brand" to="/">
        typology network
      </Link>
      <nav className="admin-tabs" aria-label="Account sections">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
          Shop
        </NavLink>
        <NavLink to="/me" className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
          Boards
        </NavLink>
      </nav>
      {email ? <span className="admin-bar-meta">{email}</span> : null}
      <div className="admin-bar-actions">
        {signedIn && onSignOut ? (
          <button type="button" className="btn btn-ghost" onClick={onSignOut}>
            Sign out
          </button>
        ) : (
          <Link className="btn btn-ghost" to="/login">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

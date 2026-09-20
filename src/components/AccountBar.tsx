import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useHeaderChromeHostSetter } from './HeaderChrome.tsx';

type Props = {
  email?: string | null;
  username?: string | null;
  displayName?: string | null;
  onSignOut?: () => void;
  signedIn?: boolean;
};

function IconAccount() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="6.5" r="2.75" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3.5 14.5c1.4-2.2 3.2-3.3 5.5-3.3s4.1 1.1 5.5 3.3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AccountBar({
  email,
  username = null,
  displayName = null,
  onSignOut,
  signedIn = true,
}: Props) {
  const location = useLocation();
  const setHost = useHeaderChromeHostSetter();
  const extrasRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const label = (displayName || username || email || 'account').trim();
  const publicPath = username ? `/u/${username}` : null;

  useLayoutEffect(() => {
    if (!setHost) return;
    setHost(extrasRef.current);
    return () => setHost(null);
  }, [setHost]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    function onPointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointer);
    };
  }, [menuOpen]);

  return (
    <header className="admin-bar">
      <Link className="admin-bar-brand" to="/">
        typology network
      </Link>
      <nav className="admin-tabs" aria-label="Account sections">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
          Home
        </NavLink>
        <NavLink to="/me" end className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
          Boards
        </NavLink>
      </nav>
      <div className="admin-bar-actions">
        <div className="admin-bar-extras" ref={extrasRef} />
        {signedIn && onSignOut ? (
          <div className="account-menu" ref={menuRef}>
            <button
              type="button"
              className={`account-menu-trigger${menuOpen ? ' is-open' : ''}`}
              aria-label="Account menu"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <IconAccount />
            </button>
            {menuOpen ? (
              <div className="account-menu-panel" id={menuId} role="menu">
                <div className="account-menu-identity">
                  <strong>{label}</strong>
                  {email ? <span>{email}</span> : null}
                </div>
                <Link className="account-menu-item" role="menuitem" to="/me" onClick={() => setMenuOpen(false)}>
                  Account
                </Link>
                {publicPath ? (
                  <Link
                    className="account-menu-item"
                    role="menuitem"
                    to={publicPath}
                    onClick={() => setMenuOpen(false)}
                  >
                    Public space
                  </Link>
                ) : null}
                <Link
                  className="account-menu-item"
                  role="menuitem"
                  to="/me/settings"
                  onClick={() => setMenuOpen(false)}
                >
                  Account settings
                </Link>
                <button
                  type="button"
                  className="account-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onSignOut();
                  }}
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <Link className="btn btn-ghost" to="/login">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

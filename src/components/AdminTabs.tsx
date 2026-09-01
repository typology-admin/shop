import { NavLink } from 'react-router-dom';

export function AdminTabs() {
  return (
    <nav className="admin-tabs" aria-label="Admin sections">
      <NavLink to="/admin" end className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
        Shop
      </NavLink>
      <NavLink
        to="/admin/network"
        className={({ isActive }) => (isActive ? 'is-active' : undefined)}
      >
        Network
      </NavLink>
      <NavLink
        to="/admin/contact"
        className={({ isActive }) => (isActive ? 'is-active' : undefined)}
      >
        Site
      </NavLink>
      <NavLink
        to="/admin/affiliates"
        className={({ isActive }) => (isActive ? 'is-active' : undefined)}
      >
        Affiliates
      </NavLink>
    </nav>
  );
}

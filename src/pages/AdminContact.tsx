import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminBar } from '../components/AdminBar.tsx';
import { useAuth } from '../hooks/useAuth.ts';
import { useContactLinks } from '../hooks/useContactLinks.ts';
import {
  deleteContactLink,
  insertContactLink,
  updateContactLink,
  type ContactLink,
} from '../lib/contact.ts';

export function AdminContact() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { links, setLinks, error, reload } = useContactLinks();
  const [label, setLabel] = useState('');
  const [href, setHref] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ContactLink | null>(null);

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    if (!label.trim()) return;
    setFormError(null);
    const slug = label.trim().toLowerCase().replace(/\s+/g, '-');
    try {
      const created = await insertContactLink({
        slug,
        label: label.trim().toLowerCase(),
        href: href.trim(),
        sortOrder: Math.max(0, ...links.map((link) => link.sortOrder)) + 1,
      });
      setLinks((prev) => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder));
      setLabel('');
      setHref('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add the link.');
    }
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    try {
      const updated = await updateContactLink(editing, {
        label: editing.label,
        href: editing.href,
        slug: editing.slug,
      });
      setLinks((prev) => prev.map((link) => (link.id === updated.id ? updated : link)));
      setEditing(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  return (
    <div className="admin-page">
      <AdminBar
        variant="contact"
        email={auth.email}
        isLocal={auth.isLocal}
        onSignOut={() => {
          void auth.signOut().then(() => navigate('/admin/login'));
        }}
      />
      <main className="network-admin">
        <h1>Contact</h1>
        <p className="network-admin-lede">
          These rows appear in the contact pill popup: support, sale, and buy by default. Use a
          mailto, a full URL, or a path like <code>/</code>.
        </p>
        {error ? <p className="form-error">{error}</p> : null}
        {formError ? <p className="form-error">{formError}</p> : null}

        <form className="network-admin-form" onSubmit={(event) => void onAdd(event)}>
          <h2>Add option</h2>
          <label className="field">
            <span>Label</span>
            <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="press" />
          </label>
          <label className="field">
            <span>Link</span>
            <input
              value={href}
              onChange={(event) => setHref(event.target.value)}
              placeholder="mailto:hello@typology.network"
            />
          </label>
          <button className="btn" type="submit" disabled={!label.trim()}>
            Add row
          </button>
        </form>

        {links.map((link) => (
          <article key={link.id} className="network-admin-row">
            {editing?.id === link.id ? (
              <form onSubmit={(event) => void onSave(event)} style={{ flex: 1, display: 'grid', gap: 8 }}>
                <label className="field">
                  <span>Label</span>
                  <input
                    value={editing.label}
                    onChange={(event) => setEditing({ ...editing, label: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Link</span>
                  <input
                    value={editing.href}
                    onChange={(event) => setEditing({ ...editing, href: event.target.value })}
                  />
                </label>
                <div className="btn-row">
                  <button className="btn" type="submit">
                    Save
                  </button>
                  <button className="btn btn-ghost" type="button" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div>
                  <strong>{link.label}</strong>
                  <p className="hint">{link.href || 'No link yet'}</p>
                </div>
                <div className="btn-row">
                  <button type="button" className="btn btn-ghost" onClick={() => setEditing(link)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      if (!window.confirm(`Remove ${link.label}?`)) return;
                      void deleteContactLink(link).then(() => {
                        setLinks((prev) => prev.filter((row) => row.id !== link.id));
                      });
                    }}
                  >
                    Remove
                  </button>
                </div>
              </>
            )}
          </article>
        ))}

        <p className="hint">
          <button type="button" className="text-btn" onClick={() => void reload()}>
            Reload from database
          </button>
        </p>
      </main>
    </div>
  );
}

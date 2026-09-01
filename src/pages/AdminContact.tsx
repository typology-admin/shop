import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminBar } from '../components/AdminBar.tsx';
import { useAuth } from '../hooks/useAuth.ts';
import { useContactLinks } from '../hooks/useContactLinks.ts';
import { useSiteSettings } from '../hooks/useSiteSettings.ts';
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
  const { settings, setSettings, save, error: settingsError } = useSiteSettings();
  const [label, setLabel] = useState('');
  const [href, setHref] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ContactLink | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);

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

  async function onSaveCopy(event: FormEvent) {
    event.preventDefault();
    setSettingsBusy(true);
    setFormError(null);
    try {
      await save(settings);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save site copy.');
    } finally {
      setSettingsBusy(false);
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
        <h1>Site</h1>
        <p className="network-admin-lede">
          About copy appears in the about pill. Footer links sit at the bottom of the shop board
          with the network link.
        </p>
        {error ? <p className="form-error">{error}</p> : null}
        {settingsError ? <p className="form-error">{settingsError}</p> : null}
        {formError ? <p className="form-error">{formError}</p> : null}

        <form className="network-admin-form" onSubmit={(event) => void onSaveCopy(event)}>
          <h2>About</h2>
          <label className="field">
            <span>About text</span>
            <textarea
              rows={6}
              value={settings.aboutText}
              onChange={(event) => setSettings({ ...settings, aboutText: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Contact email</span>
            <input
              type="email"
              value={settings.contactEmail}
              onChange={(event) => setSettings({ ...settings, contactEmail: event.target.value })}
            />
          </label>
          <button className="btn" type="submit" disabled={settingsBusy}>
            {settingsBusy ? 'Saving…' : 'Save about'}
          </button>
        </form>

        <form className="network-admin-form" onSubmit={(event) => void onAdd(event)}>
          <h2>Footer links</h2>
          <label className="field">
            <span>Label</span>
            <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="instagram" />
          </label>
          <label className="field">
            <span>Link</span>
            <input
              value={href}
              onChange={(event) => setHref(event.target.value)}
              placeholder="https://instagram.com/typology.network"
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
            Reload links from database
          </button>
        </p>
      </main>
    </div>
  );
}

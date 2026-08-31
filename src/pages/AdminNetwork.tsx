import { useState, type FormEvent } from 'react';
import { AdminBar } from '../components/AdminBar.tsx';
import { useAuth } from '../hooks/useAuth.ts';
import { useNetworkItems } from '../hooks/useNetworkItems.ts';
import {
  deleteNetworkItem,
  insertNetworkItem,
  updateNetworkItem,
  type NetworkItem,
} from '../lib/network.ts';
import { useNavigate } from 'react-router-dom';

export function AdminNetwork() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { items, setItems, status, error, reload } = useNetworkItems();
  const [prefix, setPrefix] = useState('');
  const [description, setDescription] = useState('');
  const [hoverEmoji, setHoverEmoji] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<NetworkItem | null>(null);

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    if (!prefix.trim()) return;
    setFormError(null);
    const id = prefix.trim().toLowerCase().replace(/\s+/g, '-');
    const nextOrder = Math.max(0, ...items.map((item) => item.sortOrder)) + 1;
    try {
      const created = await insertNetworkItem({
        id,
        prefix: prefix.trim().toLowerCase(),
        suffix: '.typology.network',
        hoverEmoji: hoverEmoji.trim() || null,
        description: description.trim(),
        isMain: false,
        isHidden: false,
        sortOrder: nextOrder,
        hoverDisplayMode: 'emoji',
        hoverIconUrl: null,
        hoverBgImageUrl: null,
        shellStyleIndex: nextOrder % 8,
      });
      setItems((prev) => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder));
      setPrefix('');
      setDescription('');
      setHoverEmoji('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add the site.');
    }
  }

  async function onSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    try {
      const updated = await updateNetworkItem(editing, {
        prefix: editing.prefix,
        suffix: editing.suffix,
        description: editing.description,
        hoverEmoji: editing.hoverEmoji,
      });
      setItems((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)).sort((a, b) => a.sortOrder - b.sortOrder),
      );
      setEditing(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save.');
    }
  }

  return (
    <div className="admin-page">
      <AdminBar
        variant="network"
        email={auth.email}
        isLocal={auth.isLocal}
        onSignOut={() => {
          void auth.signOut().then(() => navigate('/admin/login'));
        }}
      />
      <main className="network-admin">
        <h1>Network</h1>
        <p className="network-admin-lede">
          These rows are the typology.network landing page. Hidden rows stay in the database but
          do not appear on the public list.
        </p>
        {error ? <p className="form-error">{error}</p> : null}
        {formError ? <p className="form-error">{formError}</p> : null}

        <form className="network-admin-form" onSubmit={(event) => void onAdd(event)}>
          <h2>Add site</h2>
          <label className="field">
            <span>Prefix</span>
            <input value={prefix} onChange={(event) => setPrefix(event.target.value)} placeholder="studio" />
          </label>
          <label className="field">
            <span>Hover emoji</span>
            <input value={hoverEmoji} onChange={(event) => setHoverEmoji(event.target.value)} placeholder="🧪" />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <button className="btn" type="submit" disabled={!prefix.trim()}>
            Add row
          </button>
        </form>

        {status === 'loading' ? <p className="lede">Loading…</p> : null}

        {items.map((item) => (
          <article
            key={item.id}
            className={`network-admin-row${item.isHidden ? ' is-hidden' : ''}`}
          >
            {editing?.id === item.id ? (
              <form onSubmit={(event) => void onSaveEdit(event)} style={{ flex: 1, display: 'grid', gap: 8 }}>
                <label className="field">
                  <span>Prefix</span>
                  <input
                    value={editing.prefix}
                    onChange={(event) => setEditing({ ...editing, prefix: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Suffix</span>
                  <input
                    value={editing.suffix}
                    onChange={(event) => setEditing({ ...editing, suffix: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Emoji</span>
                  <input
                    value={editing.hoverEmoji ?? ''}
                    onChange={(event) => setEditing({ ...editing, hoverEmoji: event.target.value || null })}
                  />
                </label>
                <label className="field">
                  <span>Description</span>
                  <textarea
                    value={editing.description}
                    onChange={(event) => setEditing({ ...editing, description: event.target.value })}
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
                  <strong>
                    {item.prefix}
                    <span style={{ fontWeight: 400, color: 'var(--ink-muted)' }}>{item.suffix}</span>
                  </strong>
                  {item.isMain ? <span className="hint"> root</span> : null}
                  {item.isHidden ? <span className="hint"> hidden</span> : null}
                  {item.description ? <p className="hint">{item.description}</p> : null}
                </div>
                <div className="btn-row">
                  <button type="button" className="btn btn-ghost" onClick={() => setEditing(item)}>
                    Edit
                  </button>
                  {!item.isMain ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          void updateNetworkItem(item, { isHidden: !item.isHidden }).then((updated) => {
                            setItems((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
                          });
                        }}
                      >
                        {item.isHidden ? 'Show' : 'Hide'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => {
                          if (!window.confirm(`Remove ${item.prefix}${item.suffix}?`)) return;
                          void deleteNetworkItem(item).then(() => {
                            setItems((prev) => prev.filter((row) => row.id !== item.id));
                          });
                        }}
                      >
                        Remove
                      </button>
                    </>
                  ) : null}
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

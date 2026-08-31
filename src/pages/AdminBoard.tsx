import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CANVAS_WIDTH } from '../../shared/constants.ts';
import { AddItemForm, type AddItemDraft } from '../components/AddItemForm.tsx';
import { AdminBar } from '../components/AdminBar.tsx';
import { Board } from '../components/Board.tsx';
import { ItemInspector } from '../components/ItemInspector.tsx';
import { useAuth } from '../hooks/useAuth.ts';
import { useItems } from '../hooks/useItems.ts';
import { viewportCenterOnCanvas } from '../lib/canvas.ts';
import { hasSupabaseConfig } from '../lib/env.ts';
import {
  createItem,
  deleteItem,
  saveLocalBlob,
  updateItem,
  uploadPng,
} from '../lib/items.ts';
import type { ItemPatch } from '../lib/types.ts';

export function AdminBoard() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { items, setItems, status, error } = useItems();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  const patchLocal = useCallback((id: string, patch: ItemPatch) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, [setItems]);

  const commit = useCallback(
    (id: string, patch: ItemPatch) => {
      patchLocal(id, patch);
      void updateItem(id, patch);
    },
    [patchLocal],
  );

  const handleDelete = useCallback(async (id: string) => {
    const item = items.find((row) => row.id === id);
    const label = item?.title || 'this object';
    if (!window.confirm(`Remove ${label} from the board?`)) return;
    setItems((prev) => prev.filter((row) => row.id !== id));
    setSelectedId((current) => (current === id ? null : current));
    await deleteItem(id);
  }, [items, setItems]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (event.key === 'Escape') setSelectedId(null);
      if (!typing && selectedId && (event.key === 'Backspace' || event.key === 'Delete')) {
        event.preventDefault();
        void handleDelete(selectedId);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, handleDelete]);

  function handleSelect(id: string | null) {
    setSelectedId(id);
    if (id) {
      const maxZ = items.reduce((max, item) => Math.max(max, item.z_index), 0);
      const current = items.find((item) => item.id === id);
      if (current && current.z_index < maxZ) {
        commit(id, { z_index: maxZ + 1 });
      }
      setPanelOpen(true);
    }
  }

  async function handleAdd(draft: AddItemDraft) {
    setBusy(true);
    setFormError(null);
    try {
      const scale = window.innerWidth / CANVAS_WIDTH;
      const center = viewportCenterOnCanvas(scale, window.scrollY, window.innerHeight);
      const maxZ = items.reduce((max, item) => Math.max(max, item.z_index), 0);
      const id = crypto.randomUUID();

      let imagePath = '';
      let width = draft.width;
      let height = draft.height;

      if (!hasSupabaseConfig()) {
        imagePath = await saveLocalBlob(id, draft.file);
      } else {
        const uploaded = await uploadPng(draft.file, auth.session?.access_token ?? null);
        imagePath = uploaded.path;
        width = uploaded.width;
        height = uploaded.height;
      }

      const created = await createItem({
        id,
        title: draft.title,
        affiliate_url: draft.affiliateUrl,
        store: draft.store,
        image_path: imagePath,
        image_width: width,
        image_height: height,
        x: center.x,
        y: center.y,
        scale: 1,
        rotation: 0,
        z_index: maxZ + 1,
      });
      setItems((prev) => [...prev, created]);
      setSelectedId(created.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add item.');
      throw err;
    } finally {
      setBusy(false);
    }
  }

  function inspectPatch(patch: ItemPatch, shouldCommit = false) {
    if (!selected) return;
    if (shouldCommit) commit(selected.id, patch);
    else patchLocal(selected.id, patch);
  }

  if (status === 'loading') {
    return (
      <div className="loading-screen">
        <div>
          <div className="loading-mark" />
          <p className="lede">Opening the board…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <AdminBar
        email={auth.email}
        isLocal={auth.isLocal}
        panelOpen={panelOpen}
        onAdd={() => {
          setSelectedId(null);
          setPanelOpen(true);
        }}
        onTogglePanel={() => setPanelOpen((open) => !open)}
        onSignOut={() => {
          void auth.signOut().then(() => navigate('/admin/login'));
        }}
      />
      {error ? <div className="banner">{error}</div> : null}
      {panelOpen ? (
        <>
          <button
            type="button"
            className="panel-backdrop"
            aria-label="Close tools"
            onClick={() => setPanelOpen(false)}
          />
          <aside className="admin-panel">
            {selected ? (
              <ItemInspector
                item={selected}
                onPatch={inspectPatch}
                onBringToFront={() => {
                  const maxZ = items.reduce((max, item) => Math.max(max, item.z_index), 0);
                  commit(selected.id, { z_index: maxZ + 1 });
                }}
                onSendToBack={() => {
                  const minZ = items.reduce((min, item) => Math.min(min, item.z_index), 0);
                  commit(selected.id, { z_index: minZ - 1 });
                }}
                onDelete={() => void handleDelete(selected.id)}
              />
            ) : (
              <>
                <h2>Add item</h2>
                <AddItemForm busy={busy} error={formError} onSubmit={handleAdd} />
              </>
            )}
          </aside>
        </>
      ) : null}
      {items.length === 0 && status === 'ready' ? (
        <div className="empty-screen" style={{ minHeight: 'calc(100vh - var(--bar-h))', paddingTop: 'var(--bar-h)' }}>
          <div>
            <h1 className="wordmark">Knoll</h1>
            <p className="lede">Drop a transparent PNG in the tools panel to place the first object.</p>
          </div>
        </div>
      ) : (
        <Board
          items={items}
          mode="admin"
          selectedId={selectedId}
          onSelect={handleSelect}
          onCommit={commit}
        />
      )}
    </div>
  );
}

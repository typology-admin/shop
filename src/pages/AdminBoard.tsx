import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddItemForm, type AddItemDraft } from '../components/AddItemForm.tsx';
import { AdminBar } from '../components/AdminBar.tsx';
import { AdminToolsRail, type ToolsTab } from '../components/AdminToolsRail.tsx';
import { Board } from '../components/Board.tsx';
import { ItemInspector } from '../components/ItemInspector.tsx';
import { SectionManager } from '../components/SectionManager.tsx';
import { SectionRail } from '../components/SectionRail.tsx';
import { ViewZoomSettings } from '../components/ViewZoomSettings.tsx';
import { useAuth } from '../hooks/useAuth.ts';
import { useBoardSections } from '../hooks/useBoardSections.ts';
import { useGravitySettle } from '../hooks/useGravitySettle.ts';
import { useItems } from '../hooks/useItems.ts';
import { useBoardZoom, useSiteSettings } from '../hooks/useSiteSettings.ts';
import { boardScale, viewportCenterOnCanvas } from '../lib/canvas.ts';
import type { PreparedImage } from '../lib/cutout.ts';
import { hasSupabaseConfig } from '../lib/env.ts';
import { forgetImageUrl, withAmazonTag } from '../lib/images.ts';
import {
  createItem,
  deleteItem,
  saveLocalBlob,
  updateItem,
  uploadPng,
} from '../lib/items.ts';
import {
  itemsForSection,
  nearestSection,
  packNewItem,
  sectionGravity,
} from '../lib/knollLayout.ts';
import { jumpToSection, type BoardSection } from '../lib/sections.ts';
import { parseTags } from '../lib/tags.ts';
import type { ItemPatch } from '../lib/types.ts';
import { allWells, wellsForSection } from '../lib/wells.ts';

export function AdminBoard() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { items, setItems, status, error } = useItems();
  const { sections, setSections } = useBoardSections();
  const { settings } = useSiteSettings();
  const zoom = useBoardZoom();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [toolsTab, setToolsTab] = useState<ToolsTab | null>('item');
  const [busy, setBusy] = useState(false);
  const [arrangingId, setArrangingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const settlingIds = useRef(new Set<string>());

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const boardWells = useMemo(() => allWells(sections), [sections]);

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

  const applyPosesLocal = useCallback(
    (poses: Array<{ id: string; x: number; y: number; rotation: number }>) => {
      if (poses.length === 0) return;
      const map = new Map(poses.map((pose) => [pose.id, pose]));
      setItems((prev) =>
        prev.map((item) => {
          const pose = map.get(item.id);
          if (!pose) return item;
          return { ...item, x: pose.x, y: pose.y, rotation: pose.rotation };
        }),
      );
    },
    [setItems],
  );

  const commitPoses = useCallback(
    (poses: Array<{ id: string; x: number; y: number; rotation: number }>) => {
      applyPosesLocal(poses);
      for (const pose of poses) {
        settlingIds.current.delete(pose.id);
        void updateItem(pose.id, { x: pose.x, y: pose.y, rotation: pose.rotation });
      }
      setArrangingId(null);
    },
    [applyPosesLocal],
  );

  const { kickSettle, setDragging, syncDragPose } = useGravitySettle({
    items,
    wells: boardWells,
    gap: settings.knollGap,
    gravity: settings.knollGravity,
    rotation: settings.knollRotation,
    enabled: settings.knollGravity || settings.knollRotation !== 'none',
    onFrame: applyPosesLocal,
    onSettled: commitPoses,
  });

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
      setToolsTab('item');
      setPanelOpen(true);
    }
  }

  function handleToolsTab(tab: ToolsTab) {
    setToolsTab((current) => (current === tab ? null : tab));
    setPanelOpen(true);
  }

  async function handleAdd(draft: AddItemDraft) {
    setBusy(true);
    setFormError(null);
    try {
      const scale = boardScale(window.innerWidth, zoom);
      const center = viewportCenterOnCanvas(scale, window.scrollY, window.innerHeight);
      const section =
        sections.find((row) => row.id === draft.sectionId) ??
        nearestSection(center.y, sections);
      const gravity = section ? sectionGravity(section) : center;
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
        affiliate_url: withAmazonTag(draft.affiliateUrl),
        store: draft.store,
        image_path: imagePath,
        image_width: width,
        image_height: height,
        x: gravity.x,
        y: gravity.y,
        scale: 1,
        rotation: 0,
        z_index: maxZ + 1,
        tags: parseTags(draft.tags),
        section_id: section?.id ?? null,
      });
      let placed = created;
      if (section) {
        const pose = await packNewItem({
          item: created,
          neighbors: itemsForSection(items, section, sections),
          section,
          sections,
          gap: settings.knollGap,
          file: draft.file,
          wells: wellsForSection(section),
          mode: settings.knollRotation,
          gravity: settings.knollGravity,
        });
        placed = { ...created, x: pose.x, y: pose.y, rotation: pose.rotation };
        await updateItem(placed.id, { x: pose.x, y: pose.y, rotation: pose.rotation });
        jumpToSection(section, 'smooth');
      }
      setItems((prev) => [...prev, placed]);
      setSelectedId(placed.id);
      void kickSettle();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add item.');
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function handleReplaceImage(prepared: PreparedImage) {
    if (!selected) return;
    const item = selected;
    forgetImageUrl(item.image_path);
    let imagePath = item.image_path;
    let width = prepared.width;
    let height = prepared.height;
    if (!hasSupabaseConfig()) {
      imagePath = await saveLocalBlob(item.id, prepared.file);
    } else {
      const uploaded = await uploadPng(prepared.file, auth.session?.access_token ?? null);
      imagePath = uploaded.path;
      width = uploaded.width;
      height = uploaded.height;
    }
    const patch = {
      image_path: imagePath,
      image_width: width,
      image_height: height,
    };
    setItems((prev) =>
      prev.map((row) =>
        row.id === item.id ? { ...row, ...patch, image_rev: Date.now() } : row,
      ),
    );
    await updateItem(item.id, patch);
  }

  async function handleArrange(section: BoardSection) {
    setArrangingId(section.id);
    setFormError(null);
    try {
      await kickSettle({ reseeds: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not relax that scene.');
      setArrangingId(null);
    }
  }

  function inspectPatch(patch: ItemPatch, shouldCommit = false) {
    if (!selected) return;
    const next =
      shouldCommit && patch.affiliate_url != null
        ? { ...patch, affiliate_url: withAmazonTag(patch.affiliate_url) }
        : patch;
    if (shouldCommit) commit(selected.id, next);
    else patchLocal(selected.id, next);
    if (shouldCommit && 'section_id' in next) {
      const nextItems = items.map((row) =>
        row.id === selected.id ? { ...row, ...next } : row,
      );
      void kickSettle({ items: nextItems });
    }
  }

  if (status === 'loading') {
    return (
      <div className="loading-screen">
        <div>
          <div className="loading-mark" />
          <h1 className="wordmark wordmark-ui">typology network</h1>
          <p className="lede">Opening the board…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <AdminBar
        variant="shop"
        email={auth.email}
        isLocal={auth.isLocal}
        panelOpen={panelOpen}
        onAdd={() => {
          setSelectedId(null);
          setToolsTab('item');
          setPanelOpen(true);
        }}
        onTogglePanel={() =>
          setPanelOpen((open) => {
            if (!open) setToolsTab((tab) => tab ?? 'item');
            return !open;
          })
        }
        onSignOut={() => {
          void auth.signOut().then(() => navigate('/admin/login'));
        }}
      />
      {error ? <div className="banner">{error}</div> : null}
      {panelOpen ? (
        <>
          {toolsTab ? (
            <button
              type="button"
              className="panel-backdrop"
              aria-label="Close panel"
              onClick={() => setToolsTab(null)}
            />
          ) : null}
          <aside className={`admin-panel${toolsTab ? '' : ' is-rail-only'}`}>
            <AdminToolsRail
              active={toolsTab}
              itemActive={Boolean(selected)}
              onSelect={handleToolsTab}
            />
            {toolsTab ? (
              <div className="admin-panel-body">
                {toolsTab === 'item' ? (
                  selected ? (
                    <ItemInspector
                      item={selected}
                      sections={sections}
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
                      onReplaceImage={handleReplaceImage}
                    />
                  ) : (
                    <>
                      <h2>Add item</h2>
                      <AddItemForm
                        busy={busy}
                        error={formError}
                        accessToken={auth.session?.access_token ?? null}
                        sections={sections}
                        defaultSectionId={
                          nearestSection(
                            viewportCenterOnCanvas(
                              boardScale(window.innerWidth, zoom),
                              window.scrollY,
                              window.innerHeight,
                            ).y,
                            sections,
                          )?.id ?? null
                        }
                        onSubmit={handleAdd}
                      />
                    </>
                  )
                ) : null}
                {toolsTab === 'sections' ? (
                  <SectionManager
                    sections={sections}
                    onChange={(next) => {
                      setSections(next);
                      void kickSettle();
                    }}
                    zoom={zoom}
                    arrangingId={arrangingId}
                    onRearrange={(section) => void handleArrange(section)}
                  />
                ) : null}
                {toolsTab === 'view' ? (
                  <ViewZoomSettings onPackingCommit={() => void kickSettle()} />
                ) : null}
              </div>
            ) : null}
          </aside>
        </>
      ) : null}
      <SectionRail sections={sections} />
      {items.length === 0 && status === 'ready' ? (
        <div className="empty-screen" style={{ minHeight: 'calc(100vh - var(--bar-h))', paddingTop: 'var(--bar-h)' }}>
          <div>
            <h1 className="wordmark wordmark-ui">typology network</h1>
            <p className="lede">Drop a product photo or paste an Amazon link to place the first object.</p>
          </div>
        </div>
      ) : (
        <Board
          items={items}
          mode="admin"
          zoom={zoom}
          selectedId={selectedId}
          onSelect={handleSelect}
          onCommit={commit}
          wells={boardWells}
          onDragStartItem={(id) => setDragging(id)}
          onDragMoveItem={(id, x, y) => {
            syncDragPose(id, x, y);
            patchLocal(id, { x, y });
          }}
          onDragEndItem={(id, x, y) => {
            setDragging(null);
            if (settings.knollGravity || settings.knollRotation !== 'none') {
              patchLocal(id, { x, y });
              void kickSettle();
            } else {
              commit(id, { x, y });
            }
          }}
        />
      )}
    </div>
  );
}

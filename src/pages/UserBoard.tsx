import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DEFAULT_BOARD_COLOR, DEFAULT_KNOLL_GAP, DEFAULT_KNOLL_ROTATION, MAX_KNOLL_GAP, MIN_KNOLL_GAP } from '../../shared/constants.ts';
import { AddUserItemDialog } from '../components/AddUserItemDialog.tsx';
import { AdminToolsRail, type ToolsTab } from '../components/AdminToolsRail.tsx';
import { Board } from '../components/Board.tsx';
import { BoardColorField } from '../components/BoardColorField.tsx';
import { BusyOverlay } from '../components/BusyOverlay.tsx';
import { CutoutEditor } from '../components/CutoutEditor.tsx';
import { ShareBoardDialog } from '../components/ShareBoardDialog.tsx';
import { UserSectionPanel } from '../components/UserSectionPanel.tsx';
import { useAuth } from '../hooks/useAuth.ts';
import { useGravitySettle } from '../hooks/useGravitySettle.ts';
import { useBoardZoom } from '../hooks/useSiteSettings.ts';
import { beginCutout, finalizeCutout, type CutoutSession } from '../lib/cutout.ts';
import { fetchImageBlob, forgetImageUrl, openAffiliate } from '../lib/images.ts';
import { uploadPng } from '../lib/items.ts';
import { forgetSharedProductImage } from '../lib/productImageCache.ts';
import { fetchPublicProfile } from '../lib/profile.ts';
import { toCanvasItem, userWells } from '../lib/userBoardMap.ts';
import type { NewItemInput } from '../components/AddUserItemDialog.tsx';
import {
  addItem,
  claimItem,
  deleteItem,
  itemImageSrc,
  loadBoardBySlug,
  loadSharedBoard,
  nearestSectionId,
  suggestItem,
  updateBoard,
  updateItem,
  rotateShareToken,
  type BoardVisibility,
  type UserBoard,
  type UserBoardClaim,
  type UserBoardItem,
  type UserBoardSection,
} from '../lib/userBoards.ts';

type SaveState = 'saved' | 'saving' | 'error';

const PACK_GAP_KEY = 'knoll-user-pack-gap';

function readPackGap(): number {
  try {
    const raw = Number(localStorage.getItem(PACK_GAP_KEY));
    if (!Number.isFinite(raw)) return DEFAULT_KNOLL_GAP;
    return Math.max(MIN_KNOLL_GAP, Math.min(MAX_KNOLL_GAP, Math.round(raw)));
  } catch {
    return DEFAULT_KNOLL_GAP;
  }
}

export function UserBoardPage() {
  const { username = '', slug = '', token = '' } = useParams();
  const auth = useAuth();
  const zoom = useBoardZoom();
  const [board, setBoard] = useState<UserBoard | null>(null);
  const [sections, setSections] = useState<UserBoardSection[]>([]);
  const [items, setItems] = useState<UserBoardItem[]>([]);
  const [claims, setClaims] = useState<UserBoardClaim[]>([]);
  const [ownerName, setOwnerName] = useState(username);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>('saved');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addSectionId, setAddSectionId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [cutoutSession, setCutoutSession] = useState<CutoutSession | null>(null);
  const [cutoutWorking, setCutoutWorking] = useState<string | null>(null);
  const [toolsTab, setToolsTab] = useState<ToolsTab | null>(null);
  const [arrangingId, setArrangingId] = useState<string | null>(null);
  const [knollGap, setKnollGap] = useState(readPackGap);
  const [claimName, setClaimName] = useState('');
  const [suggestNote, setSuggestNote] = useState('');
  const [suggestUrl, setSuggestUrl] = useState('');
  const pending = useRef<Map<string, Partial<UserBoardItem>>>(new Map());
  const timer = useRef<number>(0);

  const owner = Boolean(auth.user && board && auth.user.id === board.owner_id);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      if (token) {
        const bundle = await loadSharedBoard(token);
        setBoard(bundle.board);
        setSections(bundle.sections);
        setItems(bundle.items);
        setClaims(bundle.claims);
        setOwnerName('shared');
        setStatus('ready');
        return;
      }
      const profile = await fetchPublicProfile(username);
      if (!profile) {
        setStatus('missing');
        return;
      }
      setOwnerName(profile.username || username);
      const bundle = await loadBoardBySlug(profile.id, slug);
      if (!bundle) {
        setStatus('missing');
        return;
      }
      setBoard(bundle.board);
      setSections(bundle.sections);
      setItems(bundle.items);
      setClaims(bundle.claims);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this board.');
      setStatus('error');
    }
  }, [slug, token, username]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (board) document.title = `${board.title} — typology network`;
  }, [board]);

  const boardColor = board?.background_color || DEFAULT_BOARD_COLOR;

  useEffect(() => {
    if (!board) return;
    const root = document.documentElement;
    const previous = root.style.getPropertyValue('--board');
    root.style.setProperty('--board', boardColor);
    return () => {
      if (previous) root.style.setProperty('--board', previous);
      else root.style.removeProperty('--board');
    };
  }, [board, boardColor]);

  function handleToolsTab(tab: ToolsTab) {
    setToolsTab((current) => (current === tab ? null : tab));
  }

  const flush = useCallback(async () => {
    const entries = [...pending.current.entries()];
    pending.current.clear();
    if (entries.length === 0) return;
    setSave('saving');
    try {
      await Promise.all(entries.map(([id, patch]) => updateItem(id, patch)));
      setSave('saved');
    } catch {
      setSave('error');
    }
  }, []);

  const queue = useCallback(
    (id: string, patch: Partial<UserBoardItem>) => {
      const prev = pending.current.get(id) ?? {};
      pending.current.set(id, { ...prev, ...patch });
      setItems((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
      setSave('saving');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        void flush();
      }, 400);
    },
    [flush],
  );

  const wells = useMemo(() => userWells(sections), [sections]);
  const canvasItems = useMemo(() => items.filter((item) => itemImageSrcSafe(item)).map(toCanvasItem), [items]);

  const gravity = useGravitySettle({
    items: canvasItems,
    wells,
    gap: knollGap,
    gravity: true,
    rotation: DEFAULT_KNOLL_ROTATION,
    enabled: owner && wells.length > 0,
    onFrame: (poses) => {
      setItems((list) =>
        list.map((item) => {
          const pose = poses.find((row) => row.id === item.id);
          return pose ? { ...item, x: pose.x, y: pose.y, rotation: pose.rotation } : item;
        }),
      );
    },
    onSettled: (poses) => {
      for (const pose of poses) {
        const item = items.find((row) => row.id === pose.id);
        const sectionId = nearestSectionId(pose.x, pose.y, sections);
        queue(pose.id, {
          x: pose.x,
          y: pose.y,
          rotation: pose.rotation,
          section_id: sectionId ?? item?.section_id ?? null,
        });
      }
    },
  });

  async function onAdd(input: NewItemInput) {
    if (!board) return;
    setAdding(true);
    try {
      const section =
        sections.find((row) => row.id === (input.section_id ?? addSectionId)) ?? sections[0] ?? null;
      const created = await addItem(board.id, {
        ...input,
        x: input.x ?? section?.x ?? 1200,
        y: input.y ?? section?.y ?? 900,
        section_id: input.section_id ?? section?.id ?? null,
      });
      setItems((list) => [...list, created]);
    } finally {
      setAdding(false);
    }
  }

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const selectedClaimed = claims.some((claim) => claim.item_id === selectedId);

  async function openCutout() {
    if (!selected) return;
    const src = itemImageSrc(selected);
    if (!src) {
      setError('This item has no photo to edit.');
      return;
    }
    setCutoutWorking('Opening cutout…');
    setError(null);
    try {
      const blob = await fetchImageBlob(src);
      const next = await beginCutout(blob, 'item.png');
      setCutoutSession(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open that cutout.');
    } finally {
      setCutoutWorking(null);
    }
  }

  async function saveCutout() {
    if (!selected || !cutoutSession) return;
    setCutoutWorking('Saving cutout…');
    setError(null);
    try {
      const prepared = await finalizeCutout(cutoutSession);
      const oldPath = selected.image_path || '';
      forgetImageUrl(oldPath);
      forgetSharedProductImage(oldPath);
      const uploaded = await uploadPng(prepared.file, auth.session?.access_token ?? null);
      const patch = {
        image_path: uploaded.path,
        image_width: uploaded.width,
        image_height: uploaded.height,
      };
      await updateItem(selected.id, patch);
      setItems((list) => list.map((row) => (row.id === selected.id ? { ...row, ...patch } : row)));
      setCutoutSession(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the cutout.');
    } finally {
      setCutoutWorking(null);
    }
  }

  if (status === 'loading') {
    return (
      <div className="loading-screen">
        <div>
          <div className="loading-mark" />
          <p className="lede">Opening board…</p>
        </div>
      </div>
    );
  }

  if (status !== 'ready' || !board) {
    return (
      <div className="empty-screen">
        <div>
          <h1 className="wordmark wordmark-ui">typology network</h1>
          <p className="lede">{error ?? 'This board is missing or private.'}</p>
          <p className="hint">
            <Link to="/">Shop</Link>
            {' · '}
            <Link to="/me">Your boards</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-board-page">
      {owner ? (
        <header className="admin-bar">
          <Link className="admin-bar-brand" to={username ? `/u/${ownerName}` : '/me'}>
            {ownerName} / {board.slug}
          </Link>
          <span className="admin-bar-meta">
            {save === 'saving' ? 'Saving…' : save === 'error' ? 'Save failed' : 'Saved'}
          </span>
          <div className="admin-bar-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setShareOpen(true)}>
              share
            </button>
          </div>
        </header>
      ) : (
        <header className="user-board-chrome">
          <Link className="chrome-pill" to={username ? `/u/${ownerName}` : '/'}>
            {ownerName}
          </Link>
          <Link className="chrome-pill" to="/login">
            sign in
          </Link>
        </header>
      )}

      {owner ? (
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
                    <div className="inspector-block busy-host">
                      {cutoutWorking ? <BusyOverlay message={cutoutWorking} /> : null}
                      <h2>{selected.title || 'Item'}</h2>
                      <label className="field">
                        <span>Title</span>
                        <input
                          value={selected.title}
                          onChange={(event) => sync(selected.id, { title: event.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>URL</span>
                        <input
                          value={selected.url}
                          onChange={(event) => sync(selected.id, { url: event.target.value })}
                        />
                      </label>
                      <div className="btn-row">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={Boolean(cutoutWorking) || !itemImageSrc(selected)}
                          onClick={() => void openCutout()}
                        >
                          Edit cutout
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => {
                            void deleteItem(selected.id);
                            setItems((list) => list.filter((row) => row.id !== selected.id));
                            setSelectedId(null);
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h2>Add item</h2>
                      <p className="hint">Paste a product URL or upload a photo to place an object.</p>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setAddSectionId(null);
                          setAddOpen(true);
                        }}
                      >
                        add item
                      </button>
                    </>
                  )
                ) : null}
                {toolsTab === 'sections' ? (
                  <UserSectionPanel
                    boardId={board.id}
                    sections={sections}
                    zoom={zoom}
                    arrangingId={arrangingId}
                    onChange={setSections}
                    knollGap={knollGap}
                    onKnollGapChange={setKnollGap}
                    onKnollGapCommit={(gap) => {
                      setKnollGap(gap);
                      try {
                        localStorage.setItem(PACK_GAP_KEY, String(gap));
                      } catch {
                        /* ignore */
                      }
                      void gravity.kickSettle();
                    }}
                    onRearrange={(section) => {
                      setArrangingId(section.id);
                      void gravity.kickSettle({ reseeds: true }).finally(() => setArrangingId(null));
                    }}
                  />
                ) : null}
                {toolsTab === 'view' ? (
                  <BoardColorField
                    value={boardColor}
                    onChange={(background_color) => {
                      setBoard((current) => (current ? { ...current, background_color } : current));
                    }}
                    onCommit={(background_color) => {
                      void updateBoard(board.id, { background_color }).then(setBoard);
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </aside>
        </>
      ) : null}

      <Board
        items={canvasItems}
        mode={owner ? 'admin' : 'public'}
        zoom={zoom}
        selectedId={selectedId}
        backgroundColor={boardColor}
        wells={owner ? wells : []}
        onAddAtWell={
          owner
            ? (sectionId) => {
                setAddSectionId(sectionId);
                setAddOpen(true);
                setToolsTab('item');
              }
            : undefined
        }
        onSelect={(id) => {
          setSelectedId(id);
          if (owner && id) setToolsTab('item');
          if (!owner && id) {
            const item = items.find((row) => row.id === id);
            if (item?.url) openAffiliate(item.url);
          }
        }}
        onCommit={(id, patch) => {
          if (!owner) return;
          const mapped: Partial<UserBoardItem> = {
            x: patch.x,
            y: patch.y,
            rotation: patch.rotation,
            scale: patch.scale,
          };
          if (patch.x != null && patch.y != null) {
            mapped.section_id = nearestSectionId(patch.x, patch.y, sections);
          }
          queue(id, mapped);
        }}
        onDragStartItem={(id) => gravity.setDragging(id)}
        onDragMoveItem={(id, x, y) => gravity.syncDragPose(id, x, y)}
        onDragEndItem={(id, x, y) => {
          gravity.setDragging(null);
          const sectionId = nearestSectionId(x, y, sections);
          queue(id, { x, y, section_id: sectionId });
          void gravity.kickSettle();
        }}
      />

      {selected && !owner && board.wishlist_enabled ? (
        <aside className="user-inspector">
          <p className="lede">{selected.title || 'Item'}</p>
          {selectedClaimed ? (
            <p className="hint">Claimed.</p>
          ) : (
            <>
              <label className="field">
                <span>Your name (optional)</span>
                <input value={claimName} onChange={(event) => setClaimName(event.target.value)} />
              </label>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  void claimItem(board.id, selected.id, claimName, auth.user?.id ?? null, token || undefined)
                    .then(() => setClaims((list) => [
                      ...list,
                      {
                        id: crypto.randomUUID(),
                        item_id: selected.id,
                        board_id: board.id,
                        claimed_by: claimName,
                        claimer_id: auth.user?.id ?? null,
                        created_at: new Date().toISOString(),
                      },
                    ]))
                    .catch((err) => setError(err instanceof Error ? err.message : 'Could not claim.'));
                }}
              >
                Claim
              </button>
            </>
          )}
        </aside>
      ) : null}

      {!owner && board.suggestions_enabled && board.visibility === 'public' ? (
        <form
          className="user-suggest"
          onSubmit={(event) => {
            event.preventDefault();
            void suggestItem(board.id, {
              url: suggestUrl.trim(),
              title: suggestNote.trim() || suggestUrl.trim() || 'Suggestion',
              price: null,
              currency: 'EUR',
              image_url: null,
              note: suggestNote.trim(),
              suggested_by: auth.email ?? '',
              suggester_id: auth.user?.id ?? null,
            }).then(() => {
              setSuggestNote('');
              setSuggestUrl('');
            });
          }}
        >
          <label className="field">
            <span>Suggest a gift</span>
            <input
              value={suggestNote}
              onChange={(event) => setSuggestNote(event.target.value)}
              placeholder="Title or idea"
            />
          </label>
          <label className="field">
            <span>URL (optional)</span>
            <input
              value={suggestUrl}
              onChange={(event) => setSuggestUrl(event.target.value)}
              placeholder="https://"
            />
          </label>
          <button className="btn" type="submit" disabled={!suggestNote.trim() && !suggestUrl.trim()}>
            Send
          </button>
        </form>
      ) : null}

      {board.visibility !== 'private' ? (
        <p className="affiliate-disclosure">This board may contain affiliate links. We may earn a commission.</p>
      ) : null}

      {cutoutSession ? (
        <CutoutEditor
          session={cutoutSession}
          doneLabel="Save cutout"
          onDone={() => void saveCutout()}
          onCancel={() => setCutoutSession(null)}
        />
      ) : null}

      <AddUserItemDialog
        open={addOpen}
        busy={adding}
        accessToken={auth.session?.access_token ?? null}
        sections={sections}
        defaultSectionId={addSectionId}
        onClose={() => {
          setAddOpen(false);
          setAddSectionId(null);
        }}
        onSubmit={onAdd}
      />
      {shareOpen && ownerName ? (
        <ShareBoardDialog
          board={board}
          username={ownerName}
          onClose={() => setShareOpen(false)}
          onVisibility={async (visibility: BoardVisibility) => {
            const next = await updateBoard(board.id, { visibility });
            setBoard(next);
          }}
          onFlags={async (patch) => {
            const next = await updateBoard(board.id, patch);
            setBoard(next);
          }}
          onRotate={async () => {
            const nextToken = await rotateShareToken(board.id);
            setBoard((current) =>
              current ? { ...current, visibility: 'unlisted', share_token: nextToken } : current,
            );
            return nextToken;
          }}
        />
      ) : null}
    </div>
  );
}

function itemImageSrcSafe(item: UserBoardItem): boolean {
  return Boolean(item.image_path || item.source_image_url);
}

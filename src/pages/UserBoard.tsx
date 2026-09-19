import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DEFAULT_KNOLL_GAP, DEFAULT_KNOLL_ROTATION } from '../../shared/constants.ts';
import { AddUserItemDialog } from '../components/AddUserItemDialog.tsx';
import { Board } from '../components/Board.tsx';
import { ShareBoardDialog } from '../components/ShareBoardDialog.tsx';
import { useAuth } from '../hooks/useAuth.ts';
import { useGravitySettle } from '../hooks/useGravitySettle.ts';
import { useBoardZoom } from '../hooks/useSiteSettings.ts';
import { openAffiliate } from '../lib/images.ts';
import { fetchPublicProfile } from '../lib/profile.ts';
import { toCanvasItem, userWells } from '../lib/userBoardMap.ts';
import type { NewItemInput } from '../components/AddUserItemDialog.tsx';
import {
  addItem,
  addSection,
  claimItem,
  deleteItem,
  deleteSection,
  loadBoardBySlug,
  loadSharedBoard,
  nearestSectionId,
  suggestItem,
  updateBoard,
  updateItem,
  updateSection,
  rotateShareToken,
  type BoardVisibility,
  type UserBoard,
  type UserBoardClaim,
  type UserBoardItem,
  type UserBoardSection,
} from '../lib/userBoards.ts';

type SaveState = 'saved' | 'saving' | 'error';

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
  const [shareOpen, setShareOpen] = useState(false);
  const [adding, setAdding] = useState(false);
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
    gap: DEFAULT_KNOLL_GAP,
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
      const created = await addItem(board.id, {
        ...input,
        x: input.x ?? (sections[0]?.x ?? 1200),
        y: input.y ?? (sections[0]?.y ?? 900),
        section_id: input.section_id ?? sections[0]?.id ?? null,
      });
      setItems((list) => [...list, created]);
    } finally {
      setAdding(false);
    }
  }

  async function onAddSection() {
    if (!board) return;
    const created = await addSection(board.id, {
      title: `section ${sections.length + 1}`,
      y: 900 + sections.length * 800,
      sort_order: sections.length,
    });
    setSections((list) => [...list, created]);
  }

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const selectedClaimed = claims.some((claim) => claim.item_id === selectedId);

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
      <header className="account-bar">
        <Link className="account-bar-brand" to={username ? `/u/${ownerName}` : '/me'}>
          {ownerName} / {board.slug}
        </Link>
        <div className="account-bar-actions">
          <span className="account-bar-meta">
            {save === 'saving' ? 'Saving…' : save === 'error' ? 'Save failed' : 'Saved'}
          </span>
          {owner ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => void onAddSection()}>
                Add section
              </button>
              <button type="button" className="btn" onClick={() => setAddOpen(true)}>
                Add item
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setShareOpen(true)}>
                Share
              </button>
            </>
          ) : (
            <Link className="btn btn-ghost" to="/login">
              Sign in
            </Link>
          )}
        </div>
      </header>

      {owner && sections.length > 0 ? (
        <div className="user-section-rail">
          {sections.map((section) => (
            <label key={section.id} className="user-section-chip">
              <input
                value={section.title}
                onChange={(event) => {
                  const title = event.target.value;
                  setSections((list) => list.map((row) => (row.id === section.id ? { ...row, title } : row)));
                  void updateSection(section.id, { title });
                }}
              />
              <button type="button" className="text-btn" onClick={() => {
                void deleteSection(section.id);
                setSections((list) => list.filter((row) => row.id !== section.id));
              }}>
                ×
              </button>
            </label>
          ))}
        </div>
      ) : null}

      <Board
        items={canvasItems}
        mode={owner ? 'admin' : 'public'}
        zoom={zoom}
        selectedId={selectedId}
        wells={owner ? wells : []}
        onSelect={(id) => {
          setSelectedId(id);
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

      {selected && owner ? (
        <aside className="user-inspector">
          <label className="field">
            <span>Title</span>
            <input
              value={selected.title}
              onChange={(event) => queue(selected.id, { title: event.target.value })}
            />
          </label>
          <label className="field">
            <span>URL</span>
            <input value={selected.url} onChange={(event) => queue(selected.id, { url: event.target.value })} />
          </label>
          <div className="btn-row">
            <button type="button" className="btn btn-danger" onClick={() => {
              void deleteItem(selected.id);
              setItems((list) => list.filter((row) => row.id !== selected.id));
              setSelectedId(null);
            }}>
              Remove
            </button>
          </div>
        </aside>
      ) : null}

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

      <AddUserItemDialog
        open={addOpen}
        busy={adding}
        accessToken={auth.session?.access_token ?? null}
        sections={sections}
        onClose={() => setAddOpen(false)}
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

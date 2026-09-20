import { useState, type FormEvent } from 'react';
import { CANVAS_WIDTH } from '../../shared/constants.ts';
import { boardScale, viewportCenterOnCanvas } from '../lib/canvas.ts';
import {
  addSection,
  deleteSection,
  updateSection,
  type UserBoardSection,
} from '../lib/userBoards.ts';
import { resolveWellY, MIN_WELL_GAP } from '../lib/wells.ts';
import { PackTightnessField } from './PackTightnessField.tsx';

type Props = {
  boardId: string;
  sections: UserBoardSection[];
  onChange: (sections: UserBoardSection[]) => void;
  zoom?: number;
  arrangingId?: string | null;
  onRearrange?: (section: UserBoardSection) => void;
  knollGap?: number;
  onKnollGapChange?: (gap: number) => void;
  onKnollGapCommit?: (gap: number) => void;
};

function IconUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 11V3M3.5 6.5 7 3l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 3v8M3.5 7.5 7 11l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconRearrange() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="4" cy="4" r="1.4" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="10" cy="5" r="1.4" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="6.5" cy="10" r="1.4" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M3 4h8M5 4V3h4v1M4.5 4l.4 7h4.2l.4-7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UserSectionPanel({
  boardId,
  sections,
  onChange,
  zoom = 1,
  arrangingId = null,
  onRearrange,
  knollGap,
  onKnollGapChange,
  onKnollGapCommit,
}: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [spacing, setSpacing] = useState(false);
  const [moveId, setMoveId] = useState<string | null>(null);

  const ranked = [...sections].sort((a, b) => a.y - b.y || a.sort_order - b.sort_order);

  function currentY() {
    const scale = boardScale(window.innerWidth, zoom);
    return viewportCenterOnCanvas(scale, window.scrollY, window.innerHeight).y;
  }

  function freeY(excludeId?: string) {
    const occupied = sections.filter((row) => row.id !== excludeId).map((row) => row.y);
    return resolveWellY(currentY(), occupied);
  }

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    const label = name.trim();
    if (!label) return;
    setError(null);
    try {
      const created = await addSection(boardId, {
        title: label,
        x: CANVAS_WIDTH / 2,
        y: freeY(),
        sort_order: sections.length,
      });
      onChange([...sections, created].sort((a, b) => a.y - b.y));
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the section.');
    }
  }

  async function onSpaceEvenly() {
    if (sections.length < 2) return;
    setError(null);
    setSpacing(true);
    try {
      const sorted = [...sections].sort((a, b) => a.y - b.y);
      const first = sorted[0]!.y;
      const last = sorted[sorted.length - 1]!.y;
      const span = Math.max(last - first, (sorted.length - 1) * MIN_WELL_GAP);
      const step = span / (sorted.length - 1);
      const next = await Promise.all(
        sorted.map(async (section, index) => {
          const y = first + step * index;
          await updateSection(section.id, { y, x: CANVAS_WIDTH / 2 });
          return { ...section, y, x: CANVAS_WIDTH / 2, sort_order: index };
        }),
      );
      onChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not space scenes.');
    } finally {
      setSpacing(false);
    }
  }

  async function moveSection(section: UserBoardSection, direction: -1 | 1) {
    const index = ranked.findIndex((row) => row.id === section.id);
    const neighbor = ranked[index + direction];
    if (!neighbor) return;
    setError(null);
    setMoveId(section.id);
    try {
      const aY = neighbor.y;
      const bY = section.y;
      await Promise.all([
        updateSection(section.id, { y: aY, x: CANVAS_WIDTH / 2 }),
        updateSection(neighbor.id, { y: bY, x: CANVAS_WIDTH / 2 }),
      ]);
      onChange(
        sections.map((row) => {
          if (row.id === section.id) return { ...row, y: aY, x: CANVAS_WIDTH / 2 };
          if (row.id === neighbor.id) return { ...row, y: bY, x: CANVAS_WIDTH / 2 };
          return row;
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not move the section.');
    } finally {
      setMoveId(null);
    }
  }

  return (
    <div className="inspector-block">
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>Sections</h2>
      <p className="hint" style={{ margin: '0 0 12px' }}>
        Each scene has one gravity well. Move swaps order; Space evenly restores equal gaps; Rearrange
        knolls items around the well.
      </p>
      {knollGap != null && onKnollGapChange ? (
        <div style={{ margin: '0 0 16px' }}>
          <PackTightnessField
            value={knollGap}
            onChange={onKnollGapChange}
            onCommit={onKnollGapCommit}
          />
        </div>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      <form onSubmit={(event) => void onAdd(event)}>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="kitchen" />
        </label>
        <div className="btn-row">
          <button className="btn" type="submit" disabled={!name.trim()}>
            Add at this view
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={spacing || sections.length < 2}
            onClick={() => void onSpaceEvenly()}
          >
            {spacing ? 'Spacing…' : 'Space evenly'}
          </button>
        </div>
      </form>
      <div className="section-admin-list">
        {ranked.map((section, index) => {
          const busy = moveId === section.id || arrangingId === section.id;
          return (
            <div key={section.id} className="section-admin-card">
              <input
                aria-label="Section name"
                value={section.title}
                onChange={(event) => {
                  const title = event.target.value;
                  onChange(sections.map((row) => (row.id === section.id ? { ...row, title } : row)));
                }}
                onBlur={(event) => {
                  const title = event.currentTarget.value.trim() || 'untitled';
                  onChange(sections.map((row) => (row.id === section.id ? { ...row, title } : row)));
                  void updateSection(section.id, { title });
                }}
              />
              <div className="section-admin-card-actions">
                <button
                  type="button"
                  className="section-admin-icon-btn"
                  aria-label={`Move ${section.title} up`}
                  title="Move up"
                  disabled={busy || index === 0}
                  onClick={() => void moveSection(section, -1)}
                >
                  <IconUp />
                </button>
                <button
                  type="button"
                  className="section-admin-icon-btn"
                  aria-label={`Move ${section.title} down`}
                  title="Move down"
                  disabled={busy || index >= ranked.length - 1}
                  onClick={() => void moveSection(section, 1)}
                >
                  <IconDown />
                </button>
                {onRearrange ? (
                  <button
                    type="button"
                    className="section-admin-icon-btn"
                    aria-label={`Rearrange ${section.title}`}
                    title="Rearrange"
                    disabled={busy}
                    onClick={() => onRearrange(section)}
                  >
                    <IconRearrange />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="section-admin-icon-btn is-danger"
                  aria-label={`Remove ${section.title}`}
                  title="Remove"
                  disabled={busy}
                  onClick={() => {
                    void deleteSection(section.id).then(() => {
                      onChange(sections.filter((row) => row.id !== section.id));
                    });
                  }}
                >
                  <IconTrash />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

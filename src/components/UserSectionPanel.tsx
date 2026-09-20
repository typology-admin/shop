import { useState, type FormEvent } from 'react';
import { CANVAS_WIDTH } from '../../shared/constants.ts';
import { boardScale, viewportCenterOnCanvas } from '../lib/canvas.ts';
import {
  addSection,
  deleteSection,
  updateSection,
  type UserBoardSection,
} from '../lib/userBoards.ts';
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

  function currentY() {
    const scale = boardScale(window.innerWidth, zoom);
    return viewportCenterOnCanvas(scale, window.scrollY, window.innerHeight).y;
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
        y: currentY(),
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
      const span = Math.max(last - first, (sorted.length - 1) * 800);
      const step = span / (sorted.length - 1);
      const next = await Promise.all(
        sorted.map(async (section, index) => {
          const y = first + step * index;
          await updateSection(section.id, { y, x: CANVAS_WIDTH / 2 });
          return { ...section, y, x: CANVAS_WIDTH / 2 };
        }),
      );
      onChange(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not space scenes.');
    } finally {
      setSpacing(false);
    }
  }

  return (
    <div className="inspector-block">
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>Sections</h2>
      <p className="hint" style={{ margin: '0 0 12px' }}>
        Each scene has one gravity well. Set here moves it to this view; Space evenly restores equal
        gaps; Rearrange knolls items around the well.
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
      {sections.map((section) => (
        <div key={section.id} className="section-admin-row">
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
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                const y = currentY();
                onChange(sections.map((row) => (row.id === section.id ? { ...row, y } : row)));
                void updateSection(section.id, { y, x: CANVAS_WIDTH / 2 });
              }}
            >
              Set here
            </button>
            {onRearrange ? (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={arrangingId === section.id}
                onClick={() => onRearrange(section)}
              >
                {arrangingId === section.id ? 'Rearranging…' : 'Rearrange'}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                void deleteSection(section.id).then(() => {
                  onChange(sections.filter((row) => row.id !== section.id));
                });
              }}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

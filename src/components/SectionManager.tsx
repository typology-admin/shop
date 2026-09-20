import { useState, type FormEvent } from 'react';
import { boardScale, viewportCenterOnCanvas } from '../lib/canvas.ts';
import {
  deleteBoardSection,
  insertBoardSection,
  spaceBoardSectionsEvenly,
  updateBoardSection,
  type BoardSection,
} from '../lib/sections.ts';

type Props = {
  sections: BoardSection[];
  onChange: (sections: BoardSection[]) => void;
  zoom?: number;
  arrangingId?: string | null;
  onRearrange?: (section: BoardSection) => void;
};

export function SectionManager({
  sections,
  onChange,
  zoom = 1,
  arrangingId = null,
  onRearrange,
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
      const created = await insertBoardSection({
        name: label,
        y: currentY(),
        sortOrder: sections.length,
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
      const next = await spaceBoardSectionsEvenly(sections);
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
        Each scene has one gravity well at its vertical center, locked to the window’s horizontal
        center. Set here moves the scene; Space evenly restores equal gaps; Rearrange knolls objects
        around its well.
      </p>
      {error ? <p className="form-error">{error}</p> : null}
      <form onSubmit={(event) => void onAdd(event)}>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="new arrivals" />
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
            value={section.name}
            onChange={(event) => {
              const next = event.target.value;
              onChange(sections.map((row) => (row.id === section.id ? { ...row, name: next } : row)));
            }}
            onBlur={(event) => {
              const nextName = event.currentTarget.value.trim() || 'untitled';
              onChange(sections.map((row) => (row.id === section.id ? { ...row, name: nextName } : row)));
              void updateBoardSection(section, { name: nextName });
            }}
          />
          {section.items.length ? (
            <p className="hint" style={{ margin: 0 }}>
              {section.items.map((item) => `${item.emoji} ${item.label}`).join(' · ')}
            </p>
          ) : null}
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                const y = currentY();
                onChange(sections.map((row) => (row.id === section.id ? { ...row, y } : row)));
                void updateBoardSection(section, { y });
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
                void deleteBoardSection(section).then(() => {
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

import { useState, type FormEvent } from 'react';
import { CANVAS_WIDTH } from '../../shared/constants.ts';
import { viewportCenterOnCanvas } from '../lib/canvas.ts';
import {
  deleteBoardSection,
  insertBoardSection,
  updateBoardSection,
  type BoardSection,
} from '../lib/sections.ts';

type Props = {
  sections: BoardSection[];
  onChange: (sections: BoardSection[]) => void;
};

export function SectionManager({ sections, onChange }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function currentY() {
    const scale = window.innerWidth / CANVAS_WIDTH;
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

  return (
    <div className="inspector-block">
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>Sections</h2>
      <p className="hint" style={{ margin: '0 0 12px' }}>
        Named page hooks on the shop board. Add one at the current scroll position.
      </p>
      {error ? <p className="form-error">{error}</p> : null}
      <form onSubmit={(event) => void onAdd(event)}>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="new arrivals" />
        </label>
        <button className="btn" type="submit" disabled={!name.trim()}>
          Add at this view
        </button>
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

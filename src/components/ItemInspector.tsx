import { useState } from 'react';
import { MAX_SCALE, MIN_SCALE } from '../../shared/constants.ts';
import { beginCutout, finalizeCutout, type CutoutSession, type PreparedImage } from '../lib/cutout.ts';
import { fetchImageBlob } from '../lib/images.ts';
import type { BoardSection } from '../lib/sections.ts';
import { parseTags, tagsToInput } from '../lib/tags.ts';
import type { Item, ItemPatch } from '../lib/types.ts';
import { CutoutEditor } from './CutoutEditor.tsx';

type Props = {
  item: Item;
  sections: BoardSection[];
  onPatch: (patch: ItemPatch, commit?: boolean) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onDelete: () => void;
  onReplaceImage: (prepared: PreparedImage) => Promise<void>;
};

export function ItemInspector({
  item,
  sections,
  onPatch,
  onBringToFront,
  onSendToBack,
  onDelete,
  onReplaceImage,
}: Props) {
  const [session, setSession] = useState<CutoutSession | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openCutout() {
    setError(null);
    setWorking('Loading photo…');
    try {
      const blob = await fetchImageBlob(item.image_path);
      const next = await beginCutout(blob, 'item.png');
      setSession(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open that cutout.');
    } finally {
      setWorking(null);
    }
  }

  async function saveCutout() {
    if (!session) return;
    setWorking('Saving cutout…');
    try {
      const prepared = await finalizeCutout(session);
      await onReplaceImage(prepared);
      setSession(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the cutout.');
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="inspector-block">
      <h2>{item.title || 'Untitled object'}</h2>

      <label className="field">
        <span>Title</span>
        <input
          type="text"
          value={item.title}
          onChange={(event) => onPatch({ title: event.target.value }, false)}
          onBlur={(event) => onPatch({ title: event.target.value }, true)}
        />
      </label>

      <label className="field">
        <span>Store</span>
        <input
          type="text"
          value={item.store}
          onChange={(event) => onPatch({ store: event.target.value }, false)}
          onBlur={(event) => onPatch({ store: event.target.value }, true)}
        />
      </label>

      <label className="field">
        <span>Affiliate URL</span>
        <input
          type="url"
          value={item.affiliate_url}
          onChange={(event) => onPatch({ affiliate_url: event.target.value }, false)}
          onBlur={(event) => onPatch({ affiliate_url: event.target.value }, true)}
        />
      </label>

      <label className="field">
        <span>Tags</span>
        <input
          type="text"
          value={tagsToInput(item.tags ?? [])}
          placeholder="leather, boot, desk"
          onChange={(event) => onPatch({ tags: parseTags(event.target.value) }, false)}
          onBlur={(event) => onPatch({ tags: parseTags(event.target.value) }, true)}
        />
      </label>

      {sections.length > 0 ? (
        <label className="field">
          <span>Attracted to</span>
          <select
            value={item.section_id ?? ''}
            onChange={(event) => {
              const next = event.target.value || null;
              onPatch({ section_id: next }, true);
            }}
          >
            <option value="">Nearest scene</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
          <p className="field-hint">Gravity pulls this object toward that scene’s well.</p>
        </label>
      ) : null}

      <label className="range-field">
        <header>
          <span>Scale</span>
          <span>{item.scale.toFixed(2)}</span>
        </header>
        <input
          type="range"
          min={MIN_SCALE}
          max={MAX_SCALE}
          step={0.01}
          value={item.scale}
          onChange={(event) =>
            onPatch({ scale: Number(event.target.value) }, false)
          }
          onInput={(event) =>
            onPatch({ scale: Number((event.target as HTMLInputElement).value) }, false)
          }
          onMouseUp={(event) =>
            onPatch({ scale: Number((event.target as HTMLInputElement).value) }, true)
          }
          onTouchEnd={(event) =>
            onPatch({ scale: Number((event.currentTarget as HTMLInputElement).value) }, true)
          }
          onKeyUp={() => onPatch({ scale: item.scale }, true)}
        />
      </label>

      <label className="range-field">
        <header>
          <span>Rotation</span>
          <span>{Math.round(item.rotation)}°</span>
        </header>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={item.rotation}
          onChange={(event) =>
            onPatch({ rotation: Number(event.target.value) }, false)
          }
          onInput={(event) =>
            onPatch({ rotation: Number((event.target as HTMLInputElement).value) }, false)
          }
          onMouseUp={(event) =>
            onPatch({ rotation: Number((event.target as HTMLInputElement).value) }, true)
          }
          onTouchEnd={(event) =>
            onPatch({ rotation: Number((event.currentTarget as HTMLInputElement).value) }, true)
          }
          onKeyUp={() => onPatch({ rotation: item.rotation }, true)}
        />
      </label>

      <div className="btn-row">
        <button type="button" className="btn btn-ghost" onClick={() => void openCutout()} disabled={Boolean(working)}>
          {working ?? 'Edit cutout'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onBringToFront}>
          Bring front
        </button>
        <button type="button" className="btn btn-ghost" onClick={onSendToBack}>
          Send back
        </button>
        <button type="button" className="btn btn-danger" onClick={onDelete}>
          Delete
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}

      {session ? (
        <CutoutEditor
          session={session}
          doneLabel="Save cutout"
          onDone={() => void saveCutout()}
          onCancel={() => setSession(null)}
        />
      ) : null}
    </div>
  );
}

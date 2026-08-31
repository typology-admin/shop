import { MAX_SCALE, MIN_SCALE } from '../../shared/constants.ts';
import type { Item, ItemPatch } from '../lib/types.ts';

type Props = {
  item: Item;
  onPatch: (patch: ItemPatch, commit?: boolean) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onDelete: () => void;
};

export function ItemInspector({
  item,
  onPatch,
  onBringToFront,
  onSendToBack,
  onDelete,
}: Props) {
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
    </div>
  );
}

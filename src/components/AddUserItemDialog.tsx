import { useState, type FormEvent } from 'react';
import { removeBackground } from '../lib/bgRemove.ts';
import { fetchProductDraft } from '../lib/productFetch.ts';
import { uploadPng } from '../lib/items.ts';
import type { UserBoardItem, UserBoardSection } from '../lib/userBoards.ts';

export type NewItemInput = Partial<UserBoardItem> & { title: string };

type Props = {
  open: boolean;
  busy: boolean;
  accessToken: string | null;
  sections: UserBoardSection[];
  onClose: () => void;
  onSubmit: (input: NewItemInput) => Promise<void>;
};

export function AddUserItemDialog({ open, busy, accessToken, sections, onClose, onSubmit }: Props) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [sourceImageUrl, setSourceImageUrl] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  if (!open) return null;

  function reset() {
    setUrl('');
    setTitle('');
    setPrice('');
    setCurrency('EUR');
    setSourceImageUrl('');
    setPreview(null);
    setFile(null);
    setWidth(0);
    setHeight(0);
    setError(null);
    setWorking(null);
    setBlocked(false);
  }

  async function adoptBlob(blob: Blob, name: string) {
    setWorking('Removing background…');
    const prepared = await removeBackground(blob, name);
    setFile(prepared.file);
    setWidth(prepared.width);
    setHeight(prepared.height);
    setPreview(URL.createObjectURL(prepared.file));
  }

  async function onFetch(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBlocked(false);
    setWorking('Fetching…');
    try {
      const draft = await fetchProductDraft(url.trim(), accessToken);
      if (draft.title) setTitle(draft.title);
      if (draft.price != null) setPrice(String(draft.price));
      if (draft.currency) setCurrency(draft.currency);
      if (draft.imageUrl) setSourceImageUrl(draft.imageUrl);
      if (draft.blob) await adoptBlob(draft.blob, 'product.png');
      setBlocked(draft.blocked || !draft.blob);
      if (draft.blocked && !draft.blob) {
        setError('That shop blocked the fetch. Paste an image and title yourself.');
      }
    } catch (err) {
      setBlocked(true);
      setError(err instanceof Error ? err.message : 'Could not fetch that URL.');
    } finally {
      setWorking(null);
    }
  }

  async function onFile(next: File) {
    setError(null);
    setWorking('Preparing image…');
    try {
      await adoptBlob(next, next.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that image.');
    } finally {
      setWorking(null);
    }
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() && !url.trim()) {
      setError('Add a title or a URL.');
      return;
    }
    setError(null);
    try {
      let imagePath: string | null = null;
      let imageWidth = width;
      let imageHeight = height;
      if (file) {
        const uploaded = await uploadPng(file, accessToken);
        imagePath = uploaded.path;
        imageWidth = uploaded.width;
        imageHeight = uploaded.height;
      }
      await onSubmit({
        url: url.trim(),
        title: title.trim() || url.trim(),
        price: price.trim() ? Number(price) : null,
        currency: currency.trim() || 'EUR',
        image_path: imagePath,
        source_image_url: sourceImageUrl || null,
        image_width: imageWidth,
        image_height: imageHeight,
        section_id: sectionId || null,
      });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the item.');
    }
  }

  return (
    <div className="account-modal-backdrop" onClick={onClose}>
      <div className="account-modal" role="dialog" aria-label="Add item" onClick={(e) => e.stopPropagation()}>
        <p className="auth-kicker">Add item</p>
        <form onSubmit={(event) => void onFetch(event)}>
          <label className="field">
            <span>Product URL</span>
            <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" />
          </label>
          <button className="btn" type="submit" disabled={Boolean(working) || busy || !url.trim()}>
            {working === 'Fetching…' ? 'Fetching…' : 'Fetch'}
          </button>
        </form>
        {blocked ? (
          <p className="hint">Manual fallback: upload a photo and type the title and price.</p>
        ) : null}
        <form onSubmit={(event) => void onSave(event)}>
          <label className="field">
            <span>Title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <div className="btn-row">
            <label className="field" style={{ flex: 1 }}>
              <span>Price</span>
              <input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" />
            </label>
            <label className="field" style={{ width: 88 }}>
              <span>Currency</span>
              <input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
            </label>
          </div>
          {sections.length > 0 ? (
            <label className="field">
              <span>Section</span>
              <select value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
                <option value="">None</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="field">
            <span>Or upload / paste an image</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const next = event.target.files?.[0];
                if (next) void onFile(next);
              }}
            />
          </label>
          {preview ? <img className="account-preview" src={preview} alt="" /> : null}
          {error ? <p className="form-error">{error}</p> : null}
          {working ? <p className="hint">{working}</p> : null}
          <div className="btn-row">
            <button className="btn" type="submit" disabled={busy || Boolean(working)}>
              {busy ? 'Adding…' : 'Add to board'}
            </button>
            <button className="btn btn-ghost" type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

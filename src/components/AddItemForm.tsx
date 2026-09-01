import { useEffect, useRef, useState, type FormEvent } from 'react';
import { prepareItemImage, type PreparedImage } from '../lib/cutout.ts';
import { inferStore } from '../lib/images.ts';
import { fetchProductHero } from '../lib/productImage.ts';
import { PngDropzone } from './PngDropzone.tsx';

export type AddItemDraft = {
  title: string;
  affiliateUrl: string;
  store: string;
  file: File;
  width: number;
  height: number;
};

type Props = {
  busy: boolean;
  error: string | null;
  accessToken?: string | null;
  onSubmit: (draft: AddItemDraft) => Promise<void>;
};

export function AddItemForm({ busy, error, accessToken = null, onSubmit }: Props) {
  const [title, setTitle] = useState('');
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [store, setStore] = useState('');
  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const sourceRef = useRef<'upload' | 'url' | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    if (!prepared) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(prepared.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [prepared]);

  function clearImage() {
    generation.current += 1;
    sourceRef.current = null;
    setPrepared(null);
  }

  async function handleFile(next: File) {
    const id = (generation.current += 1);
    setLocalError(null);
    setWorking('Cutting background…');
    try {
      const image = await prepareItemImage(next, next.name);
      if (id !== generation.current) return;
      sourceRef.current = 'upload';
      setPrepared(image);
    } catch (err) {
      if (id !== generation.current) return;
      sourceRef.current = null;
      setPrepared(null);
      setLocalError(err instanceof Error ? err.message : 'Could not read that photo.');
    } finally {
      if (id === generation.current) setWorking(null);
    }
  }

  async function loadFromUrl(rawUrl: string, force = false): Promise<PreparedImage> {
    const url = rawUrl.trim();
    if (!url) throw new Error('Paste a product URL.');
    if (!force && sourceRef.current === 'upload' && prepared) return prepared;

    const id = (generation.current += 1);
    setLocalError(null);
    setWorking('Fetching product photo…');
    try {
      const hero = await fetchProductHero(url, accessToken);
      if (id !== generation.current) throw new Error('Cancelled.');
      setWorking('Cutting background…');
      const image = await prepareItemImage(hero.blob, 'product.png');
      if (id !== generation.current) throw new Error('Cancelled.');
      sourceRef.current = 'url';
      setPrepared(image);
      if (hero.title) {
        setTitle((current) => current.trim() || hero.title || '');
      }
      return image;
    } catch (err) {
      if (id !== generation.current) throw err;
      if (!prepared) sourceRef.current = null;
      throw err;
    } finally {
      if (id === generation.current) setWorking(null);
    }
  }

  async function handleUrlBlur() {
    if (busy || working) return;
    if (!affiliateUrl.trim()) return;
    if (sourceRef.current === 'upload' && prepared) return;
    try {
      await loadFromUrl(affiliateUrl);
    } catch (err) {
      if (err instanceof Error && err.message === 'Cancelled.') return;
      setLocalError(err instanceof Error ? err.message : 'Could not fetch a product image.');
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    if (!affiliateUrl.trim()) {
      setLocalError('Paste an affiliate URL.');
      return;
    }
    try {
      const image =
        prepared ?? (await loadFromUrl(affiliateUrl.trim(), true));
      await onSubmit({
        title: title.trim(),
        affiliateUrl: affiliateUrl.trim(),
        store: store.trim() || inferStore(affiliateUrl),
        file: image.file,
        width: image.width,
        height: image.height,
      });
      generation.current += 1;
      sourceRef.current = null;
      setTitle('');
      setAffiliateUrl('');
      setStore('');
      setPrepared(null);
    } catch (err) {
      if (err instanceof Error && err.message === 'Cancelled.') return;
      setLocalError(err instanceof Error ? err.message : 'Could not add item.');
    }
  }

  const message = localError ?? error;
  const locked = busy || Boolean(working);

  return (
    <form onSubmit={(event) => void handleSubmit(event)}>
      <PngDropzone
        disabled={locked}
        onFile={(next) => void handleFile(next)}
        onError={setLocalError}
      />
      {previewUrl && prepared ? (
        <div className="cutout-preview">
          <img src={previewUrl} alt="Cutout preview" />
          <p className="file-chip">
            <span>
              {prepared.width}×{prepared.height}
            </span>
            <button type="button" className="text-btn" onClick={clearImage} disabled={locked}>
              Remove
            </button>
          </p>
        </div>
      ) : null}

      <label className="field">
        <span>Affiliate URL</span>
        <input
          type="url"
          required
          placeholder="https://www.amazon.com/…"
          value={affiliateUrl}
          disabled={locked}
          onChange={(event) => {
            setAffiliateUrl(event.target.value);
            if (!store) setStore(inferStore(event.target.value));
          }}
          onBlur={() => void handleUrlBlur()}
        />
        <p className="field-hint">
          Paste an Amazon link to pick the hero photo automatically.
        </p>
      </label>

      <label className="field">
        <span>Title (admin only)</span>
        <input
          type="text"
          value={title}
          disabled={locked}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>

      <label className="field">
        <span>Store</span>
        <input
          type="text"
          placeholder="Amazon"
          value={store}
          disabled={locked}
          onChange={(event) => setStore(event.target.value)}
        />
      </label>

      {working ? <p className="form-status">{working}</p> : null}
      {message ? <p className="form-error">{message}</p> : null}

      <button className="btn" type="submit" disabled={locked}>
        {busy ? 'Placing…' : 'Place on board'}
      </button>
    </form>
  );
}

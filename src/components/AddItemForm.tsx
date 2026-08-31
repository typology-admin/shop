import { useState, type FormEvent } from 'react';
import { inferStore } from '../lib/images.ts';
import { inspectPngFile } from '../lib/pngClient.ts';
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
  onSubmit: (draft: AddItemDraft) => Promise<void>;
};

export function AddItemForm({ busy, error, onSubmit }: Props) {
  const [title, setTitle] = useState('');
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [store, setStore] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleFile(next: File) {
    setLocalError(null);
    try {
      await inspectPngFile(next);
      setFile(next);
    } catch (err) {
      setFile(null);
      setLocalError(err instanceof Error ? err.message : 'Could not read that PNG.');
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    if (!file) {
      setLocalError('Add a transparent PNG first.');
      return;
    }
    if (!affiliateUrl.trim()) {
      setLocalError('Paste an affiliate URL.');
      return;
    }
    try {
      const inspected = await inspectPngFile(file);
      await onSubmit({
        title: title.trim(),
        affiliateUrl: affiliateUrl.trim(),
        store: store.trim() || inferStore(affiliateUrl),
        file,
        width: inspected.width,
        height: inspected.height,
      });
      setTitle('');
      setAffiliateUrl('');
      setStore('');
      setFile(null);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not add item.');
    }
  }

  const message = localError ?? error;

  return (
    <form onSubmit={(event) => void handleSubmit(event)}>
      <PngDropzone
        disabled={busy}
        onFile={(next) => void handleFile(next)}
        onError={setLocalError}
      />
      {file ? (
        <p className="file-chip">
          <span>{file.name}</span>
          <button type="button" className="text-btn" onClick={() => setFile(null)}>
            Remove
          </button>
        </p>
      ) : null}

      <label className="field">
        <span>Affiliate URL</span>
        <input
          type="url"
          required
          placeholder="https://"
          value={affiliateUrl}
          disabled={busy}
          onChange={(event) => {
            setAffiliateUrl(event.target.value);
            if (!store) setStore(inferStore(event.target.value));
          }}
        />
      </label>

      <label className="field">
        <span>Title (admin only)</span>
        <input
          type="text"
          value={title}
          disabled={busy}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>

      <label className="field">
        <span>Store</span>
        <input
          type="text"
          placeholder="Amazon"
          value={store}
          disabled={busy}
          onChange={(event) => setStore(event.target.value)}
        />
      </label>

      {message ? <p className="form-error">{message}</p> : null}

      <button className="btn" type="submit" disabled={busy}>
        {busy ? 'Placing…' : 'Place on board'}
      </button>
    </form>
  );
}

import { useEffect, useState, type ClipboardEvent, type FormEvent } from 'react';
import { beginCutout, finalizeCutout, type CutoutSession } from '../lib/cutout.ts';
import { fetchProductDraft } from '../lib/productFetch.ts';
import { uploadPng } from '../lib/items.ts';
import type { UserBoardItem, UserBoardSection } from '../lib/userBoards.ts';
import { BusyOverlay } from './BusyOverlay.tsx';
import { CutoutEditor } from './CutoutEditor.tsx';

export type NewItemInput = Partial<UserBoardItem> & { title: string };

type Props = {
  open: boolean;
  busy: boolean;
  accessToken: string | null;
  sections: UserBoardSection[];
  defaultSectionId?: string | null;
  onClose: () => void;
  onSubmit: (input: NewItemInput) => Promise<void>;
};

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function AddUserItemDialog({
  open,
  busy,
  accessToken,
  sections,
  defaultSectionId = null,
  onClose,
  onSubmit,
}: Props) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [sourceImageUrl, setSourceImageUrl] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [sectionId, setSectionId] = useState(defaultSectionId ?? sections[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [session, setSession] = useState<CutoutSession | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add('account-modal-open');
    setSectionId(defaultSectionId ?? sections[0]?.id ?? '');
    return () => document.documentElement.classList.remove('account-modal-open');
  }, [open, defaultSectionId, sections]);

  if (!open) return null;

  function reset() {
    setUrl('');
    setTitle('');
    setSourceImageUrl('');
    setPreview(null);
    setFile(null);
    setWidth(0);
    setHeight(0);
    setError(null);
    setWorking(null);
    setBlocked(false);
    setSession(null);
    setEditorOpen(false);
  }

  async function adoptBlob(blob: Blob, name: string) {
    setWorking('Removing background…');
    const next = await beginCutout(blob, name);
    const prepared = await finalizeCutout(next);
    setSession(next);
    setFile(prepared.file);
    setWidth(prepared.width);
    setHeight(prepared.height);
    setPreview(URL.createObjectURL(prepared.file));
  }

  async function finishEditing() {
    if (!session) {
      setEditorOpen(false);
      return;
    }
    setWorking('Updating cutout…');
    try {
      const prepared = await finalizeCutout(session);
      setFile(prepared.file);
      setWidth(prepared.width);
      setHeight(prepared.height);
      setPreview(URL.createObjectURL(prepared.file));
      setEditorOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the cutout.');
    } finally {
      setWorking(null);
    }
  }

  async function runFetch(rawUrl: string) {
    const next = rawUrl.trim();
    if (!next || working || busy) return;
    setError(null);
    setBlocked(false);
    setWorking('Fetching…');
    try {
      const draft = await fetchProductDraft(next, accessToken);
      if (draft.title) setTitle(draft.title);
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

  function onFetch(event: FormEvent) {
    event.preventDefault();
    void runFetch(url);
  }

  function onUrlPaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text').trim();
    if (!looksLikeUrl(pasted)) return;
    event.preventDefault();
    setUrl(pasted);
    void runFetch(pasted);
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
        price: null,
        currency: 'EUR',
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
    <>
    <div
      className="account-modal-backdrop"
      onClick={(event) => {
        if (editorOpen) return;
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="account-modal busy-host" role="dialog" aria-label="Add item" onClick={(e) => e.stopPropagation()}>
        {working ? <BusyOverlay message={working} /> : null}
        <h2>Add item</h2>
        <form className="account-fetch" onSubmit={onFetch}>
          <label className="field">
            <span>Product URL</span>
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onPaste={onUrlPaste}
              placeholder="https://"
            />
          </label>
          <button className="btn" type="submit" disabled={Boolean(working) || busy || !url.trim()}>
            {working === 'Fetching…' ? 'Fetching…' : 'Fetch'}
          </button>
        </form>
        {blocked ? (
          <p className="hint">Manual fallback: upload a photo and type the title yourself.</p>
        ) : null}
        <form className="account-item-details" onSubmit={(event) => void onSave(event)}>
          <label className="field">
            <span>Title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
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
          {preview ? (
            <div className="cutout-preview">
              <img className="account-preview" src={preview} alt="" />
              {session ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={Boolean(working) || busy}
                  onClick={() => setEditorOpen(true)}
                >
                  Edit cutout
                </button>
              ) : null}
            </div>
          ) : null}
          {error ? <p className="form-error">{error}</p> : null}
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
    {editorOpen && session ? (
      <CutoutEditor
        session={session}
        doneLabel="Done"
        onDone={() => void finishEditing()}
        onCancel={() => setEditorOpen(false)}
      />
    ) : null}
    </>
  );
}

import { useEffect, useState, type FormEvent } from 'react';

type Props = {
  open: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (title: string) => Promise<void>;
};

export function CreateBoardDialog({ open, busy, error, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add('account-modal-open');
    return () => document.documentElement.classList.remove('account-modal-open');
  }, [open]);

  useEffect(() => {
    if (!open) setTitle('');
  }, [open]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next = title.trim();
    if (!next) return;
    await onSubmit(next);
  }

  return (
    <div className="account-modal-backdrop" onClick={onClose}>
      <div
        className="account-modal"
        role="dialog"
        aria-label="Create board"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>New board</h2>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <label className="field">
            <span>Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Kitchen, gifts, desk…"
              autoFocus
              required
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="btn-row">
            <button className="btn" type="submit" disabled={busy || !title.trim()}>
              {busy ? 'Creating…' : 'Create board'}
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

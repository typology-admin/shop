export const BOARD_THUMBNAIL_SUGGESTIONS = [
  '🏠',
  '🪑',
  '💡',
  '☕',
  '📚',
  '🎧',
  '🪴',
  '🖥',
  '🧳',
  '🍳',
  '🪞',
  '🕯',
  '🧥',
  '👟',
  '🧰',
  '🎨',
  '📷',
  '🖤',
] as const;

type Props = {
  value: string | null;
  busy?: boolean;
  onChange: (emoji: string | null) => void;
};

export function BoardThumbnailField({ value, busy = false, onChange }: Props) {
  const current = value?.trim() || null;

  return (
    <div className="inspector-block" style={{ marginTop: 22 }}>
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>Thumbnail</h2>
      <p className="hint" style={{ margin: '0 0 12px' }}>
        Emoji shown on your boards overview.
      </p>
      <div className="board-thumb-preview" aria-hidden={current ? undefined : true}>
        <span className="board-thumb-emoji">{current || '·'}</span>
      </div>
      <div className="board-thumb-suggestions" role="list">
        {BOARD_THUMBNAIL_SUGGESTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            role="listitem"
            className={`board-thumb-swatch${current === emoji ? ' is-active' : ''}`}
            disabled={busy}
            aria-label={`Use ${emoji}`}
            onClick={() => onChange(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
      <label className="field" style={{ marginTop: 12 }}>
        <span>Custom</span>
        <input
          value={current ?? ''}
          maxLength={8}
          disabled={busy}
          placeholder="pick or paste an emoji"
          onChange={(event) => {
            const next = event.target.value.trim();
            onChange(next || null);
          }}
        />
      </label>
      {current ? (
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => onChange(null)}
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}

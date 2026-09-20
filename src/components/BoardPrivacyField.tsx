import type { BoardVisibility } from '../lib/userBoards.ts';

type Props = {
  value: BoardVisibility;
  busy?: boolean;
  onChange: (visibility: BoardVisibility) => void;
};

const OPTIONS: Array<{ value: BoardVisibility; hint: string }> = [
  { value: 'private', hint: 'Only you' },
  { value: 'unlisted', hint: 'Link only' },
  { value: 'public', hint: 'On your profile' },
];

export function BoardPrivacyField({ value, busy = false, onChange }: Props) {
  return (
    <div className="inspector-block" style={{ marginTop: 22 }}>
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>Privacy</h2>
      <p className="hint" style={{ margin: '0 0 12px' }}>
        Who can open this board.
      </p>
      <div className="btn-row" style={{ flexWrap: 'wrap' }}>
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`btn ${value === option.value ? '' : 'btn-ghost'}`}
            disabled={busy}
            title={option.hint}
            onClick={() => onChange(option.value)}
          >
            {option.value}
          </button>
        ))}
      </div>
      <p className="hint" style={{ margin: '10px 0 0' }}>
        {OPTIONS.find((row) => row.value === value)?.hint ?? ''}
      </p>
    </div>
  );
}

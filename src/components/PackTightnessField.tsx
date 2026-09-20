import {
  DEFAULT_KNOLL_GAP,
  MAX_KNOLL_GAP,
  MIN_KNOLL_GAP,
} from '../../shared/constants.ts';

type Props = {
  value: number;
  onChange: (gap: number) => void;
  onCommit?: (gap: number) => void;
};

function clampGap(value: number): number {
  return Math.max(MIN_KNOLL_GAP, Math.min(MAX_KNOLL_GAP, Math.round(value)));
}

export function PackTightnessField({ value, onChange, onCommit }: Props) {
  const gap = clampGap(Number.isFinite(value) ? value : DEFAULT_KNOLL_GAP);
  const label =
    gap <= MIN_KNOLL_GAP + 8 ? 'tight' : gap >= MAX_KNOLL_GAP - 20 ? 'loose' : `${gap}px`;

  return (
    <div className="inspector-block">
      <h2 style={{ fontSize: 18, margin: '0 0 10px' }}>Pack tightness</h2>
      <p className="hint" style={{ margin: '0 0 12px' }}>
        How much air stays between silhouettes when gravity settles. Drag an object or hit Rearrange
        to apply.
      </p>
      <label className="range-field">
        <header>
          <span>Spacing</span>
          <span>{label}</span>
        </header>
        <input
          type="range"
          min={MIN_KNOLL_GAP}
          max={MAX_KNOLL_GAP}
          step={4}
          value={gap}
          onChange={(event) => {
            onChange(Number(event.target.value));
          }}
          onPointerUp={(event) => {
            onCommit?.(clampGap(Number((event.currentTarget as HTMLInputElement).value)));
          }}
          onBlur={(event) => {
            onCommit?.(clampGap(Number((event.currentTarget as HTMLInputElement).value)));
          }}
        />
        <p className="hint" style={{ margin: 0, display: 'flex', justifyContent: 'space-between' }}>
          <span>tight</span>
          <span>loose</span>
        </p>
      </label>
    </div>
  );
}

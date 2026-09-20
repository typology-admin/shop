import { DEFAULT_BOARD_COLOR } from '../../shared/constants.ts';

export const BOARD_COLOR_PRESETS = [
  { id: 'mid', label: 'mid grey', value: DEFAULT_BOARD_COLOR },
  { id: 'mist', label: 'mist', value: '#ececec' },
  { id: 'paper', label: 'paper', value: '#d6d6d6' },
  { id: 'stone', label: 'stone', value: '#a8a8a8' },
  { id: 'charcoal', label: 'charcoal', value: '#6b6b6b' },
  { id: 'ink', label: 'ink', value: '#222222' },
] as const;

type Props = {
  value: string;
  onChange: (color: string) => void;
  onCommit?: (color: string) => void;
};

function normalizeHex(value: string): string {
  const raw = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
  return DEFAULT_BOARD_COLOR;
}

export function BoardColorField({ value, onChange, onCommit }: Props) {
  const current = normalizeHex(value || DEFAULT_BOARD_COLOR);

  return (
    <div className="inspector-block">
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>Board color</h2>
      <p className="hint" style={{ margin: '0 0 12px' }}>
        Background behind the knoll. Default is `#bfbfbf`.
      </p>
      <div className="board-color-swatches" role="list">
        {BOARD_COLOR_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            role="listitem"
            className={`board-color-swatch${current === preset.value ? ' is-active' : ''}`}
            style={{ background: preset.value }}
            aria-label={preset.label}
            title={preset.label}
            onClick={() => {
              onChange(preset.value);
              onCommit?.(preset.value);
            }}
          />
        ))}
      </div>
      <label className="field">
        <span>Custom</span>
        <input
          type="color"
          value={current}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => onCommit?.(normalizeHex(event.target.value))}
        />
      </label>
    </div>
  );
}

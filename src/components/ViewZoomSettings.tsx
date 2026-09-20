import {
  MAX_SECTION_HOOKS_HIDE_MS,
  MAX_VIEW_ZOOM,
  MIN_SECTION_HOOKS_HIDE_MS,
  MIN_VIEW_ZOOM,
} from '../../shared/constants.ts';
import { useSiteSettings } from '../hooks/useSiteSettings.ts';
import { BoardColorField } from './BoardColorField.tsx';
import { PackTightnessField } from './PackTightnessField.tsx';

export function ViewZoomSettings({ onPackingCommit }: { onPackingCommit?: (gap: number) => void }) {
  const { settings, setSettings, save, error } = useSiteSettings();

  function commit() {
    void save(settings).catch(() => {
      /* keep local values; error is shown */
    });
  }

  return (
    <div className="inspector-block">
      <BoardColorField
        value={settings.boardColor}
        onChange={(boardColor) => setSettings({ ...settings, boardColor })}
        onCommit={(boardColor) => {
          const next = { ...settings, boardColor };
          setSettings(next);
          void save(next).catch(() => {
            /* keep local values; error is shown */
          });
        }}
      />
      <h2 style={{ fontSize: 18, margin: '22px 0 10px' }}>View zoom</h2>
      <p className="hint" style={{ margin: '0 0 12px' }}>
        100% fits the full board width. Higher values crop in from the sides so objects read larger.
      </p>
      {error ? <p className="form-error">{error}</p> : null}
      <label className="range-field">
        <header>
          <span>Desktop</span>
          <span>{Math.round(settings.desktopZoom * 100)}%</span>
        </header>
        <input
          type="range"
          min={MIN_VIEW_ZOOM}
          max={MAX_VIEW_ZOOM}
          step={0.05}
          value={settings.desktopZoom}
          onChange={(event) =>
            setSettings({ ...settings, desktopZoom: Number(event.target.value) })
          }
          onPointerUp={commit}
          onBlur={commit}
        />
      </label>
      <label className="range-field">
        <header>
          <span>Mobile</span>
          <span>{Math.round(settings.mobileZoom * 100)}%</span>
        </header>
        <input
          type="range"
          min={MIN_VIEW_ZOOM}
          max={MAX_VIEW_ZOOM}
          step={0.05}
          value={settings.mobileZoom}
          onChange={(event) =>
            setSettings({ ...settings, mobileZoom: Number(event.target.value) })
          }
          onPointerUp={commit}
          onBlur={commit}
        />
      </label>
      <h2 style={{ fontSize: 18, margin: '22px 0 10px' }}>Section labels</h2>
      <p className="hint" style={{ margin: '0 0 12px' }}>
        How long the scene names stay after you stop scrolling. Hovering the rail keeps them open.
      </p>
      <label className="range-field">
        <header>
          <span>Hide after</span>
          <span>{(settings.sectionHooksHideMs / 1000).toFixed(1)}s</span>
        </header>
        <input
          type="range"
          min={MIN_SECTION_HOOKS_HIDE_MS}
          max={MAX_SECTION_HOOKS_HIDE_MS}
          step={100}
          value={settings.sectionHooksHideMs}
          onChange={(event) =>
            setSettings({ ...settings, sectionHooksHideMs: Number(event.target.value) })
          }
          onPointerUp={(event) => {
            const next = {
              ...settings,
              sectionHooksHideMs: Number((event.currentTarget as HTMLInputElement).value),
            };
            setSettings(next);
            void save(next).catch(() => {
              /* keep local values; error is shown */
            });
          }}
          onBlur={(event) => {
            const next = {
              ...settings,
              sectionHooksHideMs: Number((event.currentTarget as HTMLInputElement).value),
            };
            setSettings(next);
            void save(next).catch(() => {
              /* keep local values; error is shown */
            });
          }}
        />
      </label>
      <PackTightnessField
        value={settings.knollGap}
        onChange={(knollGap) => setSettings({ ...settings, knollGap })}
        onCommit={(knollGap) => {
          const next = { ...settings, knollGap };
          setSettings(next);
          void save(next).catch(() => {
            /* keep local values; error is shown */
          });
          onPackingCommit?.(knollGap);
        }}
      />
      <label className="field" style={{ marginTop: 16 }}>
        <span>Gravity</span>
        <select
          value={settings.knollGravity ? 'on' : 'off'}
          onChange={(event) => {
            const next = { ...settings, knollGravity: event.target.value === 'on' };
            setSettings(next);
            void save(next).catch(() => {
              /* keep local values; error is shown */
            });
          }}
        >
          <option value="on">on — pull toward wells</option>
          <option value="off">off — separate only</option>
        </select>
      </label>
      <label className="field">
        <span>Rotation</span>
        <select
          value={settings.knollRotation}
          onChange={(event) => {
            const value = event.target.value;
            const knollRotation =
              value === 'radial' || value === 'none' ? value : 'grid';
            const next = { ...settings, knollRotation } as typeof settings;
            setSettings(next);
            void save(next).catch(() => {
              /* keep local values; error is shown */
            });
          }}
        >
          <option value="grid">grid — flip 0°/90° to pack tight</option>
          <option value="radial">radial — long axis toward well</option>
          <option value="none">off — keep current angle</option>
        </select>
      </label>
    </div>
  );
}

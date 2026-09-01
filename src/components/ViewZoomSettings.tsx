import { MAX_VIEW_ZOOM, MIN_VIEW_ZOOM } from '../../shared/constants.ts';
import { useSiteSettings } from '../hooks/useSiteSettings.ts';

export function ViewZoomSettings() {
  const { settings, setSettings, save, error } = useSiteSettings();

  function commit() {
    void save(settings).catch(() => {
      /* keep local values; error is shown */
    });
  }

  return (
    <div className="inspector-block">
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>View zoom</h2>
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
    </div>
  );
}

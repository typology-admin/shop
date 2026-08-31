type Props = {
  onAdd: () => void;
  email: string | null;
  isLocal: boolean;
  panelOpen: boolean;
  onTogglePanel: () => void;
  onSignOut: () => void;
};

export function AdminBar({
  onAdd,
  email,
  isLocal,
  panelOpen,
  onTogglePanel,
  onSignOut,
}: Props) {
  return (
    <header className="admin-bar">
      <a className="admin-bar-brand" href="/">
        Knoll
      </a>
      <span className="admin-bar-meta">
        {isLocal ? 'Local demo' : email}
      </span>
      <div className="admin-bar-actions">
        <button type="button" className="btn btn-ghost" onClick={onTogglePanel}>
          {panelOpen ? 'Hide tools' : 'Tools'}
        </button>
        <button type="button" className="btn" onClick={onAdd}>
          Add item
        </button>
        <button type="button" className="btn btn-ghost" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </header>
  );
}

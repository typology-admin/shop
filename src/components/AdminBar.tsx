import { AdminTabs } from './AdminTabs.tsx';

type Props = {
  variant?: 'shop' | 'network' | 'contact' | 'affiliates';
  email: string | null;
  isLocal: boolean;
  panelOpen?: boolean;
  onTogglePanel?: () => void;
  onAdd?: () => void;
  onSignOut: () => void;
};

export function AdminBar({
  variant = 'shop',
  email,
  isLocal,
  panelOpen,
  onTogglePanel,
  onAdd,
  onSignOut,
}: Props) {
  return (
    <header className="admin-bar">
      <a className="admin-bar-brand" href="/">
        typology network
      </a>
      <AdminTabs />
      <span className="admin-bar-meta">{isLocal ? 'Local demo' : email}</span>
      <div className="admin-bar-actions">
        {variant === 'shop' ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={onTogglePanel}>
              {panelOpen ? 'Hide tools' : 'Tools'}
            </button>
            <button type="button" className="btn" onClick={onAdd}>
              Add item
            </button>
          </>
        ) : null}
        <button type="button" className="btn btn-ghost" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </header>
  );
}

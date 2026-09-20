import type { ReactElement } from 'react';

type ToolsTab = 'item' | 'sections' | 'view' | 'inventory';

type Props = {
  active: ToolsTab | null;
  onSelect: (tab: ToolsTab) => void;
  itemActive?: boolean;
  onShare?: () => void;
};

function IconPlus() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 3.5v11M3.5 9h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M9 2.5 15.5 6 9 9.5 2.5 6 9 2.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M2.5 9.5 9 13l6.5-3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2.5 12.5 9 16l6.5-3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSliders() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3 5.5h12M3 12.5h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7" cy="5.5" r="2" fill="var(--paper)" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="11" cy="12.5" r="2" fill="var(--paper)" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="13.5" cy="4.5" r="1.75" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="4.5" cy="9" r="1.75" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="13.5" cy="13.5" r="1.75" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M6.1 8.1 11.9 5.4M6.1 9.9l5.8 2.7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconInventory() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M4 5.5h10M4 9h10M4 12.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const TABS: Array<{ id: ToolsTab; label: string; icon: () => ReactElement }> = [
  { id: 'item', label: 'Item', icon: IconPlus },
  { id: 'sections', label: 'Sections', icon: IconLayers },
  { id: 'view', label: 'View', icon: IconSliders },
];

export function AdminToolsRail({ active, onSelect, itemActive = false, onShare }: Props) {
  return (
    <div className="admin-panel-rail-stack">
      <nav className="admin-panel-rail" aria-label="Admin tools">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isOn = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={[
                'admin-panel-rail-btn',
                isOn ? 'is-active' : '',
                tab.id === 'item' && itemActive ? 'has-dot' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-label={tab.label}
              aria-pressed={isOn}
              title={tab.label}
              onClick={() => onSelect(tab.id)}
            >
              <Icon />
            </button>
          );
        })}
        {onShare ? (
          <button
            type="button"
            className="admin-panel-rail-btn"
            aria-label="Share"
            title="Share"
            onClick={onShare}
          >
            <IconShare />
          </button>
        ) : null}
      </nav>
      <button
        type="button"
        className={`admin-panel-rail-fab${active === 'inventory' ? ' is-active' : ''}`}
        aria-label="Inventory"
        aria-pressed={active === 'inventory'}
        title="Inventory"
        onClick={() => onSelect('inventory')}
      >
        <IconInventory />
      </button>
    </div>
  );
}

export type { ToolsTab };

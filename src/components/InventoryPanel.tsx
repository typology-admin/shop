type InventoryItem = {
  id: string;
  title: string;
};

type Props = {
  items: InventoryItem[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
};

export function InventoryPanel({ items, selectedId = null, onSelect }: Props) {
  const ranked = [...items].sort((a, b) =>
    (a.title || 'untitled').localeCompare(b.title || 'untitled', undefined, { sensitivity: 'base' }),
  );

  return (
    <div className="inspector-block">
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>Inventory</h2>
      <p className="hint" style={{ margin: '0 0 12px' }}>
        {ranked.length === 0 ? 'No items on this board yet.' : `${ranked.length} item${ranked.length === 1 ? '' : 's'}`}
      </p>
      {ranked.length > 0 ? (
        <ul className="inventory-list">
          {ranked.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`inventory-list-item${selectedId === item.id ? ' is-active' : ''}`}
                onClick={() => onSelect(item.id)}
              >
                {item.title.trim() || 'untitled'}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

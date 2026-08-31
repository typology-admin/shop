import { Board } from '../components/Board.tsx';
import { useItems } from '../hooks/useItems.ts';

export function PublicBoard() {
  const { items, status, error } = useItems();

  if (status === 'loading') {
    return (
      <div className="loading-screen">
        <div>
          <div className="loading-mark" />
          <h1 className="wordmark">Knoll</h1>
          <p className="lede">Laying out the board…</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="empty-screen">
        <div>
          <h1 className="wordmark">Knoll</h1>
          <p className="lede">{error ?? 'The board could not be loaded.'}</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="empty-screen">
        <div>
          <h1 className="wordmark">Knoll</h1>
          <p className="lede">Nothing laid out yet. The board is empty.</p>
        </div>
      </div>
    );
  }

  return <Board items={items} mode="public" />;
}

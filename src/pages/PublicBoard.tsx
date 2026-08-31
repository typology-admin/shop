import { Board } from '../components/Board.tsx';
import { SectionRail } from '../components/SectionRail.tsx';
import { SiteChrome } from '../components/SiteChrome.tsx';
import { useBoardSections } from '../hooks/useBoardSections.ts';
import { useItems } from '../hooks/useItems.ts';
import { useNetworkItems } from '../hooks/useNetworkItems.ts';

export function PublicBoard() {
  const { items, status, error } = useItems();
  const { items: networkItems } = useNetworkItems();
  const { sections } = useBoardSections();

  if (status === 'loading') {
    return (
      <div className="loading-screen">
        <SiteChrome variant="shop" shopItems={items} networkItems={networkItems} />
        <div>
          <div className="loading-mark" />
          <h1 className="wordmark wordmark-ui">typology network</h1>
          <p className="lede">Laying out the board…</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="empty-screen">
        <SiteChrome variant="shop" shopItems={items} networkItems={networkItems} />
        <div>
          <h1 className="wordmark wordmark-ui">typology network</h1>
          <p className="lede">{error ?? 'The board could not be loaded.'}</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="empty-screen">
        <SiteChrome variant="shop" shopItems={items} networkItems={networkItems} />
        <SectionRail sections={sections} />
        <div>
          <h1 className="wordmark wordmark-ui">typology network</h1>
          <p className="lede">Nothing laid out yet. The board is empty.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SiteChrome variant="shop" shopItems={items} networkItems={networkItems} />
      <SectionRail sections={sections} />
      <Board items={items} mode="public" />
    </>
  );
}

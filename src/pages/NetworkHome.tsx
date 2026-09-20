import { Link } from 'react-router-dom';
import { NetworkItemRow } from '../components/NetworkItemRow.tsx';
import { SiteChrome } from '../components/SiteChrome.tsx';
import { useNetworkItems } from '../hooks/useNetworkItems.ts';
import { visibleNetworkItems } from '../lib/network.ts';

export function NetworkHome() {
  const { items, status, error } = useNetworkItems();
  const visible = visibleNetworkItems(items);

  return (
    <div className="network-page">
      <SiteChrome variant="network" networkItems={items} />
      <main className="network-home">
        {status === 'error' ? (
          <p className="lede">{error ?? 'The network could not be loaded.'}</p>
        ) : (
          <div className="network-list">
            {visible.map((item, index) => (
              <NetworkItemRow key={item.id} item={item} index={index} />
            ))}
          </div>
        )}
      </main>
      <footer className="network-footer">
        <span>© {new Date().getFullYear()} typology.network®. All rights reserved.</span>
        <nav aria-label="Footer">
          <Link to="/network/about">About</Link>
          {' · '}
          <Link to="/privacy">Privacy</Link>
          {' · '}
          <Link to="/terms">Terms of Service</Link>
        </nav>
      </footer>
    </div>
  );
}

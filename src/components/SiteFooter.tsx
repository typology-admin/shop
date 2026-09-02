import { Link, useNavigate } from 'react-router-dom';
import { useContactLinks } from '../hooks/useContactLinks.ts';
import { openContactHref } from '../lib/contact.ts';

export function SiteFooter({ overlay = false }: { overlay?: boolean }) {
  const navigate = useNavigate();
  const { links } = useContactLinks();

  return (
    <footer className={overlay ? 'shop-footer is-overlay' : 'shop-footer'}>
      <span className="shop-footer-mark">®typology network 2026</span>
      <nav className="shop-footer-links" aria-label="Social">
        {links.map((link) => (
          <button
            key={link.id}
            type="button"
            className="shop-footer-link"
            onClick={() => openContactHref(link.href, navigate)}
          >
            {link.label}
          </button>
        ))}
        <Link className="shop-footer-link" to="/network">
          network
        </Link>
      </nav>
    </footer>
  );
}

import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  itemAriaLabel,
  type NetworkItem,
  visitNetworkItem,
} from '../lib/network.ts';

const TAGLINE =
  'is a framework for multiple project outlets under one grand ambition to execute ideas fast and as ambitious as possible with the help of ai';

function AnimatedTagline({ visible }: { visible: boolean }) {
  const words = TAGLINE.split(' ');
  return (
    <p className="network-tagline">
      {words.map((word, i) => (
        <Fragment key={`${word}-${i}`}>
          <span
            className="inline-block"
            style={{
              display: 'inline-block',
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(4px)',
              transition: visible
                ? `opacity 0.22s ease ${i * 32}ms, transform 0.22s ease ${i * 32}ms`
                : 'none',
            }}
          >
            {word}
          </span>
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </p>
  );
}

function DomainSuffixSpans({ item }: { item: NetworkItem }) {
  if (item.isMain) {
    return <span className="network-suffix-main">{item.suffix}</span>;
  }
  const token = 'typology';
  const i = item.suffix.indexOf(token);
  if (i < 0) {
    return <span className="network-suffix-light">{item.suffix}</span>;
  }
  return (
    <>
      <span className="network-suffix-light">{item.suffix.slice(0, i)}</span>
      <span className="network-suffix-token">{token}</span>
      <span className="network-suffix-light">{item.suffix.slice(i + token.length)}</span>
    </>
  );
}

function HoverPrefix({ item, hovered }: { item: NetworkItem; hovered: boolean }) {
  if (!hovered) {
    return item.isMain ? (
      <span className="network-prefix-main">{item.prefix}</span>
    ) : (
      <span className="network-prefix">{item.prefix}</span>
    );
  }
  if (item.hoverDisplayMode === 'icon_url' && item.hoverIconUrl) {
    return (
      <span className="network-hover-pop" style={{ display: 'inline-flex', width: 24, height: 24 }}>
        <img src={item.hoverIconUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%' }} />
      </span>
    );
  }
  if (item.hoverDisplayMode === 'emoji' && item.hoverEmoji) {
    return <span className="network-hover-pop">{item.hoverEmoji}</span>;
  }
  return item.isMain ? (
    <span className="network-prefix-main">{item.prefix}</span>
  ) : (
    <span className="network-prefix">{item.prefix}</span>
  );
}

export function NetworkItemRow({ item, index }: { item: NetworkItem; index: number }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const hasHoverDetails = Boolean(item.description.trim()) || item.isMain;
  const showDetails = hovered && hasHoverDetails;
  const showBg = Boolean(hovered && item.hoverBgImageUrl);

  return (
    <div
      className="network-row"
      style={{ animationDelay: `${index * 55 + 150}ms` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={`network-row-shell network-shell-${item.shellStyleIndex % 8}${showBg ? ' has-bg' : ''}`}
        style={
          showBg
            ? {
                backgroundImage: `linear-gradient(rgba(255,255,255,0.88), rgba(255,255,255,0.88)), url(${item.hoverBgImageUrl})`,
              }
            : undefined
        }
      >
        <button
          type="button"
          className="network-row-btn"
          aria-label={itemAriaLabel(item)}
          onClick={() => visitNetworkItem(item, navigate)}
        >
          <HoverPrefix item={item} hovered={hovered} />
          <DomainSuffixSpans item={item} />
        </button>
      </div>

      {hasHoverDetails ? (
        <div className={`network-details${showDetails ? ' is-open' : ''}`} aria-hidden={!showDetails}>
          <div className="network-details-inner">
            {item.description.trim() ? (
              <p className="network-desc">{item.description}</p>
            ) : null}
            {item.isMain && !item.description.trim() ? <AnimatedTagline visible={showDetails} /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

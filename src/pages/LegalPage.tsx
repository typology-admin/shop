import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SiteChrome } from '../components/SiteChrome.tsx';
import { SiteFooter } from '../components/SiteFooter.tsx';
import {
  LEGAL_EFFECTIVE_DATE,
  PRIVACY_SECTIONS,
  TERMS_SECTIONS,
  type LegalSection,
} from '../content/legal.ts';
import { useNetworkItems } from '../hooks/useNetworkItems.ts';

type Kind = 'terms' | 'privacy';

const COPY: Record<
  Kind,
  { title: string; summary: string; sections: LegalSection[]; docTitle: string }
> = {
  terms: {
    title: 'Terms of Service',
    summary: `Effective ${LEGAL_EFFECTIVE_DATE}. Please read carefully before using typology.network.`,
    sections: TERMS_SECTIONS,
    docTitle: 'terms — typology network',
  },
  privacy: {
    title: 'Privacy Policy',
    summary: `Effective ${LEGAL_EFFECTIVE_DATE}. How we process personal data under GDPR and California law.`,
    sections: PRIVACY_SECTIONS,
    docTitle: 'privacy — typology network',
  },
};

function Section({ section }: { section: LegalSection }) {
  return (
    <section className="legal-section" id={section.id}>
      <h2>{section.title}</h2>
      {section.paragraphs.map((text) => (
        <p key={text.slice(0, 48)}>{text}</p>
      ))}
      {section.bullets?.length ? (
        <ul>
          {section.bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function LegalPage({ kind }: { kind: Kind }) {
  const { items } = useNetworkItems();
  const copy = COPY[kind];

  useEffect(() => {
    document.title = copy.docTitle;
  }, [copy.docTitle]);

  return (
    <div className="network-page legal-page">
      <SiteChrome variant="network" networkItems={items} />
      <main className="site-subpage">
        <div className="site-subpage-prose">
          <p>
            <Link to="/">← typology network</Link>
            {' · '}
            <Link to={kind === 'terms' ? '/privacy' : '/terms'}>
              {kind === 'terms' ? 'Privacy Policy' : 'Terms of Service'}
            </Link>
          </p>
          <h1>{copy.title}</h1>
          <p className="site-subpage-lead">{copy.summary}</p>
          <p className="hint">
            This document is provided for transparency. It is not a substitute for legal advice
            tailored to your situation; we may update it as the product or law changes.
          </p>
          {copy.sections.map((section) => (
            <Section key={section.id} section={section} />
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

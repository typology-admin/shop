import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const CONSENT_KEY = 'typology-cookie-consent-v1';

export type CookieConsentChoice = 'essential' | 'all';

function readChoice(): CookieConsentChoice | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (raw === 'essential' || raw === 'all') return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeCookieConsent(choice: CookieConsentChoice) {
  try {
    localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event('typology-cookie-consent'));
}

export function getCookieConsent(): CookieConsentChoice | null {
  return readChoice();
}

/** GDPR / ePrivacy consent bar — essential always on; optional only after accept. */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readChoice() === null);

    function onChange() {
      setVisible(readChoice() === null);
    }
    window.addEventListener('typology-cookie-consent', onChange);
    return () => window.removeEventListener('typology-cookie-consent', onChange);
  }, []);

  if (!visible) return null;

  function choose(choice: CookieConsentChoice) {
    writeCookieConsent(choice);
    setVisible(false);
  }

  return (
    <div className="cookie-consent" role="dialog" aria-label="Cookie preferences">
      <div className="cookie-consent-inner">
        <p>
          We use necessary cookies for sign-in and security. Optional cookies (analytics) stay off
          unless you accept. See our{' '}
          <Link to="/privacy">Privacy Policy</Link> and <Link to="/terms">Terms</Link>.
        </p>
        <div className="cookie-consent-actions">
          <button type="button" className="btn btn-ghost" onClick={() => choose('essential')}>
            Necessary only
          </button>
          <button type="button" className="btn" onClick={() => choose('all')}>
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}

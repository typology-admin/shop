/** Static legal copy for typology.network. Have counsel review before relying on it as final advice. */

export const LEGAL_OPERATOR = 'typology.network';
export const LEGAL_CONTACT_EMAIL = 'info@typology.network';
export const LEGAL_EFFECTIVE_DATE = '20 September 2026';

export type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: 'agreement',
    title: '1. Agreement to these Terms',
    paragraphs: [
      `These Terms of Service (“Terms”) are a binding agreement between you and ${LEGAL_OPERATOR} (“we”, “us”, or “the Platform”). By accessing or using typology.network, creating an account, clicking “I agree”, or continuing to use the Platform after notice of updates, you agree to these Terms and our Privacy Policy.`,
      'If you do not agree, do not use the Platform. If you use the Platform on behalf of an organization, you represent that you have authority to bind that organization.',
    ],
  },
  {
    id: 'eligibility',
    title: '2. Eligibility and accounts',
    paragraphs: [
      'You must be at least 16 years old (or the higher age of digital consent in your EU/EEA member state) to create an account. If you are under 18, you may use the Platform only with a parent or guardian’s consent where required by law.',
      'You are responsible for your login credentials, magic-link emails, and OAuth accounts. Notify us promptly of unauthorized access. We may suspend or terminate accounts that violate these Terms.',
    ],
  },
  {
    id: 'trademark',
    title: '3. Trademark',
    paragraphs: [
      '“typology.network”, “typology network”, and related logos, wordmarks, and trade dress are trademarks of the Platform operator. You may not use them without prior written permission, except for accurate factual references that do not imply endorsement.',
    ],
  },
  {
    id: 'service',
    title: '4. The Platform',
    paragraphs: [
      'The Platform provides a curated visual board of product imagery, scene arrangements, affiliate links, optional user boards, and related tools. Features may change. We do not guarantee uninterrupted or error-free service.',
      'Product listings and links may lead to third-party retailers. We may earn affiliate commissions when you buy through those links. We are not the seller of those products unless expressly stated.',
    ],
  },
  {
    id: 'images',
    title: '5. Images and intellectual property of third parties',
    paragraphs: [
      'Images shown on the Platform are generally linked to, referenced from, or derived from third-party sources (including retailer product photos). The Platform does not claim ownership of third-party product images, trademarks, or product designs displayed on the board.',
      'Rights in those images remain with their respective owners. Display on typology.network is for editorial, referral, and affiliate-discovery purposes. If you believe material infringes your rights, contact us at the address below with enough detail for us to identify and act on the material.',
      'You retain rights in content you lawfully upload. By uploading, you grant us a worldwide, non-exclusive, royalty-free license to host, display, crop, convert, and distribute that content as needed to operate and improve the Platform, until you remove it or your account is deleted (subject to backups and legal retention).',
    ],
  },
  {
    id: 'prohibited',
    title: '6. Prohibited content and conduct (zero tolerance)',
    paragraphs: [
      'You may not upload, link, generate, or otherwise introduce on the Platform any images, text, or other material that depicts or promotes:',
    ],
    bullets: [
      'Weapons (including firearms, explosives, and realistic weapon imagery used as product or decorative content)',
      'Violence, gore, or graphic injury',
      'Sexual content, pornography, or other NSFW material',
      'Illegal drugs, controlled substances, or drug paraphernalia marketed for illicit use',
      'Hate, harassment, exploitation of minors, or any other illegal content',
      'Malware, scrapers that abuse the service, or attempts to bypass access controls',
    ],
  },
  {
    id: 'enforcement',
    title: '7. Enforcement',
    paragraphs: [
      'We may remove content, restrict features, or terminate accounts at our discretion when we believe these Terms or applicable law have been violated. Repeated or severe violations may result in permanent bans. We may report illegal activity to authorities when required or appropriate.',
    ],
  },
  {
    id: 'affiliates',
    title: '8. Affiliate and third-party links',
    paragraphs: [
      'Outbound product links may include affiliate tracking. Third-party sites have their own terms and privacy practices. We are not responsible for third-party products, pricing, availability, shipping, returns, or content.',
    ],
  },
  {
    id: 'disclaimers',
    title: '9. Disclaimers',
    paragraphs: [
      'THE PLATFORM IS PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT, TO THE MAXIMUM EXTENT PERMITTED BY LAW.',
      'Nothing in these Terms limits non-waivable consumer rights under EU/EEA/UK law or California law.',
    ],
  },
  {
    id: 'liability',
    title: '10. Limitation of liability',
    paragraphs: [
      'To the maximum extent permitted by law, we are not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, data, or goodwill, arising from your use of the Platform.',
      'Our aggregate liability for claims relating to the Platform in any twelve-month period will not exceed the greater of (a) the amounts you paid us for the Platform in that period, or (b) EUR 100 / USD 100, except where liability cannot be limited (including death or personal injury caused by negligence, fraud, or mandatory consumer protections).',
    ],
  },
  {
    id: 'indemnity',
    title: '11. Indemnity',
    paragraphs: [
      'You will defend and indemnify us against claims arising from your content, your misuse of the Platform, or your violation of these Terms or third-party rights, except to the extent caused by our willful misconduct.',
    ],
  },
  {
    id: 'eu-consumers',
    title: '12. EU/EEA and UK consumers',
    paragraphs: [
      'If you are a consumer in the EU/EEA or UK, mandatory local consumer protections apply. You may have a right to withdraw from distance contracts for paid digital services within 14 days where applicable; free browsing of the shop board does not require payment.',
      'Disputes may be eligible for the EU Online Dispute Resolution platform where available. Nothing here limits your right to bring proceedings in your country of residence.',
    ],
  },
  {
    id: 'california',
    title: '13. California users',
    paragraphs: [
      'California residents retain rights under the California Consumer Privacy Act as amended by the CPRA, described in our Privacy Policy. California’s Shine the Light law: we do not disclose personal information to third parties for their direct marketing in exchange for money in the manner that statute addresses; contact us for related inquiries.',
    ],
  },
  {
    id: 'governing',
    title: '14. Governing law',
    paragraphs: [
      'Except where mandatory consumer law requires otherwise, these Terms are governed by the laws applicable to the operator’s principal place of business, without regard to conflict-of-law rules. Courts in that venue have non-exclusive jurisdiction, subject to your mandatory local forum rights as a consumer.',
    ],
  },
  {
    id: 'changes',
    title: '15. Changes',
    paragraphs: [
      'We may update these Terms. Material changes will be posted with a new effective date. Continued use after the effective date constitutes acceptance, except where consent is required by law.',
    ],
  },
  {
    id: 'contact',
    title: '16. Contact',
    paragraphs: [
      `Questions about these Terms: ${LEGAL_CONTACT_EMAIL}`,
    ],
  },
];

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: 'who',
    title: '1. Who we are',
    paragraphs: [
      `${LEGAL_OPERATOR} (“we”, “us”) operates typology.network. This Privacy Policy explains how we process personal data when you visit the site, create an account, or interact with our boards and tools.`,
      `Controller contact: ${LEGAL_CONTACT_EMAIL}`,
      `Effective date: ${LEGAL_EFFECTIVE_DATE}`,
    ],
  },
  {
    id: 'scope',
    title: '2. Scope',
    paragraphs: [
      'This Policy covers the public shop board, authentication, user profiles/boards, admin tools for authorized operators, and related cookies or similar technologies. It does not cover third-party retailer sites you leave to via affiliate links.',
    ],
  },
  {
    id: 'data',
    title: '3. Data we process',
    paragraphs: [
      'Depending on how you use the Platform, we may process:',
    ],
    bullets: [
      'Account data: email address, authentication identifiers (including Google OAuth subject IDs if you choose Google sign-in), username/profile fields you provide',
      'Usage data: pages viewed, approximate device/browser info, IP address, timestamps, referrers, and security logs',
      'Content you submit: board items, images you upload, tags, messages you send us',
      'Preferences: cookie consent choices, UI preferences stored locally',
      'Communications: emails you send to us and related support metadata',
    ],
  },
  {
    id: 'purposes',
    title: '4. Purposes and legal bases (GDPR)',
    paragraphs: [
      'We process personal data for:',
    ],
    bullets: [
      'Providing the service and accounts — contract (Art. 6(1)(b)) or steps prior to contract',
      'Security, fraud prevention, and abuse detection — legitimate interests (Art. 6(1)(f)) and legal obligation where applicable',
      'Remembering cookie preferences and essential session function — legitimate interests / necessity for requested service; non-essential cookies only with consent (Art. 6(1)(a))',
      'Responding to inquiries — legitimate interests or contract',
      'Complying with law and enforcing Terms — legal obligation and legitimate interests',
      'Improving the product using aggregated or de-identified analytics where used — consent or legitimate interests, as disclosed at collection',
    ],
  },
  {
    id: 'cookies',
    title: '5. Cookies and similar technologies',
    paragraphs: [
      'We use strictly necessary cookies/local storage for authentication, security, and remembering your cookie choices. Optional cookies (for example analytics or marketing) are used only if you accept them in our consent banner.',
      'You can change your mind via the consent controls or by clearing site data in your browser. Blocking necessary cookies may break sign-in.',
    ],
  },
  {
    id: 'sharing',
    title: '6. Sharing and processors',
    paragraphs: [
      'We use infrastructure providers to host the Platform and authentication (including Supabase and related cloud services). They process data on our instructions as processors/service providers.',
      'We may share data with professional advisors, or with authorities when legally required. We do not sell your personal information for money. We do not “share” personal information for cross-context behavioral advertising as defined by the CPRA unless we update this Policy and offer required opt-outs.',
      'Affiliate networks and retailers receive referral signals when you click outbound links; those parties are independent controllers of data they collect on their sites.',
    ],
  },
  {
    id: 'transfers',
    title: '7. International transfers',
    paragraphs: [
      'If personal data is transferred outside the EU/EEA/UK, we rely on appropriate safeguards such as adequacy decisions or Standard Contractual Clauses, plus supplementary measures where needed.',
    ],
  },
  {
    id: 'retention',
    title: '8. Retention',
    paragraphs: [
      'We keep account data while your account is active and for a reasonable period afterward for security, dispute resolution, and legal compliance. Logs are kept for shorter operational windows unless needed longer for investigations. You may request deletion as described below.',
    ],
  },
  {
    id: 'security',
    title: '9. Security',
    paragraphs: [
      'We apply technical and organizational measures appropriate to the risk (access controls, encrypted transport, least-privilege admin access). No method of transmission or storage is 100% secure.',
    ],
  },
  {
    id: 'rights-gdpr',
    title: '10. Your rights (EU/EEA/UK GDPR)',
    paragraphs: [
      'Subject to legal limits, you may request access, rectification, erasure, restriction, portability, and objection to processing based on legitimate interests. Where processing is based on consent, you may withdraw consent at any time without affecting prior lawful processing.',
      'You may lodge a complaint with your local supervisory authority. Contact us first at the email above so we can try to resolve your request.',
    ],
  },
  {
    id: 'rights-ccpa',
    title: '11. Your rights (California CCPA/CPRA)',
    paragraphs: [
      'California residents may request to know/access, delete, and correct personal information, and to opt out of sale or sharing if we engage in those activities. We do not use or disclose sensitive personal information for purposes that require a Limit Use right beyond what is permitted for providing the service.',
      'We will not discriminate against you for exercising privacy rights. Submit requests to the contact email. We may need to verify your identity. You may use an authorized agent as allowed by law.',
      'Categories collected (examples): identifiers (email, IP), internet activity, and user-generated content. Sources: you, your device, auth providers. Business purposes: as listed in Sections 3–6.',
    ],
  },
  {
    id: 'children',
    title: '12. Children',
    paragraphs: [
      'The Platform is not directed to children under 16 (or under 13 where U.S. COPPA applies). We do not knowingly collect personal data from children below those ages. If you believe we have, contact us to delete it.',
    ],
  },
  {
    id: 'automated',
    title: '13. Automated decisions',
    paragraphs: [
      'We do not make decisions based solely on automated processing that produce legal or similarly significant effects concerning you, within the meaning of GDPR Article 22.',
    ],
  },
  {
    id: 'changes',
    title: '14. Changes',
    paragraphs: [
      'We may update this Policy. Material changes will be posted with a new effective date. Where required, we will seek fresh consent.',
    ],
  },
  {
    id: 'contact',
    title: '15. Contact',
    paragraphs: [
      `Privacy requests: ${LEGAL_CONTACT_EMAIL}`,
    ],
  },
];

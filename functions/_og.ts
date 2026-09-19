const BOT =
  /facebookexternalhit|Twitterbot|Slackbot|WhatsApp|LinkedInBot|discordbot|TelegramBot|Googlebot|bingbot|Applebot/i;

export function isCrawler(ua: string): boolean {
  return BOT.test(ua);
}

export function ogHtml(options: {
  title: string;
  description: string;
  url: string;
  image?: string | null;
}): string {
  const image = options.image
    ? `<meta property="og:image" content="${escapeHtml(options.image)}" />`
    : '';
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<title>${escapeHtml(options.title)}</title>
<meta property="og:title" content="${escapeHtml(options.title)}" />
<meta property="og:description" content="${escapeHtml(options.description)}" />
<meta property="og:url" content="${escapeHtml(options.url)}" />
<meta name="twitter:card" content="summary_large_image" />
${image}
</head><body>
<p>${escapeHtml(options.title)}</p>
</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

export async function spaFallback(request: Request, env: { ASSETS: { fetch: (input: Request) => Promise<Response> } }) {
  return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
}

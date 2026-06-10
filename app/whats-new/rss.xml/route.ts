/**
 * /whats-new/rss.xml — RSS 2.0 feed of every shipped changelog entry.
 *
 * 2026-05-13 (premium-bar audit Group A Feature 4 #6): a feed at a
 * stable URL is the canonical Linear / Vercel / Stripe changelog
 * affordance — RSS readers, email-to-RSS bridges, and "track new
 * versions of this app" tooling all expect it. The web `/whats-new`
 * page already renders the same data; this endpoint serialises it
 * as RSS 2.0 XML so the feed reader of the user's choice can poll.
 *
 * No external deps — `getAllChangelogs()` is the canonical SSOT and
 * the XML serialisation is small enough to inline. Hand-escapes
 * `& < > " '` so item titles + bodies with apostrophes or ampersands
 * don't break the feed.
 */
import { getAllChangelogs, changelogKindLabel } from "../../../src/lib/changelog/entries";

export const dynamic = "force-static";
// Revalidate every hour — changelog is touched ~once a build (every
// few days). An hour is a fine cache window; readers polling more
// often get cached XML and we don't burn vercel function-minutes.
export const revalidate = 3600;

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function rfc822(iso: string): string {
  // Convert YYYY-MM-DD → RFC 822 (e.g. "Sat, 12 May 2026 00:00:00 +0000").
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) {
    return new Date().toUTCString();
  }
  return d.toUTCString();
}

export function GET() {
  const entries = getAllChangelogs().filter((e) => e.items.length > 0);
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://suppr-club.com";
  const feedUrl = `${base}/whats-new/rss.xml`;
  const pageUrl = `${base}/whats-new`;

  const items = entries
    .map((e) => {
      const title = `Build ${e.buildNumber} (${e.appVersion} #${e.buildNumber})${e.releaseTitle ? ` — ${e.releaseTitle}` : ""}`;
      const link = `${base}/whats-new#build-${e.buildNumber}`;
      const guid = link;
      const body = e.items
        .map((i) => `[${changelogKindLabel(i.kind)}] ${i.text}`)
        .join("\n\n");
      return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(guid)}</guid>
      <pubDate>${rfc822(e.releaseDate)}</pubDate>
      <description><![CDATA[${body}]]></description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Sloe — What's new</title>
    <link>${escapeXml(pageUrl)}</link>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <description>New features, fixes, and what's coming in Suppr.</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

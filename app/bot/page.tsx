import Link from "next/link";
import type { Metadata } from "next";
import { TrustPageLayout } from "../../src/app/components/trust/TrustPageLayout";

// ENG-1570 — the public bot-contact page promised by app/terms/page.tsx
// ("Acceptable use") and app/help/HelpClient.tsx ("How recipe import
// works"). Both pages tell users Sloe identifies its recipe-import fetcher
// with a `SupprBot` User-Agent "that links to a public bot contact page" —
// this route is that page. It did not exist anywhere in the repo before
// this ticket; `https://getsloe.com/bot` fell through to the app's default
// auth-middleware redirect (307 → /login), which is not a real answer for
// a webmaster trying to identify or block the bot.
//
// Do NOT rename `SupprBot` on this page — it's a deliberately frozen
// operational identifier (see REBRAND.md "Still suppr (intentional, infra
// not brand)"), pinned by tests/unit/brandDriftSloe.test.ts and
// tests/unit/importFramingToSHelp.test.ts.
//
// Colour classes below are semantic tokens (text-foreground,
// text-foreground-secondary, bg-muted) rather than the raw slate-* palette
// classes the older trust pages (terms/dmca/help) still carry — those are
// pre-existing debt pinned in scripts/token-budget.json; a brand-new file
// isn't allowed to add new off-token debt under the ENG-1007 ratchet
// (check:token-scale), so this one is written token-clean from the start.

const BOT_UA = "SupprBot/1.0 (+https://getsloe.com/bot)";
const BOT_CONTACT_EMAIL = "legal@getsloe.com";

const BOT_SECTIONS = [
  { id: "what", title: "What SupprBot is" },
  { id: "why", title: "Why it fetches your page" },
  { id: "identify", title: "How to identify it" },
  { id: "block", title: "How to block it" },
  { id: "contact", title: "Contact" },
];

export const metadata: Metadata = {
  title: "SupprBot — Sloe's recipe-import fetcher",
  description:
    "What SupprBot is, why it fetches pages, how to identify and block it, and how to contact Sloe about it.",
};

export default function BotPage() {
  return (
    <TrustPageLayout
      title="SupprBot"
      subtitle="Sloe's identified recipe-import fetcher"
      lastUpdated="July 2026"
      version="v1.0"
      sections={BOT_SECTIONS}
      revisionPath="app/bot/page.tsx"
    >
      <div className="prose prose-slate dark:prose-invert prose-sm max-w-none space-y-4 text-foreground-secondary">
        <p>
          This page exists because Sloe&rsquo;s{" "}
          <Link href="/terms#acceptable-use" className="text-primary-solid underline">
            Terms of service
          </Link>{" "}
          and{" "}
          <Link href="/help" className="text-primary-solid underline">
            Help
          </Link>{" "}
          promise that when Sloe fetches a page on a user&rsquo;s behalf, it identifies itself with a{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">SupprBot</code>{" "}
          user agent that links here. If you run a website and a request has arrived with that user agent, this
          page tells you what it is, why it&rsquo;s there, and how to reach us.
        </p>

        <h2 id="what" className="scroll-mt-16 text-lg font-semibold text-foreground pt-2">
          What SupprBot is
        </h2>
        <p>
          SupprBot is the fetcher Sloe (getsloe.com and the Sloe mobile app) uses to read a public web page when a
          Sloe user asks to import a recipe from it. It is not a search-engine crawler, it does not browse your
          site on its own initiative, and it does not build an index. Each request corresponds to one Sloe user, at
          one moment, importing one URL they pasted into the app.
        </p>

        <h2 id="why" className="scroll-mt-16 text-lg font-semibold text-foreground pt-2">
          Why it fetches your page
        </h2>
        <p>
          When a Sloe user imports a recipe, SupprBot requests that single page, reads its structured recipe data
          (ingredients, steps, times, servings &mdash; typically the same{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">schema.org/Recipe</code>{" "}
          markup search engines already read) and hands it back to that user&rsquo;s own private cookbook. Sloe
          does not copy your article&rsquo;s prose or photos, does not republish your page, and does not run
          background or bulk crawls of your site. See the{" "}
          <Link href="/terms#importing-recipes" className="text-primary-solid underline">
            Importing recipes
          </Link>{" "}
          section of the Terms for the full posture.
        </p>

        <h2 id="identify" className="scroll-mt-16 text-lg font-semibold text-foreground pt-2">
          How to identify it
        </h2>
        <p>SupprBot always sends the same, honest, static User-Agent header:</p>
        <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
          <code>{BOT_UA}</code>
        </pre>
        <p>
          It never rotates user agents and never sends a browser&rsquo;s or another company&rsquo;s bot string
          (for example a search engine&rsquo;s or a social platform&rsquo;s) &mdash; every request is truthfully
          labelled. SupprBot also never attempts to bypass a login wall, paywall, CAPTCHA, or other access control;
          if your page requires authentication, SupprBot cannot and will not read it.
        </p>

        <h2 id="block" className="scroll-mt-16 text-lg font-semibold text-foreground pt-2">
          How to block it
        </h2>
        <p>
          The reliable way to block SupprBot today is to match the exact User-Agent token{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">SupprBot</code> at your web server, CDN, or
          firewall, and reject or rate-limit those requests. Because the token is fixed and never spoofed, this
          works immediately with no code change on our side.
        </p>
        <p>
          We do not yet parse or act on a <code className="text-xs bg-muted px-1 py-0.5 rounded">robots.txt</code>{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">Disallow</code> rule targeting{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">User-agent: SupprBot</code> before fetching &mdash;
          if you rely on a robots.txt entry to keep it out today, use User-Agent blocking above instead, or contact
          us and we&rsquo;ll act on it manually in the meantime.
        </p>

        <h2 id="contact" className="scroll-mt-16 text-lg font-semibold text-foreground pt-2">
          Contact
        </h2>
        <p>
          Questions about SupprBot, a request to be excluded, or anything else about how Sloe fetches your site:{" "}
          <a href={`mailto:${BOT_CONTACT_EMAIL}`} className="text-primary-solid underline">
            {BOT_CONTACT_EMAIL}
          </a>
          . Include your domain and, if you have it, a sample request (timestamp and path) so we can confirm it was
          us.
        </p>
      </div>
    </TrustPageLayout>
  );
}

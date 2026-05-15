import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 2026-05-14 — PostHog reverse-proxy. Routes /ingest/* through this
  // origin so analytics requests look first-party. Bypasses content
  // blockers / DNS-level filters / hostile WiFi that drop *.posthog.com
  // and was the diagnosed cause of `PostHogFetchNetworkError` flush
  // failures on Grace's iPhone over both LTE and WiFi.
  //
  // skipTrailingSlashRedirect avoids a 308 on /ingest/decide → that
  // would strip the SDK's POST body. PostHog's documented Next.js
  // proxy setup.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/decide",
        destination: "https://us.i.posthog.com/decide",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  images: {
    // `images.immediate.co.uk` (BBC Good Food / Immediate Media) was removed: hotlinking
    // publisher CDN imagery on a commercial SaaS is direct reproduction under 17 USC § 106
    // and UK CDPA 1988. Imported recipes fall back to a neutral placeholder; the user keeps
    // a link-out to the original page so traffic still goes to the publisher.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  // Proxy Sentry ingestion through /monitoring to bypass adblockers.
  // Without this, paid-acquisition users with uBlock / Brave / 1Blocker
  // (~30% of mobile-web TikTok traffic by industry estimates) silently
  // never report errors. Middleware (`middleware.ts`) excludes this
  // path from auth redirects so requests aren't 307'd to /login.
  tunnelRoute: "/monitoring",
});


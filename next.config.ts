import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Required for Sentry source-map upload on webpack builds. @sentry/nextjs
  // v10 only auto-enables this for Turbopack; for webpack (our default) we
  // must opt in explicitly or `next build` produces no .js.map files,
  // breaking both Sentry symbolication AND the sourcemap-verify CI gate.
  // Prod-served exposure is mitigated by `sourcemaps.deleteSourcemapsAfterUpload`
  // below — Vercel uploads to Sentry and then removes maps from the bundle.
  productionBrowserSourceMaps: true,
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
  webpack: (config, { isServer, dev }) => {
    // Pair with `productionBrowserSourceMaps: true` above. Next's default
    // for that option is `devtool: 'source-map'`, which emits a
    // `//# sourceMappingURL=` comment in every client .js. In prod Sentry
    // deletes the maps after upload, so the comment would point at a 404.
    // `hidden-source-map` produces the same .map files (so Sentry can still
    // upload them) but skips the comment, matching Sentry's own default
    // when `productionBrowserSourceMaps` is not set.
    if (!dev && !isServer) {
      config.devtool = "hidden-source-map";
    }
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // v10 replacement for the removed `hideSourceMaps`. With
  // `productionBrowserSourceMaps: true` above, Next produces .js.map
  // files; Vercel uploads them to Sentry on deploy; this option then
  // removes them from the served bundle so end users can't fetch them.
  //
  // CI's `sourcemap-verify` job needs the maps to remain on disk
  // post-build so it can assert generation hasn't regressed. v10
  // deletes them unconditionally as part of `next build` (the upload
  // and the deletion are both wired into the runAfterProductionCompile
  // hook, not gated on a successful upload). Set
  // SENTRY_RETAIN_SOURCEMAPS to the literal `"1"` to opt that job out
  // of deletion; ANY other value (unset, `"0"`, `"false"`, …) keeps
  // the secure default. Matches the existing `=== "1"` pattern used by
  // VERIFY_STRICT / SUPPR_DEBUG / NEXT_PUBLIC_FORCE_SW so an operator
  // who types `SENTRY_RETAIN_SOURCEMAPS=0` in Vercel's env panel doesn't
  // accidentally retain maps in prod.
  sourcemaps: {
    deleteSourcemapsAfterUpload: process.env.SENTRY_RETAIN_SOURCEMAPS !== "1",
  },
  // Proxy Sentry ingestion through /monitoring to bypass adblockers.
  // Without this, paid-acquisition users with uBlock / Brave / 1Blocker
  // (~30% of mobile-web TikTok traffic by industry estimates) silently
  // never report errors. Middleware (`middleware.ts`) excludes this
  // path from auth redirects so requests aren't 307'd to /login.
  tunnelRoute: "/monitoring",
});


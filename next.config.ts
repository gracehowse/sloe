import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
  silent: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,
});


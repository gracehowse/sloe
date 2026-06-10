import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Newsreader } from "next/font/google";
import "../src/styles/index.css";
import { Providers } from "./providers";
import { DrOutageBanner } from "../src/app/components/ops/DrOutageBanner";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// Sloe Phase 0 (2026-06-03) — editorial serif for headlines, display headings,
// and the calorie-ring numerals. Weights 300/400/500/600: 300 is the light
// editorial weight the landing display headings use (calm Sloe look); 400/500/600
// match the headings/display roles wired in `src/styles/theme.css`
// (`--font-headline` / `--font-display`).
const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600"],
  variable: "--font-newsreader",
});

function resolveMetadataBase(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) {
    return new URL("https://suppr-club.com");
  }
  try {
    const withScheme = raw.includes("://") ? raw : `https://${raw}`;
    return new URL(withScheme);
  } catch {
    return new URL("https://suppr-club.com");
  }
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: {
    default: "Sloe",
    template: "%s — Sloe",
  },
  description: "Recipes, verified macros, and meal planning in one workspace.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  // Explicit width + initialScale so the meta viewport tag is always
  // rendered, even if Next.js 15's default ever changes. Verified
  // 2026-05-14 (premium-bar audit refuse-to-pass #298, mobile-web
  // phone-browser routing) — `/today` on a mobile browser needs this
  // to render at the device width rather than the desktop fallback.
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#111118" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${newsreader.variable}`}
      suppressHydrationWarning
    >
      <body className={inter.className}>
        <DrOutageBanner />
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}


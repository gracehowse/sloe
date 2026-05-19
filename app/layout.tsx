import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Newsreader, Spectral } from "next/font/google";
import "../src/styles/index.css";
import { Providers } from "./providers";
import { TareAestheticGate } from "./tare-aesthetic-gate";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// 2026-05-19 (Phase 0.7, print-bundle alignment) — Newsreader is now
// the DEFAULT editorial serif (not Spectral). The print bundle's
// settled state at `print-app.jsx:5` is `serif: 'Newsreader'`.
// Newsreader is more humanist and readable at UI scale than Spectral
// while keeping the same editorial register. Loaded with weights
// 400 + 500 + 600 + italic; the highlight-wash primitive pulls
// italic, screen titles use weight 600.
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-newsreader",
});

// 2026-05-18 — Spectral kept loaded as a TWEAKABLE alternative to
// Newsreader (e.g. for a future "Editorial" theme preset). Not the
// default any more (see comment above).
const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-spectral",
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
    default: "Suppr",
    template: "%s — Suppr",
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
      className={`${inter.variable} ${newsreader.variable} ${spectral.variable}`}
      suppressHydrationWarning
    >
      <body className={inter.className}>
        <Providers>
          <TareAestheticGate>{children}</TareAestheticGate>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}


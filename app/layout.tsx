import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, Spectral } from "next/font/google";
import "../src/styles/index.css";
import { Providers } from "./providers";
import { TareAestheticGate } from "./tare-aesthetic-gate";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// 2026-05-18 — Tare aesthetic v1 foundation. Spectral is the second
// family (editorial moments only: greeting, hero ring number, "No. NN"
// masthead reference). Loaded with weights 400 + 500 + 600; italic is
// ONLY pulled for the masthead reference (".tare-masthead-ref"). The
// font is only activated visually when `body.tare-on` is set — see
// `TareAestheticGate` below for the feature-flag wiring.
//
// Why two weights + italic on the variable: keeps the bundle minimal
// while covering the three editorial slots — greeting (400), hero
// number (500), masthead italic (400 italic).
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
      className={`${inter.variable} ${spectral.variable}`}
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


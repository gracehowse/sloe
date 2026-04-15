import type { Metadata } from "next";
import { HomePageClient } from "./HomePageClient.tsx";
import { MarketingLanding } from "./MarketingLanding.tsx";

export const metadata: Metadata = {
  title: "Suppr — Recipes, macros & meal planning",
  description:
    "Save recipes from social and the web, see verified macros, plan your week, and build shopping lists — one workspace for how you actually cook and eat.",
  openGraph: {
    title: "Suppr — Recipes, macros & meal planning",
    description:
      "Save recipes from social and the web, see verified macros, plan your week, and build shopping lists — one workspace for how you actually cook and eat.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Suppr — Recipes, macros & meal planning",
    description:
      "Save recipes from social and the web, see verified macros, plan your week, and build shopping lists.",
  },
};

export default function Page() {
  return (
    <HomePageClient>
      <MarketingLanding />
    </HomePageClient>
  );
}

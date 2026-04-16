import type { Metadata } from "next";
import { HomePageClient } from "./HomePageClient.tsx";

export const metadata: Metadata = {
  title: "Suppr — Recipes, macros & meal planning",
  description:
    "Save recipes from social and the web, see verified macros, plan your week, and build shopping lists — one workspace for how you actually cook and eat.",
};

export default function Page() {
  return <HomePageClient />;
}

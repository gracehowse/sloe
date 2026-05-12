/**
 * /help — server shell + client island.
 *
 * Server file owns the Next.js metadata (title, description) so the
 * page stays SEO-friendly. The interactive search + accordion lives
 * in `./HelpClient` — see that file for the full design rationale.
 */
import type { Metadata } from "next";
import HelpClient from "./HelpClient";

export const metadata: Metadata = {
  title: "Help — Suppr",
  description:
    "How Suppr works, nutrition methodology, data sources, and disclaimers.",
};

export default function HelpPage() {
  return <HelpClient />;
}

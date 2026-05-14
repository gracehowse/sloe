/**
 * /settings — canonical Settings render path.
 * See `app/today/page.tsx` for the routing rationale.
 */
import type { Metadata } from "next";
import { HomePageClient } from "../HomePageClient";

export const metadata: Metadata = {
  title: "Settings — Suppr",
  description: "Manage your account, plan, and preferences.",
};

export default function SettingsPage() {
  return <HomePageClient />;
}

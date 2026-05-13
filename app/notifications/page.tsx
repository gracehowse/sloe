/**
 * /notifications — canonical Notifications render path.
 * See `app/today/page.tsx` for the routing rationale.
 */
import type { Metadata } from "next";
import { HomePageClient } from "../HomePageClient";

export const metadata: Metadata = {
  title: "Notifications — Suppr",
  description: "Manage your push notifications.",
};

export default function NotificationsPage() {
  return <HomePageClient />;
}

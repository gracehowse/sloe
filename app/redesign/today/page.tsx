/**
 * /redesign/today — self-contained PROTOTYPE of the refreshed Today
 * dashboard. Runs on mock data and does not touch the live authed tracker,
 * so the evolved Sloe design direction can be reviewed in isolation.
 */
import type { Metadata } from "next";
import { RedesignTodayScreen } from "../../../src/app/components/redesign/RedesignTodayScreen";

export const metadata: Metadata = {
  title: "Today (redesign) — Sloe",
  description: "Prototype of the refreshed Today dashboard direction.",
};

export default function RedesignTodayPage() {
  return <RedesignTodayScreen />;
}

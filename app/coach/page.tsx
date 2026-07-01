import type { Metadata } from "next";
import { CoachScreenClient } from "../../src/app/components/suppr/coach-screen-client";

export const metadata: Metadata = {
  title: "Your coach — Sloe",
  description: "Today's read, what to eat next, and ask-the-coach guidance.",
};

export default function CoachPage() {
  return <CoachScreenClient />;
}

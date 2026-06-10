import type { Metadata } from "next";
import { LoginClient } from "../login/ui";

export const metadata: Metadata = {
  title: "Sloe — Sign in",
  robots: { index: false, follow: false },
};

/**
 * `/signin` — sign-in-only alias (Premium P1 / RTP-5).
 *
 * Renders the same card as `/login` without an in-card mode toggle.
 * Bookmarks from the brief `/signin` split (2026-04-20) keep working.
 */
export default function SigninPage() {
  return <LoginClient initialMode="signin" hideTabs />;
}

import { redirect } from "next/navigation";
import { LoginClient } from "./ui";

type LoginPageProps = {
  searchParams: Promise<{ mode?: string | string[] }>;
};

/**
 * Canonical sign-in route (`/login`). Sign-up lives at `/signup`.
 *
 * Historic `?mode=signup` deep links redirect to the dedicated signup
 * page so `/login` stays sign-in-only (Premium P1 / RTP-5).
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const sp = await searchParams;
  const raw = sp.mode;
  const modeStr = Array.isArray(raw) ? raw[0] : raw;
  if (modeStr === "signup") {
    redirect("/signup");
  }
  return <LoginClient initialMode="signin" hideTabs />;
}

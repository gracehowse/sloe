/**
 * /signup → /onboarding (server-side 307).
 *
 * Sign-up is now part of the v2 onboarding flow (real Supabase signUp
 * happens inline at the second step). Keeping a separate /signup form
 * was the source of the duplicate-account-creation loop on
 * suppr-club.com (legacy flow → /signup → real auth → /onboarding/v2 →
 * cosmetic v2 signup step that asked again).
 */

import { redirect } from "next/navigation";

export default function SignupPage() {
  redirect("/onboarding");
}

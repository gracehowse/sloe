/**
 * /plan → /home?view=plan (server-side 307).
 * See `app/library/page.tsx` for the audit context (#4 — Web Recipes routes).
 */
import { redirect } from "next/navigation";

export default function PlanRedirectPage() {
  redirect("/home?view=plan");
}

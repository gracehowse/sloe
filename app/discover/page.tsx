/**
 * /discover → /home?view=discover (server-side 307).
 * See `app/library/page.tsx` for the audit context (#4 — Web Recipes routes).
 */
import { redirect } from "next/navigation";

export default function DiscoverRedirectPage() {
  redirect("/home?view=discover");
}

/**
 * /signin → /login (server-side 307).
 *
 * Short-lived alias. Grace 2026-04-20 set the canonical sign-in route
 * back to /login after one session where we'd split it into /signin.
 * Kept as a redirect (not deleted) so any bookmark / email link that
 * leaked out during that window still works.
 */

import { redirect } from "next/navigation";

export default function SigninPage() {
  redirect("/login");
}

/**
 * /library → /home?view=library (server-side 307).
 *
 * 2026-05-12 (premium-bar audit #4 — Web Recipes routes): every
 * top-level surface needs a real URL the user can type, bookmark, or
 * share. Until the full URL migration lands (refuse-to-pass #2,
 * journey-architect + executor scope), this is a thin redirect so
 * `/library` doesn't 404 or fall through to the marketing landing.
 *
 * Pre-fix behaviour: typing `suppr-club.com/library` returned 404 →
 * trust hit + dead-end for any external link.
 */
import { redirect } from "next/navigation";

export default function LibraryRedirectPage() {
  redirect("/home?view=library");
}

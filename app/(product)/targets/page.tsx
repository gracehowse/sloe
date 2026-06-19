/**
 * /targets — canonical web Targets path (ENG-622).
 *
 * The product route group intentionally mounts `<HomePageClient />` once from
 * `app/(product)/layout.tsx`; each leaf page returns `null` so tab changes can
 * use history-state URL updates without remounting auth/profile gates. The App
 * shell reads `usePathname()` and maps `/targets` to the existing `targets`
 * view.
 *
 * Auth: `/targets` is not in `PUBLIC_ROUTES`, so an unauthed visit 307s to
 * `/login` via middleware before any client JS runs.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Targets — Sloe",
  description: "Review and adjust your calorie and macro targets.",
};

/** UI shell: `app/(product)/layout.tsx` → HomePageClient → App `case "targets"`. */
export default function TargetsPage() {
  return null;
}

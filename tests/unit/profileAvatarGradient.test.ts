/**
 * Identity avatars — ONE solid-damson disc (S5 avatar ruling 2026-07-10,
 * ENG-1375). Supersedes the 2026-05-20 "premium chrome" split (Profile flat
 * `bg-primary`; Settings + Sidebar CSS gradient): the sidebar, pricing
 * header, Today header, and Profile monogram all render the shared
 * `AvatarDisc` (`--avatar-identity`). The Settings header card keeps its
 * gradient until a later S5 slice (56px size + parity pin move together) —
 * pinned here so the remaining consumer is deliberate, not drift.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("identity avatars — ONE AvatarDisc (ENG-1375 S5)", () => {
  it("sidebar profile entry renders AvatarDisc, gradient retired", () => {
    const sidebar = read("src/app/components/suppr/desktop-sidebar.tsx");
    expect(sidebar).toContain("<AvatarDisc");
    expect(sidebar).not.toContain("linear-gradient");
  });

  it("pricing header account entry renders AvatarDisc, gradient retired", () => {
    const pricing = read("app/pricing/PricingHeaderAuth.tsx");
    expect(pricing).toContain("<AvatarDisc");
    expect(pricing).not.toContain("linear-gradient");
  });

  it("editorial Profile monogram renders AvatarDisc, ad-hoc bg-primary disc retired", () => {
    const block = read("src/app/components/profile/EditorialProfileBlock.tsx");
    expect(block).toContain("<AvatarDisc");
    expect(block).not.toMatch(/rounded-full bg-primary text-lg/);
  });

  it("Settings header card gradient is the LAST gradient consumer (later S5 slice)", () => {
    const settingsHeaderCard = read(
      "src/app/components/settings/SettingsProfileHeaderCard.tsx",
    );
    expect(settingsHeaderCard).toContain("linear-gradient");
    expect(settingsHeaderCard).toContain("var(--avatar-gradient-accent)");
  });
});

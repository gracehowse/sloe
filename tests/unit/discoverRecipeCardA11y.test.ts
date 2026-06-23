/**
 * ENG-1147 — Discover recipe-card accessibility labels + type-floor.
 *
 * Discover recipe cards (web `<button>` / mobile `Pressable`) carried no
 * accessible name — screen readers announced a bare "button" for every
 * card, making the whole feed unusable without sight. They also had a
 * sub-floor `text-[9px]` source badge on the web cards (the web type
 * floor is `--text-xs` = 11px).
 *
 * Two layers of protection:
 *   1. Unit tests on the shared `recipeCardAccessibilityLabel` helper so
 *      the announced name is correct, trust-safe ("estimated"), and never
 *      empty.
 *   2. Source-pins that both Discover surfaces import the shared helper
 *      and feed it to EACH recipe card's accessible-name prop, and that
 *      the web sub-floor badge text was bumped to the ramp — so a future
 *      edit that drops the label or reintroduces sub-floor text on a
 *      recipe card breaks this test and forces a rethink.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { recipeCardAccessibilityLabel } from "../../src/lib/recipes/recipeCardAccessibilityLabel";

const ROOT = resolve(__dirname, "../..");
const WEB_DISCOVER_PATH = resolve(ROOT, "src/app/components/DiscoverFeed.tsx");
const MOBILE_DISCOVER_PATH = resolve(ROOT, "apps/mobile/app/(tabs)/discover.tsx");

const WEB_DISCOVER_SRC = readFileSync(WEB_DISCOVER_PATH, "utf8");
const MOBILE_DISCOVER_SRC = readFileSync(MOBILE_DISCOVER_PATH, "utf8");
// The compact More-ideas row Pressable was extracted to DiscoverMoreIdeaRow
// (ENG-1225 Block 6 pre-work); scan both files so the per-card a11y pins still
// count the hero card (discover.tsx) + the More-ideas row (DiscoverMoreIdeaRow).
const MOBILE_MORE_IDEA_PATH = resolve(
  ROOT,
  "apps/mobile/components/discover/DiscoverMoreIdeaRow.tsx",
);
const MOBILE_A11Y_SRC =
  MOBILE_DISCOVER_SRC + "\n" + readFileSync(MOBILE_MORE_IDEA_PATH, "utf8");

describe("recipeCardAccessibilityLabel — shared helper", () => {
  it("builds a descriptive, trust-safe label with title, macros, cook time, and a call to action", () => {
    const label = recipeCardAccessibilityLabel({
      title: "Katsu Curry",
      calories: 540,
      protein: 32,
      carbs: 60,
      fat: 18,
      cookTime: "25 min",
    });
    expect(label).toBe(
      "Katsu Curry. Estimated 540 calories, 32g protein, 60g carbs, 18g fat, 25 min. View recipe.",
    );
  });

  it("always says 'estimated' for calories (trust posture — never absolute)", () => {
    const label = recipeCardAccessibilityLabel({ title: "Soup", calories: 200 });
    expect(label).toMatch(/estimated 200 calories/i);
    // No bare "200 calories" without the estimated qualifier preceding it.
    expect(label).not.toMatch(/(?<!estimated )200 calories/i);
  });

  it("rounds raw macro values", () => {
    const label = recipeCardAccessibilityLabel({
      title: "Bowl",
      calories: 320.6,
      protein: 24.4,
    });
    expect(label).toMatch(/estimated 321 calories/i);
    expect(label).toContain("24g protein");
  });

  it("omits null / zero / non-finite macros rather than announcing a misleading 0g", () => {
    const label = recipeCardAccessibilityLabel({
      title: "Mystery Dish",
      calories: 0,
      protein: null,
      carbs: undefined,
      fat: Number.NaN,
    });
    // No nutrition segment at all — just title + CTA.
    expect(label).toBe("Mystery Dish. View recipe.");
    expect(label).not.toContain("0g");
    expect(label).not.toContain("calories");
  });

  it("handles a recipe with macros but no cook time", () => {
    const label = recipeCardAccessibilityLabel({
      title: "Salad",
      calories: 150,
      protein: 8,
    });
    expect(label).toBe("Salad. Estimated 150 calories, 8g protein. View recipe.");
  });

  it("never returns an empty accessible name even with a blank title", () => {
    const label = recipeCardAccessibilityLabel({ title: "   " });
    expect(label.trim().length).toBeGreaterThan(0);
    expect(label).toBe("View recipe.");
  });

  it("does not double up sentence terminators when a title already ends in a period", () => {
    const label = recipeCardAccessibilityLabel({ title: "Mac & cheese." });
    expect(label).toBe("Mac & cheese. View recipe.");
  });
});

describe("ENG-1147 — web DiscoverFeed recipe cards carry an accessible name", () => {
  it("imports the shared label helper", () => {
    expect(WEB_DISCOVER_SRC).toMatch(
      /import\s*\{\s*recipeCardAccessibilityLabel\s*\}\s*from\s*["']\.\.\/\.\.\/lib\/recipes\/recipeCardAccessibilityLabel/,
    );
  });

  it("feeds a recipeCardAccessibilityLabel aria-label to every recipe-card button", () => {
    // One per card surface: cluster carousel, desktop grid, mobile-web
    // hero, mobile-web More-ideas row.
    const matches = WEB_DISCOVER_SRC.match(
      /aria-label=\{recipeCardAccessibilityLabel\(/g,
    );
    expect(matches?.length ?? 0).toBe(4);
  });
});

describe("ENG-1147 — mobile Discover recipe cards carry an accessible name", () => {
  it("imports the shared label helper", () => {
    expect(MOBILE_DISCOVER_SRC).toMatch(
      /import\s*\{\s*recipeCardAccessibilityLabel\s*\}\s*from\s*["']@suppr\/shared\/recipes\/recipeCardAccessibilityLabel["']/,
    );
  });

  it("feeds a recipeCardAccessibilityLabel accessibilityLabel to every recipe-card Pressable", () => {
    // Hero card (discover.tsx) + More-ideas row (DiscoverMoreIdeaRow.tsx).
    const matches = MOBILE_A11Y_SRC.match(
      /accessibilityLabel=\{recipeCardAccessibilityLabel\(/g,
    );
    expect(matches?.length ?? 0).toBe(2);
  });

  it("marks the recipe-card Pressables with accessibilityRole='button'", () => {
    // The hero card + More-ideas row Pressables both gained the role so
    // VoiceOver announces them as buttons, not generic views.
    const roleMatches = MOBILE_A11Y_SRC.match(
      /accessibilityRole="button"\s*\n\s*accessibilityLabel=\{recipeCardAccessibilityLabel\(/g,
    );
    expect(roleMatches?.length ?? 0).toBe(2);
  });
});

describe("ENG-1147 — web Discover source badge is on the type ramp (no sub-floor)", () => {
  it("does not use sub-floor text-[9px] / text-[10px] on the recipe-card source badge", () => {
    // The two SourceBadge instances on the recipe cards used text-[9px]
    // (below the --text-xs 11px floor). Bumped to text-[11px].
    expect(WEB_DISCOVER_SRC).not.toMatch(/<SourceBadge[^>]*text-\[9px\]/s);
    expect(WEB_DISCOVER_SRC).not.toMatch(/<SourceBadge[^>]*text-\[10px\]/s);
  });
});

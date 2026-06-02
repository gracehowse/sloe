import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { PlanSourceSelector } from "./PlanSourceSelector";

/**
 * ENG-790 — "Plan from" source selector visual proof.
 *
 * The host (`MealPlanner`) gates the selector behind the
 * `plan_source_selector` feature flag, and web `isFeatureEnabled` reads
 * straight from PostHog (no dev override), so the flag-ON appearance
 * can't be screenshotted from the real authed Plan tab without enabling
 * the flag in PostHog. These stories render the presentational control
 * directly (flag-independent) so every state — including the 0-saved
 * `library` blocked sub-case — is reviewable for pixels + a11y.
 *
 * Mobile parity: `apps/mobile/components/plan/PlanSourceSelector.tsx`
 * renders the same three rows from the same shared copy
 * (`@/lib/planning/planSource` → `PLAN_SOURCE_ROW_META` + `planSourceCount`),
 * so this story doubles as the cross-platform copy/contract reference.
 *
 * `a11y.context` scopes the axe run to the selector so the automated
 * contrast check validates the selected-row primary tint + count badge
 * and the muted subtitle against the card surface.
 */

const meta = {
  title: "Suppr/PlanSourceSelector",
  component: PlanSourceSelector,
  tags: ["ai-generated"],
  parameters: {
    layout: "centered",
    a11y: { context: '[data-testid="plan-source-selector"]' },
  },
  decorators: [
    (Story) => (
      <div className="w-[380px] rounded-2xl border border-border bg-background p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    onChange: () => {},
  },
} satisfies Meta<typeof PlanSourceSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default — `library_and_discovery` selected. Broadest pool, generates
 *  even at 0 saves; the combined count badge is library + discovery. */
export const Default: Story = {
  args: { mode: "library_and_discovery", libraryCount: 2, discoverCount: 5 },
};

/** `library` chosen with recipes saved — generates from saves only. */
export const LibrarySelected: Story = {
  args: { mode: "library", libraryCount: 2, discoverCount: 5 },
};

/** `discovery` chosen — generates from Suppr's curated picks only. */
export const DiscoverySelected: Story = {
  args: { mode: "discovery", libraryCount: 2, discoverCount: 5 },
};

/** The one blocked combination: `library` chosen with 0 saved recipes.
 *  The library row shows a 0 badge + the "Save a recipe to use this"
 *  empty subtitle; the host disables generate and points back here, with
 *  Library & discovery one tap away as the escape hatch (so 0-saved is no
 *  longer a dead end). This is the hint-reads-helpful state to eyeball. */
export const ZeroSavedLibrary: Story = {
  args: { mode: "library", libraryCount: 0, discoverCount: 6 },
};

/** Dark theme — confirms the selected primary tint + count badge survive
 *  the dark surface. */
export const DefaultDark: Story = {
  args: { mode: "library_and_discovery", libraryCount: 2, discoverCount: 5 },
  globals: { theme: "dark" },
};

/**
 * Visual-contract stories opt into Chromatic snapshots.
 * Default in `.storybook/preview.tsx` is `chromatic.disableSnapshot: true`
 * so the full library publishes for browse without burning snapshot quota.
 *
 * Spread `parameters` onto meta of curated stories (anatomy owners + critical
 * surfaces). CSF requires `tags` to be string literals — write `"chromatic"`
 * inline; do not spread `chromaticVisualContract.tags`.
 *
 *   tags: ["ai-generated", "chromatic"]
 *   parameters: { ...existing, ...chromaticVisualContract.parameters }
 */
export const chromaticVisualContract = {
  /** Document-only — use the string literal `"chromatic"` in CSF tags. */
  tags: ["chromatic"] as const,
  parameters: {
    chromatic: {
      disableSnapshot: false,
    },
  },
} as const;

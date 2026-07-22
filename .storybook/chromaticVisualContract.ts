/**
 * Visual-contract stories opt into Chromatic snapshots.
 * Default in `.storybook/preview.tsx` is `chromatic.disableSnapshot: true`
 * so the full library publishes for browse without burning snapshot quota.
 *
 * Spread onto meta of curated stories (anatomy owners + critical surfaces):
 *   tags: [...existing, ...chromaticVisualContract.tags]
 *   parameters: { ...existing, ...chromaticVisualContract.parameters }
 */
export const chromaticVisualContract = {
  tags: ["chromatic"] as const,
  parameters: {
    chromatic: {
      disableSnapshot: false,
    },
  },
} as const;

export type SettingsProfileStats = {
  savedCount: number;
  streak: number;
};

export type SettingsProfileStatsTile = {
  value: string;
  label: string;
  kind: "recipes" | "streak";
};

export type SettingsProfileStatsPresentation =
  | { mode: "hidden" }
  | { mode: "inline"; inlineSuffix: string }
  | { mode: "tiles"; tiles: [SettingsProfileStatsTile, SettingsProfileStatsTile] };

/**
 * Settings profile stats (Recipes / Streak) should never render as a lone
 * full-width tile when only one value is present (ENG-1614). Two stats earn
 * the tile row; a single stat folds into the profile subline instead.
 */
export function resolveSettingsProfileStatsPresentation(
  stats: SettingsProfileStats,
): SettingsProfileStatsPresentation {
  const hasRecipes = stats.savedCount > 0;
  const hasStreak = stats.streak > 0;

  if (!hasRecipes && !hasStreak) {
    return { mode: "hidden" };
  }

  if (hasRecipes && hasStreak) {
    return {
      mode: "tiles",
      tiles: [
        {
          value: String(stats.savedCount),
          label: stats.savedCount === 1 ? "Recipe" : "Recipes",
          kind: "recipes",
        },
        {
          value: String(stats.streak),
          label: "Streak",
          kind: "streak",
        },
      ],
    };
  }

  if (hasRecipes) {
    return {
      mode: "inline",
      inlineSuffix:
        stats.savedCount === 1
          ? "1 recipe saved"
          : `${stats.savedCount} recipes saved`,
    };
  }

  return {
    mode: "inline",
    inlineSuffix:
      stats.streak === 1 ? "1-day streak" : `${stats.streak}-day streak`,
  };
}

/** Join email, plan label, and optional inline stats for the profile subline. */
export function formatSettingsProfileSubline(
  parts: { email?: string | null; planLabel: string },
  statsPresentation: SettingsProfileStatsPresentation,
): string {
  const segments: string[] = [];
  if (parts.email?.trim()) segments.push(parts.email.trim());
  segments.push(parts.planLabel);
  if (statsPresentation.mode === "inline") {
    segments.push(statsPresentation.inlineSuffix);
  }
  return segments.join(" · ");
}

// @vitest-environment jsdom
/**
 * FollowingFeed (mobile, ENG-1225 #14) — the v3 Discover "Following" creator
 * post stack. Pins: the `enabled` (flag) + empty gating, the creator header
 * (name + @handle), the Follow → Following toggle, the seed "sample creator"
 * disclosure, and the recipe / creator press wiring.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

// FollowingFeed imports the real `@/lib/supabase` (eager client at module load)
// — stub it so the suite doesn't throw "supabaseUrl is required" on import. The
// tests render with no session (userId null), so the follow graph is never hit.
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
// `@/context/auth` pulls in the HealthKit/expo-constants chain at module load;
// the feed only needs `useAuth`, and these tests run signed-out.
vi.mock("@/context/auth", () => ({ useAuth: () => ({ session: null, loading: true }) }));

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#221B26",
    textSecondary: "#655C6E",
    textTertiary: "#6E6874",
    navPrimary: "#3B2A4D",
    card: "#FFFFFF",
    cardBorder: "#EAE7F0",
    background: "#FFFFFF",
    cardElevated: "#FFFFFF",
  }),
}));
vi.mock("@/context/theme", () => ({
  useAccent: () => ({ primary: "#7E5C92", primarySolid: "#3B2A4D", primarySoft: "rgba(91,59,110,0.12)" }),
  useTheme: () => ({ resolved: "light", colors: {} }),
  useResolvedScheme: () => "light",
}));
vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn(),
  notificationAsync: vi.fn(),
  impactAsync: vi.fn(),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle: { Light: "light" },
}));

import { FollowingFeed } from "../../components/discover/FollowingFeed";
import { SEED_CREATOR_CHIPS } from "@suppr/shared/discover/seedCreators";
import type { CreatorChip } from "@suppr/shared/discover/topCreators";
import type { RecipeCard } from "../../lib/types";

const recipes: RecipeCard[] = [
  {
    id: "r1",
    title: "Harissa chickpea stew",
    image: "https://images.unsplash.com/x.jpg",
    creatorName: "",
    creatorImage: "",
    servings: 4,
    calories: 540,
    protein: 31,
    carbs: 48,
    fat: 22,
  } as RecipeCard,
  {
    id: "r2",
    title: "Miso salmon",
    image: "https://images.unsplash.com/y.jpg",
    creatorName: "",
    creatorImage: "",
    servings: 2,
    calories: 480,
    protein: 38,
    carbs: 20,
    fat: 24,
  } as RecipeCard,
];

const seed = [...SEED_CREATOR_CHIPS];

describe("FollowingFeed", () => {
  it("renders the creator header (name + @handle) for each seed post", () => {
    const { getByText } = render(
      <FollowingFeed
        enabled
        creators={seed}
        recipes={recipes}
        onPressRecipe={() => {}}
        onPressCreator={() => {}}
      />,
    );
    expect(getByText("Following")).toBeTruthy();
    expect(getByText("Priya Patel")).toBeTruthy();
    // @handle · postedAgo
    expect(getByText(/@priyaeats/)).toBeTruthy();
  });

  it("toggles Follow → Following on press", () => {
    const { getAllByText, queryAllByText } = render(
      <FollowingFeed
        enabled
        creators={seed.slice(0, 1)}
        recipes={recipes}
        onPressRecipe={() => {}}
        onPressCreator={() => {}}
      />,
    );
    const follow = getAllByText("Follow")[0]!;
    fireEvent.press(follow);
    expect(queryAllByText("Following").length).toBeGreaterThanOrEqual(1);
  });

  it("discloses the seed creators as samples (no fabricated persisted follow)", () => {
    const { getAllByText } = render(
      <FollowingFeed
        enabled
        creators={seed.slice(0, 1)}
        recipes={recipes}
        onPressRecipe={() => {}}
        onPressCreator={() => {}}
      />,
    );
    expect(getAllByText(/Sample creator/).length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT show the sample disclosure for a real (non-seed) creator", () => {
    const real: CreatorChip[] = [
      { id: "11111111-2222-3333-4444-555555555555", handle: "real", displayName: "Real Cook", avatarUrl: null },
    ];
    const { queryByText } = render(
      <FollowingFeed
        enabled
        creators={real}
        recipes={recipes}
        onPressRecipe={() => {}}
        onPressCreator={() => {}}
      />,
    );
    expect(queryByText(/Sample creator/)).toBeNull();
  });

  it("fires onPressRecipe / onPressCreator", () => {
    const onPressRecipe = vi.fn();
    const onPressCreator = vi.fn();
    const { getByText } = render(
      <FollowingFeed
        enabled
        creators={seed.slice(0, 1)}
        recipes={recipes}
        onPressRecipe={onPressRecipe}
        onPressCreator={onPressCreator}
      />,
    );
    fireEvent.press(getByText("Priya Patel"));
    expect(onPressCreator).toHaveBeenCalledWith("seed-creator-priya");
    fireEvent.press(getByText("Harissa chickpea stew"));
    expect(onPressRecipe).toHaveBeenCalled();
  });

  it("renders nothing when disabled", () => {
    const { toJSON } = render(
      <FollowingFeed
        enabled={false}
        creators={seed}
        recipes={recipes}
        onPressRecipe={() => {}}
        onPressCreator={() => {}}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders nothing when there are no creators", () => {
    const { toJSON } = render(
      <FollowingFeed
        enabled
        creators={[]}
        recipes={recipes}
        onPressRecipe={() => {}}
        onPressCreator={() => {}}
      />,
    );
    expect(toJSON()).toBeNull();
  });
});

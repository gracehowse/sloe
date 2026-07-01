// @vitest-environment jsdom
/**
 * FollowingFeed (mobile, ENG-1225 #14 / ENG-1239) — real creator posts with
 * persisted follow state via the `follows` table.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const getSession = vi.fn();
const followsSelect = vi.fn();
const followsInsert = vi.fn();
const followsDelete = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: (...args: unknown[]) => getSession(...args) },
    from: (table: string) => {
      if (table !== "follows") throw new Error(`unexpected table ${table}`);
      return {
        select: (...args: unknown[]) => {
          followsSelect(...args);
          return {
            eq: () => ({
              in: () => Promise.resolve({ data: [], error: null }),
            }),
          };
        },
        delete: () => ({
          eq: () => ({
            eq: () => followsDelete(),
          }),
        }),
        insert: (...args: unknown[]) => followsInsert(...args),
      };
    },
  },
}));

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
import type { CreatorChip } from "@suppr/shared/discover/topCreators";
import type { RecipeCard } from "../../lib/types";

const launchCreators: CreatorChip[] = [
  {
    id: "a1000001-0001-4000-8000-000000000001",
    handle: "priyaeats",
    displayName: "Priya Patel",
    avatarUrl: null,
    bio: "Batch-cooking & big-flavour veg",
  },
];

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

describe("FollowingFeed", () => {
  beforeEach(() => {
    getSession.mockReset();
    followsSelect.mockReset();
    followsInsert.mockReset();
    followsDelete.mockReset();
    getSession.mockResolvedValue({
      data: { session: { user: { id: "viewer-u1" } } },
    });
    followsInsert.mockResolvedValue({ error: null });
    followsDelete.mockResolvedValue({ error: null });
  });

  it("renders the creator header (name + @handle) for each post", async () => {
    const { getByText } = render(
      <FollowingFeed
        enabled
        creators={launchCreators}
        recipes={recipes}
        onPressRecipe={() => {}}
        onPressCreator={() => {}}
      />,
    );
    expect(getByText("Following")).toBeTruthy();
    expect(getByText("Priya Patel")).toBeTruthy();
    expect(getByText(/@priyaeats/)).toBeTruthy();
    await waitFor(() => expect(getSession).toHaveBeenCalled());
  });

  it("shows the creator bio as the feed note when present", () => {
    const { getByText } = render(
      <FollowingFeed
        enabled
        creators={launchCreators}
        recipes={recipes}
        onPressRecipe={() => {}}
        onPressCreator={() => {}}
      />,
    );
    expect(getByText("Batch-cooking & big-flavour veg")).toBeTruthy();
  });

  it("toggles Follow → Following on press when signed in", async () => {
    const { getByLabelText, findByLabelText } = render(
      <FollowingFeed
        enabled
        creators={launchCreators}
        recipes={recipes}
        onPressRecipe={() => {}}
        onPressCreator={() => {}}
      />,
    );
    await waitFor(() => expect(getSession).toHaveBeenCalled());
    fireEvent.press(getByLabelText("Follow Priya Patel"));
    expect(await findByLabelText("Following Priya Patel")).toBeTruthy();
    expect(followsInsert).toHaveBeenCalledWith({
      user_id: "viewer-u1",
      creator_id: launchCreators[0]!.id,
    });
  });

  it("fires onPressRecipe / onPressCreator with real creator ids", () => {
    const onPressRecipe = vi.fn();
    const onPressCreator = vi.fn();
    const { getByText } = render(
      <FollowingFeed
        enabled
        creators={launchCreators}
        recipes={recipes}
        onPressRecipe={onPressRecipe}
        onPressCreator={onPressCreator}
      />,
    );
    fireEvent.press(getByText("Priya Patel"));
    expect(onPressCreator).toHaveBeenCalledWith(launchCreators[0]!.id);
    fireEvent.press(getByText("Harissa chickpea stew"));
    expect(onPressRecipe).toHaveBeenCalled();
  });

  it("renders nothing when disabled", () => {
    const { toJSON } = render(
      <FollowingFeed
        enabled={false}
        creators={launchCreators}
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

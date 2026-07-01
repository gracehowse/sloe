// @vitest-environment jsdom
/**
 * RefineByDescribing (ENG-974) — mobile component behaviour.
 *
 * Protects the observable behaviour on iOS (the primary surface):
 *  - typing a correction + submitting POSTs to `/api/nutrition/refine-log` with
 *    the CURRENT items + refinement text + source, and calls `onRefined` +
 *    `onRoundComplete` with the corrected result (conversational re-estimate)
 *  - the submit fires `ai_log_refine_submitted` (source + round + textLength only)
 *  - the submit button is disabled with empty text (no double-submit / no-op)
 *  - past the round limit the input is replaced by a calm "log it" line
 *
 * Web parity of the same gating is pinned in
 * `tests/unit/refineByDescribingWiring.test.tsx`.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

const track = vi.fn((_name?: string, _payload?: Record<string, unknown>) => undefined);
const isFeatureEnabled = vi.fn((_flag?: string) => true);
vi.mock("@/lib/analytics", () => ({
  track: (name: string, payload?: Record<string, unknown>) => track(name, payload),
  isFeatureEnabled: (flag: string) => isFeatureEnabled(flag),
}));

import RefineByDescribing from "../../components/RefineByDescribing";
import type { PhotoLogItemRanged } from "@suppr/nutrition-core/photoLogRanges";

const COLORS = {
  text: "#221B26",
  textSecondary: "#6A6072",
  textTertiary: "#9B93A3",
  card: "#FFFFFF",
  cardBorder: "#E7E2EC",
  background: "#FFFFFF",
  inputBg: "#F4F1EA",
  border: "#E7E2EC",
  primaryForeground: "#FFFFFF",
};

const PHOTO_ITEMS: PhotoLogItemRanged[] = [
  {
    id: "ai-rice",
    name: "White rice",
    category: "Carbs",
    calories: { low: 190, high: 210 },
    protein: null,
    carbs: null,
    fat: null,
    confidence: "high",
    source: "ai",
  },
];

const REFINE_RESPONSE = {
  ok: true,
  round: 2,
  items: [
    {
      id: "ai-chicken",
      name: "Grilled chicken",
      category: "Protein",
      calories: { low: 190, high: 210 },
      protein: null,
      carbs: null,
      fat: null,
      confidence: "high",
      source: "ai",
    },
  ],
  notes: "Removed the rice.",
};

let lastBody: any = null;

function stubOkFetch() {
  lastBody = null;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      lastBody = init?.body ? JSON.parse(String(init.body)) : null;
      return {
        ok: true,
        json: async () => REFINE_RESPONSE,
      } as unknown as Response;
    }),
  );
}

describe("RefineByDescribing (mobile component)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isFeatureEnabled.mockReturnValue(true);
    stubOkFetch();
  });

  it("submit posts the current items + correction and reports the corrected result", async () => {
    const onRefined = vi.fn();
    const onRoundComplete = vi.fn();
    const { getByLabelText } = render(
      <RefineByDescribing
        source="photo"
        apiBase="https://api.test"
        accessToken="tok"
        items={PHOTO_ITEMS}
        notes={null}
        round={1}
        onRoundComplete={onRoundComplete}
        onRefined={onRefined}
        accent={{ primary: "#8A5A9B" }}
        colors={COLORS}
      />,
    );

    fireEvent.changeText(getByLabelText("Add a detail to refine the estimate"), "no rice");
    fireEvent.press(getByLabelText("Apply this correction"));

    // Let the fetch microtask settle.
    await vi.waitFor(() => expect(onRefined).toHaveBeenCalledTimes(1));

    // Request carried the CURRENT items + correction + source.
    expect(lastBody.source).toBe("photo");
    expect(lastBody.refinementText).toBe("no rice");
    expect(lastBody.items.map((i: { name: string }) => i.name)).toEqual(["White rice"]);

    // Corrected result reported up to the host.
    expect(onRefined).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([expect.objectContaining({ name: "Grilled chicken" })]),
        notes: "Removed the rice.",
      }),
    );
    expect(onRoundComplete).toHaveBeenCalledTimes(1);

    // Analytics: source + round + textLength (never the text itself).
    const call = track.mock.calls.find((c) => c[0] === "ai_log_refine_submitted");
    expect(call?.[1]).toMatchObject({ source: "photo", round: 1, textLength: "no rice".length });
    expect(JSON.stringify(call?.[1])).not.toContain("no rice");
  });

  it("submit is a no-op with empty text (disabled — no double-submit)", () => {
    const onRefined = vi.fn();
    const { getByLabelText } = render(
      <RefineByDescribing
        source="photo"
        apiBase="https://api.test"
        items={PHOTO_ITEMS}
        notes={null}
        round={1}
        onRoundComplete={vi.fn()}
        onRefined={onRefined}
        accent={{ primary: "#8A5A9B" }}
        colors={COLORS}
      />,
    );
    fireEvent.press(getByLabelText("Apply this correction"));
    expect(global.fetch).not.toHaveBeenCalled();
    expect(onRefined).not.toHaveBeenCalled();
  });

  it("past the round limit renders the calm 'log it or start over' line, not the input", () => {
    const { queryByLabelText, getByText } = render(
      <RefineByDescribing
        source="photo"
        apiBase="https://api.test"
        items={PHOTO_ITEMS}
        notes={null}
        round={99}
        onRoundComplete={vi.fn()}
        onRefined={vi.fn()}
        accent={{ primary: "#8A5A9B" }}
        colors={COLORS}
      />,
    );
    expect(queryByLabelText("Add a detail to refine the estimate")).toBeNull();
    expect(getByText(/plenty of refining/i)).toBeTruthy();
  });
});

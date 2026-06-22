// @vitest-environment jsdom
/**
 * ReportRecipeSheet (mobile, ENG-1227) — the iOS-primary parity mirror of the
 * web `ReportRecipeDialog` (#19). Same routing + the same durable queue:
 * copyright → the DMCA form (`/dmca?recipe=`) opened in the browser; everything
 * else → a describe step → POST /api/recipe-report → acknowledgement. Guards the
 * legal-reviewed copy. Mirrors `tests/unit/reportRecipeDialog.test.tsx`.
 */
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import { ReportRecipeSheet } from "../../components/recipe/ReportRecipeSheet";

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#555",
    textTertiary: "#888",
    background: "#fff",
    card: "#fff",
    cardBorder: "#eee",
    primaryForeground: "#fff",
  }),
}));

vi.mock("@/context/theme", () => ({ useAccent: () => ({ primary: "#3b2a4d" }) }));

vi.mock("@/lib/supprWeb", () => ({ getSupprApiBase: () => "https://app.test" }));

void React;

function setup() {
  const onClose = vi.fn();
  const utils = render(
    <ReportRecipeSheet visible onClose={onClose} recipeId="r_demo_123" recipeTitle="Tahini bowl" />,
  );
  return { onClose, ...utils };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ReportRecipeSheet (mobile)", () => {
  it("routes a copyright report to the pre-filled DMCA form and closes", () => {
    const open = vi.spyOn(Linking, "openURL").mockResolvedValue(true);
    const { onClose, getByLabelText } = setup();
    fireEvent.press(getByLabelText("Copyright — this is my content"));
    expect(open).toHaveBeenCalledWith("https://app.test/dmca?recipe=r_demo_123");
    expect(onClose).toHaveBeenCalled();
  });

  it("logs a non-copyright report to the durable queue + acknowledges", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const { getByLabelText, getByPlaceholderText, queryByText } = setup();

    fireEvent.press(getByLabelText("Inappropriate or unsafe"));
    fireEvent.changeText(getByPlaceholderText("What's wrong? (optional)"), "raw chicken step");
    fireEvent.press(getByLabelText("Submit report"));

    await waitFor(() => expect(queryByText("Thanks for flagging this")).not.toBeNull());
    expect(fetchMock).toHaveBeenCalledWith(
      "https://app.test/api/recipe-report",
      expect.objectContaining({ method: "POST" }),
    );
    const sentBody = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(sentBody).toMatchObject({
      recipeId: "r_demo_123",
      reason: "unsafe",
      description: "raw chicken step",
    });
  });

  it("falls back to an email channel when the queue POST fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 500 }));
    const { getByLabelText, queryByText } = setup();
    fireEvent.press(getByLabelText("Incorrect nutrition or instructions"));
    fireEvent.press(getByLabelText("Submit report"));
    await waitFor(() => expect(queryByText("Couldn't save that")).not.toBeNull());
  });

  it("uses legally-reviewed copy (no 'own this recipe', no guaranteed takedown)", () => {
    const { queryByText } = setup();
    expect(queryByText("Copyright — this is my content")).not.toBeNull();
    expect(queryByText("I own this recipe")).toBeNull();
    expect(queryByText("Starts a copyright takedown request with our team.")).not.toBeNull();
  });
});

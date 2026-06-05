// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";

import { Layout } from "../../constants/layout";
import { TodayScrollSectionHeader } from "../../components/today/TodayScrollSectionHeader";

void React;

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, s) => ({ ...acc, ...flattenStyle(s) }),
      {},
    );
  }
  return (style as Record<string, unknown>) ?? {};
}

describe("TodayScrollSectionHeader — Figma TD1/TD2 section chrome", () => {
  it("renders the plum section title and muted date subline", () => {
    const { getByText } = render(
      <TodayScrollSectionHeader
        title="Activity & energy"
        subtitle="Wednesday, 3 June"
        testID="today-activity-section-header"
      />,
    );
    expect(getByText("Activity & energy")).toBeTruthy();
    expect(getByText("Wednesday, 3 June")).toBeTruthy();
  });

  it("uses mb-5 (Layout.todaySectionHeaderGap) before the first card in the section", () => {
    const { getByTestId } = render(
      <TodayScrollSectionHeader
        title="Hydration & stimulants"
        subtitle="Wednesday, 3 June"
        testID="today-scroll-section-header"
      />,
    );
    const style = flattenStyle(getByTestId("today-scroll-section-header").props.style);
    expect(style.marginBottom).toBe(Layout.todaySectionHeaderGap);
  });
});

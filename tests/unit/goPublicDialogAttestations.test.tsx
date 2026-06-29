// @vitest-environment jsdom
/**
 * GoPublicDialog — v3 three-attestation checklist (ENG-1247 A9).
 *
 * The live dialog shipped a single "I created this" checkbox. The v3
 * prototype (`docs/ux/redesign/v3/Sloe-App.html`, GoPublic) gates publishing
 * on THREE honest attestations — creator/adaptation, nutrition-is-an-estimate,
 * and photo-rights — with the Publish CTA disabled until all three are ticked.
 * This pins the conformed behaviour so it can't regress to a single checkbox.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { GoPublicDialog } from "../../src/app/components/GoPublicDialog";

void React;

describe("GoPublicDialog — three-attestation publish gate", () => {
  it("renders all three prototype attestations", () => {
    render(
      <GoPublicDialog
        recipeTitle="Harissa chickpea stew"
        autoOpen
        onConfirmPublish={() => {}}
      />,
    );

    expect(
      screen.getByText("This is my own recipe or my adaptation"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nutrition is my best, honest estimate"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("I have the rights to any photo I add"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("keeps Publish disabled until ALL three are ticked, then confirms", () => {
    const onConfirmPublish = vi.fn();
    render(
      <GoPublicDialog
        recipeTitle="Harissa chickpea stew"
        autoOpen
        onConfirmPublish={onConfirmPublish}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    const publish = () => screen.getByRole("button", { name: "Publish" });

    expect(publish()).toBeDisabled();

    // One short of all three stays disabled.
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(publish()).toBeDisabled();

    // All three → enabled, and the confirm callback fires on click.
    fireEvent.click(checkboxes[2]);
    expect(publish()).toBeEnabled();
    fireEvent.click(publish());
    expect(onConfirmPublish).toHaveBeenCalledTimes(1);
  });
});

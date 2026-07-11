// @vitest-environment jsdom
/**
 * ProgressEnergyEquation (mobile, ENG-1225 Block 8) — the v3 Progress energy
 * balance as an equation. Parity twin of the web
 * `tests/unit/progressEnergyEquation.test.tsx`. Pins the intake − maintenance =
 * deficit/day layout, the result-sign formatting, the surplus label, the null
 * "—" fallbacks, and the "How maintenance works" explainer toggle.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#221B26",
    textSecondary: "#6A6072",
    textTertiary: "#9B93A3",
    navPrimary: "#3B2A4D",
  }),
}));
vi.mock("react-native/Libraries/Utilities/useColorScheme", () => ({
  default: () => "light",
}));

import { ProgressEnergyEquation } from "../../components/progress/ProgressEnergyEquation";

const base = {
  avgIntakeKcal: 1900,
  maintenanceKcal: 2240,
  deficitKcal: 340,
  isSurplus: false,
  isAdaptive: true,
};

describe("ProgressEnergyEquation (mobile)", () => {
  it("renders the equation terms: intake, maintenance, and a signed deficit", () => {
    const { getByText } = render(<ProgressEnergyEquation {...base} />);
    expect(getByText("Energy balance · 7-day average")).toBeTruthy();
    expect(getByText("1,900")).toBeTruthy(); // avg intake
    expect(getByText("2,240")).toBeTruthy(); // maintenance
    expect(getByText("−340")).toBeTruthy(); // deficit (minus sign)
    expect(getByText("Deficit/day")).toBeTruthy();
  });

  it("renders a surplus as +N with the Surplus/day label", () => {
    const { getByText } = render(
      <ProgressEnergyEquation
        {...base}
        deficitKcal={-180}
        isSurplus={true}
      />,
    );
    expect(getByText("+180")).toBeTruthy();
    expect(getByText("Surplus/day")).toBeTruthy();
  });

  it("renders '—' for null intake / maintenance / deficit", () => {
    const { getAllByText } = render(
      <ProgressEnergyEquation
        avgIntakeKcal={null}
        maintenanceKcal={null}
        deficitKcal={null}
        isSurplus={false}
        isAdaptive={false}
      />,
    );
    // three em-dash terms (intake, maintenance, result)
    expect(getAllByText("—").length).toBe(3);
  });

  it("toggles the 'How maintenance works' explainer", () => {
    const { getByTestId, queryByText } = render(
      <ProgressEnergyEquation {...base} />,
    );
    expect(queryByText(/Maintenance \(your TDEE\)/)).toBeNull();
    fireEvent.press(getByTestId("progress-energy-how"));
    expect(queryByText(/Maintenance \(your TDEE\)/)).not.toBeNull();
    // adaptive estimate copy shows when maintenance is present + adaptive
    expect(queryByText("adaptive estimate")).not.toBeNull();
  });
});


describe("ENG-1497 corner parity", () => {
  it("the equation card carries NO radius override (24 card default)", () => {
    const src = require("node:fs").readFileSync(
      require("node:path").resolve(__dirname, "../../components/progress/ProgressEnergyEquation.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/radius="/);
  });
});

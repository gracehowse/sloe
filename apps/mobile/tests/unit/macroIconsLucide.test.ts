import { Dumbbell, Droplet, Flame, Sprout, Wheat } from "lucide-react-native";
import { FIGMA_MACRO_ICON_GLYPHS } from "@suppr/shared/macroIcons";
import { MACRO_ICONS } from "@/lib/macroIconsLucide";

describe("macroIconsLucide (ENG-986 mobile)", () => {
  it("binds the shared glyph map to lucide-react-native components", () => {
    expect(MACRO_ICONS.calories).toBe(Flame);
    expect(MACRO_ICONS.protein).toBe(Dumbbell);
    expect(MACRO_ICONS.carbs).toBe(Wheat);
    expect(MACRO_ICONS.fat).toBe(Droplet);
    expect(MACRO_ICONS.fiber).toBe(Sprout);
    expect(FIGMA_MACRO_ICON_GLYPHS.protein).toBe("Dumbbell");
  });
});

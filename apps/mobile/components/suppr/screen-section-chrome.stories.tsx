import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Text, View } from "react-native";
import { ArrowLeft, CalendarDays } from "lucide-react-native";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { PressableScale } from "@/components/ui/PressableScale";
import { Colors, IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { ScreenSectionChrome } from "./screen-section-chrome";

/** The round chrome control the real headers hang off `trailing` / `leading`. */
function RoundControl({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <PressableScale
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => undefined}
      style={{
        width: Spacing.xxxl,
        height: Spacing.xxxl,
        borderRadius: Radius.full,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: Colors.light.backgroundSecondary,
      }}
    >
      {children}
    </PressableScale>
  );
}

const meta = {
  title: "Mobile/Suppr/ScreenSectionChrome",
  component: ScreenSectionChrome,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The one screen header on mobile — brand bar, eyebrow, page title, optional subtitle, plus leading/trailing controls and `children` for sub-tabs. Under `design_consistency_v1` the eyebrow renders the canonical treatment promoted from the Today hero: `Type.eyebrow` FULL-INK caps followed by a faint hairline rule running to the margin, drawn in the `border` token (never mid-grey `textTertiary`, which reads as a hard rule and fights the title). Web twin: `ScreenChrome`.",
      },
    },
  },
} satisfies Meta<typeof ScreenSectionChrome>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The canonical eyebrow: ink caps, then the hairline rule to the margin. */
export const WithOverline: Story = {
  args: {
    overline: "Your trends",
    title: "Progress",
    subtitle: "Last 7 days",
    showBrand: false,
  },
};

export const BrandShown: Story = {
  args: {
    overline: null,
    title: "Today",
    showBrand: true,
  },
};

/** A trailing control on the title row — the eyebrow rule still runs to the
 *  margin, because eyebrow and control sit on different optical lines. */
export const WithTrailingControl: Story = {
  args: {
    overline: "Plan",
    title: "Meal plan",
    subtitle: "14–20 Jul",
    trailing: (
      <RoundControl label="Open calendar">
        <CalendarDays size={IconSize.lg} color={Colors.light.text} />
      </RoundControl>
    ),
  },
};

/** Pushed utility surface: the `leading` back affordance, mirroring web
 *  `ScreenChrome`'s `leading` prop. */
export const WithLeadingBack: Story = {
  args: {
    overline: "Account",
    title: "Settings",
    leading: (
      <RoundControl label="Back">
        <ArrowLeft size={IconSize.lg} color={Colors.light.text} />
      </RoundControl>
    ),
  },
};

/** `overlineRule={false}` — the deliberate opt-out for the rare header where a
 *  control shares the eyebrow's optical line. Falls back to the pre-consistency
 *  tertiary `Type.label` eyebrow with no rule. */
export const WithoutEyebrowRule: Story = {
  args: {
    overline: "Shopping",
    title: "Shopping list",
    overlineRule: false,
  },
};

/** Sub-tabs passed as `children`, rendered inside the sticky header. */
export const WithSubTabs: Story = {
  args: {
    overline: "Cookbook",
    title: "Your library",
    children: (
      <View
        style={{
          flexDirection: "row",
          gap: Spacing.sm,
          paddingHorizontal: Spacing.md,
          paddingBottom: Spacing.dense,
        }}
      >
        {["All", "Saved", "Imported"].map((label, i) => (
          <View
            key={label}
            style={{
              paddingHorizontal: Spacing.dense,
              paddingVertical: Spacing.xs,
              borderRadius: Radius.full,
              borderWidth: i === 0 ? 0 : 1,
              borderColor: Colors.light.border,
              backgroundColor: i === 0 ? Colors.light.text : "transparent",
            }}
          >
            <Text
              style={{
                ...Type.caption,
                fontWeight: "600",
                color: i === 0 ? Colors.light.background : Colors.light.textSecondary,
              }}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>
    ),
  },
};

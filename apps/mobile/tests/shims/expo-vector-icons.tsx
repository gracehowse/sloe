/**
 * `@expo/vector-icons` shim for vitest.
 *
 * The real package pulls in native font-loading modules that don't
 * work under Node. For render tests we only need `Ionicons` (and its
 * siblings) to produce a predictable host node with the icon name
 * preserved on an `accessibilityLabel` / data-attribute — most tests
 * look icons up by their parent `accessibilityLabel`, not the icon
 * name itself, so we keep the real component semantics minimal.
 */
import * as React from "react";

type IconProps = {
  name?: string;
  size?: number;
  color?: string;
  children?: React.ReactNode;
} & Record<string, unknown>;

function makeIcon(family: string): React.ForwardRefExoticComponent<
  IconProps & React.RefAttributes<unknown>
> & { glyphMap: Record<string, number> } {
  const Cmp = React.forwardRef<unknown, IconProps>(function Icon(props, _ref) {
    const { name, children: _children, ...rest } = props;
     
    const elementType: any = "Text";
    const label: React.ReactNode = typeof name === "string" ? name : "";
    return React.createElement(
      elementType,
      {
        ...rest,
        accessibilityRole: "image",
        "data-icon-family": family,
        "data-icon-name": typeof name === "string" ? name : "",
      },
      label,
    );
  });
  Cmp.displayName = family;
  const withGlyphs = Cmp as React.ForwardRefExoticComponent<
    IconProps & React.RefAttributes<unknown>
  > & { glyphMap: Record<string, number> };
  // `glyphMap` is consumed by one component as a `keyof Ionicons.glyphMap`
  // type guard; an empty object is type-safe enough for tests.
  withGlyphs.glyphMap = {};
  return withGlyphs;
}

export const Ionicons = makeIcon("Ionicons");
export const MaterialIcons = makeIcon("MaterialIcons");
export const MaterialCommunityIcons = makeIcon("MaterialCommunityIcons");
export const Feather = makeIcon("Feather");
export const FontAwesome = makeIcon("FontAwesome");
export const FontAwesome5 = makeIcon("FontAwesome5");
export const AntDesign = makeIcon("AntDesign");
export const Entypo = makeIcon("Entypo");
export const EvilIcons = makeIcon("EvilIcons");
export const Foundation = makeIcon("Foundation");
export const Octicons = makeIcon("Octicons");
export const SimpleLineIcons = makeIcon("SimpleLineIcons");
export const Zocial = makeIcon("Zocial");

export default {
  Ionicons,
  MaterialIcons,
  MaterialCommunityIcons,
  Feather,
  FontAwesome,
  FontAwesome5,
  AntDesign,
  Entypo,
  EvilIcons,
  Foundation,
  Octicons,
  SimpleLineIcons,
  Zocial,
};

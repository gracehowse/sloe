/** Storybook stub — vector icons as empty text on Chromatic. */
import * as React from "react";
import { Text, type TextProps } from "react-native";

type IconProps = TextProps & {
  name?: string;
  size?: number;
  color?: string;
};

function makeIcon() {
  return function StubIcon({ name: _n, size: _s, color, style, ...rest }: IconProps) {
    return <Text {...rest} style={[{ color, fontSize: _s }, style]} />;
  };
}

export const Ionicons = makeIcon();
export const MaterialIcons = makeIcon();
export const MaterialCommunityIcons = makeIcon();
export const FontAwesome = makeIcon();
export const Feather = makeIcon();
export const AntDesign = makeIcon();
export const Entypo = makeIcon();
export const EvilIcons = makeIcon();
export const FontAwesome5 = makeIcon();
export const Foundation = makeIcon();
export const Octicons = makeIcon();
export const SimpleLineIcons = makeIcon();
export const Zocial = makeIcon();

export default { Ionicons };

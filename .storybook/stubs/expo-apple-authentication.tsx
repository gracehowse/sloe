/** Storybook stub — Apple auth unavailable on Chromatic web. */
import * as React from "react";
import { View, type ViewProps } from "react-native";

export const AppleAuthenticationScope = {
  FULL_NAME: 0,
  EMAIL: 1,
} as const;

export const AppleAuthenticationButtonType = {
  SIGN_IN: 0,
  CONTINUE: 1,
  SIGN_UP: 2,
} as const;

export const AppleAuthenticationButtonStyle = {
  WHITE: 0,
  WHITE_OUTLINE: 1,
  BLACK: 2,
} as const;

export async function isAvailableAsync(): Promise<boolean> {
  return false;
}

export async function signInAsync(_options?: unknown): Promise<never> {
  throw new Error("Apple Authentication is unavailable in Storybook");
}

export function AppleAuthenticationButton(props: ViewProps) {
  return <View {...props} />;
}

export default {
  AppleAuthenticationScope,
  AppleAuthenticationButtonType,
  AppleAuthenticationButtonStyle,
  isAvailableAsync,
  signInAsync,
  AppleAuthenticationButton,
};

/** Storybook stub — expo-router navigation no-ops on RN-web Chromatic. */
export type Href = string;

export function useRouter() {
  return {
    push: (_href: Href) => undefined,
    replace: (_href: Href) => undefined,
    back: () => undefined,
    canGoBack: () => false,
    setParams: (_params: Record<string, unknown>) => undefined,
    navigate: (_href: Href) => undefined,
  };
}

export function usePathname() {
  return "/";
}

export function useLocalSearchParams<T extends Record<string, string> = Record<string, string>>(): T {
  return {} as T;
}

export function useSegments() {
  return [] as string[];
}

export function Link(_props: { children?: unknown; href?: Href }) {
  return null;
}

export function Redirect(_props: { href: Href }) {
  return null;
}

export function Stack(_props: Record<string, unknown>) {
  return null;
}

export function Tabs(_props: Record<string, unknown>) {
  return null;
}

export default {
  useRouter,
  usePathname,
  useLocalSearchParams,
  useSegments,
  Link,
  Redirect,
  Stack,
  Tabs,
};

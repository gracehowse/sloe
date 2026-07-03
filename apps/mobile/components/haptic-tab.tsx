import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { useHaptics } from '@/hooks/useHaptics';

export function HapticTab(props: BottomTabBarButtonProps) {
  const haptics = useHaptics();
  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        haptics.select();
        props.onPressIn?.(ev);
      }}
    />
  );
}

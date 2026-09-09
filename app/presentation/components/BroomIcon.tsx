import {Image} from 'react-native';

type BroomIconProps = {
  darkMode: boolean;
  size?: number;
};

/**
 * Cleaning broom icon.
 * Uses the provided black asset in light mode and white asset in dark mode.
 */
export function BroomIcon({darkMode, size = 22}: BroomIconProps) {
  return (
    <Image
      source={
        darkMode
          ? require('../assets/broom-white.png')
          : require('../assets/broom-black.png')
      }
      style={{width: size, height: size}}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}

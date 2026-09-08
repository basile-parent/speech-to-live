export type AppThemeColors = {
  background: string;
  surface: string;
  surfaceSelected: string;
  border: string;
  borderSelected: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  error: string;
  meterBackground: string;
  stepTrack: string;
  stepActive: string;
  stepSelected: string;
};

export const lightTheme: AppThemeColors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceSelected: '#F2F8F4',
  border: '#D0D0D0',
  borderSelected: '#1F6B3A',
  text: '#111111',
  textSecondary: '#555555',
  textMuted: '#888888',
  accent: '#1F6B3A',
  accentSoft: '#7FB392',
  error: '#B00020',
  meterBackground: '#0A0A0A',
  stepTrack: '#E6E6E6',
  stepActive: '#7FB392',
  stepSelected: '#1F6B3A',
};

export const darkTheme: AppThemeColors = {
  background: '#121212',
  surface: '#1C1C1C',
  surfaceSelected: '#1A2E22',
  border: '#3A3A3A',
  borderSelected: '#3D9B5F',
  text: '#F2F2F2',
  textSecondary: '#B0B0B0',
  textMuted: '#8A8A8A',
  accent: '#3D9B5F',
  accentSoft: '#2F6B45',
  error: '#FF6B7A',
  meterBackground: '#0A0A0A',
  stepTrack: '#2A2A2A',
  stepActive: '#2F6B45',
  stepSelected: '#3D9B5F',
};

export function getAppTheme(darkMode: boolean): AppThemeColors {
  return darkMode ? darkTheme : lightTheme;
}

export type ThemeMode = 'system' | 'dark' | 'light';

export const StitchTokens = {
  colors: {
    surface: '#F7F9FB',
    surfaceDim: '#D8DADC',
    surfaceBright: '#F7F9FB',
    surfaceContainerLowest: '#FFFFFF',
    surfaceContainerLow: '#F2F4F6',
    surfaceContainer: '#ECEEF0',
    surfaceContainerHigh: '#E6E8EA',
    surfaceContainerHighest: '#E0E3E5',
    onSurface: '#191C1E',
    onSurfaceVariant: '#45464D',
    inverseSurface: '#2D3133',
    inverseOnSurface: '#EFF1F3',
    outline: '#76777D',
    outlineVariant: '#C6C6CD',
    surfaceTint: '#565E74',
    primary: '#000000',
    onPrimary: '#FFFFFF',
    primaryContainer: '#131B2E',
    onPrimaryContainer: '#7C839B',
    inversePrimary: '#BEC6E0',
    secondary: '#855300',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#FEA619',
    onSecondaryContainer: '#684000',
    tertiary: '#000000',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#002113',
    onTertiaryContainer: '#009668',
    error: '#BA1A1A',
    onError: '#FFFFFF',
    errorContainer: '#FFDAD6',
    onErrorContainer: '#93000A',
    primaryFixed: '#DAE2FD',
    primaryFixedDim: '#BEC6E0',
    onPrimaryFixed: '#131B2E',
    onPrimaryFixedVariant: '#3F465C',
    secondaryFixed: '#FFDDB8',
    secondaryFixedDim: '#FFB95F',
    onSecondaryFixed: '#2A1700',
    onSecondaryFixedVariant: '#653E00',
    tertiaryFixed: '#6FFBBE',
    tertiaryFixedDim: '#4EDEA3',
    onTertiaryFixed: '#002113',
    onTertiaryFixedVariant: '#005236',
    background: '#F7F9FB',
    onBackground: '#191C1E',
    surfaceVariant: '#E0E3E5',
  },
};

export interface AppThemeTokens {
  background: string;
  backgroundAlt: string;
  card: string;
  cardHover: string;
  surface: string;
  surfaceAlt: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderLight: string;
  inputBackground: string;
  gold: string;
  goldDark: string;
  goldGradient: readonly [string, string];
  primary: string;
  primaryLightTint: string;
  primaryGradient: readonly [string, string];
  accent: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  glassOverlay: string;
  activeTabBg: string;
  activeTabIcon: string;
  inactiveTabIcon: string;
  dockBg: string;
  shimmer: string;
  statusBarStyle: 'light-content' | 'dark-content';
}

export const HomeOrbitTheme: { light: AppThemeTokens; dark: AppThemeTokens } = {
  dark: {
    background: '#121414',
    backgroundAlt: '#161818',
    card: '#1a1c1c',
    cardHover: '#222525',
    surface: '#1a1c1c',
    surfaceAlt: '#1f2222',
    textPrimary: '#F5F5F5',
    textSecondary: '#d0c5af',
    textMuted: '#76777D',
    border: 'rgba(255, 255, 255, 0.08)',
    borderLight: 'rgba(255, 255, 255, 0.12)',
    inputBackground: '#121414',
    gold: '#f2ca50',
    goldDark: '#3c2f00',
    goldGradient: ['#f2ca50', '#d4af37'] as const,
    primary: '#f2ca50',
    primaryLightTint: 'rgba(242, 202, 80, 0.15)',
    primaryGradient: ['#f2ca50', '#d4af37'] as const,
    accent: '#f2ca50',
    success: '#10B981',
    warning: '#f2ca50',
    danger: '#EF4444',
    info: '#3B82F6',
    glassOverlay: 'rgba(18, 20, 20, 0.88)',
    activeTabBg: '#f2ca50',
    activeTabIcon: '#3c2f00',
    inactiveTabIcon: '#76777D',
    dockBg: '#161818',
    shimmer: '#1f2222',
    statusBarStyle: 'light-content',
  },
  light: {
    background: '#FAF7F2',
    backgroundAlt: '#F8EFE4',
    card: '#FFFFFF',
    cardHover: '#FFF9F2',
    surface: '#FFFFFF',
    surfaceAlt: '#FFF0DE',
    textPrimary: '#1F2937',
    textSecondary: '#5C4E3D',
    textMuted: '#8C7A6B',
    border: '#E7E1DA',
    borderLight: 'rgba(231, 225, 218, 0.6)',
    inputBackground: '#FFFFFF',
    gold: '#DE8626',
    goldDark: '#B84D00',
    goldGradient: ['#F59E0B', '#DE8626'] as const,
    primary: '#DE8626',
    primaryLightTint: '#FFF0DE',
    primaryGradient: ['#F59E0B', '#E58B24'] as const,
    accent: '#DE8626',
    success: '#17845A',
    warning: '#FEA619',
    danger: '#DC2626',
    info: '#346CB0',
    glassOverlay: 'rgba(250, 247, 242, 0.94)',
    activeTabBg: '#DE8626',
    activeTabIcon: '#FFFFFF',
    inactiveTabIcon: '#8C7A6B',
    dockBg: '#FFFFFF',
    shimmer: '#EDE8E1',
    statusBarStyle: 'dark-content',
  },
};

// Default export structure maintaining full backwards compatibility for existing imports
export const Colors = {
  // Stitch Token reference
  stitch: StitchTokens.colors,

  // Theme Presets
  light: HomeOrbitTheme.light,
  dark: HomeOrbitTheme.dark,

  // Default Palette (Menza Warm Porcelain & Terracotta)
  background: '#FAF7F2',
  backgroundCard: '#FFFFFF',
  backgroundCardBorder: '#E7E1DA',
  surface: '#FFFFFF',
  surfaceLight: '#FFF9F2',

  // Brand Colors
  primary: '#DE8626',
  primaryLightTint: '#FFF0DE',
  primaryDark: '#B84D00',
  primaryGradient: ['#F59E0B', '#E58B24'] as const,
  accent: '#DE8626',
  amber: '#FEA619',
  rose: '#DC2626',
  danger: '#DC2626',
  secondary: '#17845A',
  secondaryGradient: ['#34D399', '#17845A'] as const,

  // Status Indicators
  status: {
    success: '#17845A',
    warning: '#FEA619',
    danger: '#DC2626',
    info: '#346CB0',
    successBgLight: '#E4F5EC',
    successTextLight: '#17845A',
    warningBgLight: '#FFF3DC',
    warningTextLight: '#A96300',
    dangerBgLight: '#FEE2E2',
    dangerTextLight: '#DC2626',
    infoBgLight: '#EAF2FD',
    infoTextLight: '#346CB0',
  },

  // Text Colors
  textPrimary: '#1F2937',
  textSecondary: '#5C4E3D',
  textMuted: '#8C7A6B',
  textInverse: '#FFFFFF',

  // UI Accents
  border: '#E7E1DA',
  divider: '#E9E3DC',
  glassOverlay: 'rgba(250, 247, 242, 0.94)',
  inputBackground: '#FFFFFF',

  // Role Badge Colors
  roles: {
    SuperAdmin: '#8B5CF6',
    Owner: '#17845A',
    Manager: '#346CB0',
    Cashier: '#DE8626',
    Waiter: '#EC4899',
    Chef: '#DC2626',
  },
};

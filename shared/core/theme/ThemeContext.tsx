import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HomeOrbitTheme, ThemeMode, AppThemeTokens } from './colors';

const THEME_STORAGE_KEY = '@menza_user_theme_mode';

interface ThemeContextType {
  mode: ThemeMode;
  resolvedMode: 'dark' | 'light';
  theme: AppThemeTokens;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'system',
  resolvedMode: 'dark',
  theme: HomeOrbitTheme.dark,
  toggleTheme: () => {},
  setMode: () => {},
  isDark: true,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode; initialMode?: ThemeMode }> = ({
  children,
  initialMode = 'system',
}) => {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(initialMode);

  useEffect(() => {
    // Load persisted theme preference on start
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
      if (stored === 'system' || stored === 'dark' || stored === 'light') {
        setModeState(stored as ThemeMode);
      }
    }).catch(() => {});
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, newMode).catch(() => {});
  };

  const resolvedMode: 'dark' | 'light' =
    mode === 'system'
      ? (systemColorScheme === 'light' ? 'light' : 'dark')
      : mode;

  const toggleTheme = () => {
    const next = resolvedMode === 'dark' ? 'light' : 'dark';
    setMode(next);
  };

  const theme = HomeOrbitTheme[resolvedMode];
  const isDark = resolvedMode === 'dark';

  return (
    <ThemeContext.Provider value={{ mode, resolvedMode, theme, toggleTheme, setMode, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

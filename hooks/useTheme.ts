import { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const THEME_STORAGE_KEY = 'theme';
const SYSTEM_THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export type ThemeMode = 'light' | 'dark' | 'system';

export const normalizeThemeMode = (value: string | null): ThemeMode => (
  value === 'light' || value === 'dark' || value === 'system'
    ? value
    : 'system'
);

export function useTheme() {
  const [darkMode, setDarkMode] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => normalizeThemeMode(localStorage.getItem(THEME_STORAGE_KEY)));
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia(SYSTEM_THEME_MEDIA_QUERY);
    const syncTheme = () => {
      const nextDarkMode = themeMode === 'dark' || (themeMode === 'system' && mediaQuery.matches);
      setDarkMode(nextDarkMode);
      document.documentElement.classList.toggle('dark', nextDarkMode);
    };

    syncTheme();

    if (themeMode !== 'system') {
      return;
    }

    const handleChange = () => syncTheme();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode]);

  useEffect(() => {
    if (!isThemeMenuOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (themeMenuRef.current?.contains(target)) return;
      setIsThemeMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsThemeMenuOpen(false);
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isThemeMenuOpen]);

  const handleThemeModeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    localStorage.setItem(THEME_STORAGE_KEY, mode);
    setIsThemeMenuOpen(false);
  };

  const themeOptions: Array<{
    id: ThemeMode;
    label: string;
    icon: LucideIcon;
  }> = [
    { id: 'light', label: '浅色', icon: Sun },
    { id: 'dark', label: '深色', icon: Moon },
    { id: 'system', label: '跟随系统', icon: Monitor },
  ];

  const currentThemeOption = themeOptions.find(option => option.id === themeMode) || themeOptions[2];

  return {
    darkMode,
    themeMode,
    isThemeMenuOpen,
    setIsThemeMenuOpen,
    themeMenuRef,
    themeOptions,
    currentThemeOption,
    handleThemeModeChange,
  };
}

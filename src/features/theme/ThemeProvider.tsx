import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  isThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "./theme-contract";
import { ThemeContext } from "./theme-context";

function initialPreference(): ThemePreference {
  return "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);
  const [systemDark, setSystemDark] = useState(false);
  const resolved = resolveTheme(preference, systemDark);
  const setPreference = useCallback((value: ThemePreference) => {
    setPreferenceState(value);
    window.localStorage.setItem(THEME_STORAGE_KEY, value);
  }, []);
  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(stored)) setPreferenceState(stored);
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", resolved === "dark" ? "#07131f" : "#f6f8fa");
  }, [resolved]);
  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

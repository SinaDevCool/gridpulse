import { createContext } from "react";
import type { ResolvedTheme, ThemePreference } from "./theme-contract";

export type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (value: ThemePreference) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

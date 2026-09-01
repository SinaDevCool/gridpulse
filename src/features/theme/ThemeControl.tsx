import { Moon, Monitor, Sun } from "lucide-react";
import { useTheme } from "./use-theme";

export function ThemeControl() {
  const { preference, setPreference } = useTheme();
  const next = preference === "system" ? "light" : preference === "light" ? "dark" : "system";
  const Icon = preference === "system" ? Monitor : preference === "light" ? Sun : Moon;
  return (
    <button
      className="theme-control"
      type="button"
      onClick={() => setPreference(next)}
      aria-label={`Theme: ${preference}. Switch to ${next}.`}
      title={`Theme: ${preference}`}
    >
      <Icon aria-hidden="true" />
      <span>{preference}</span>
    </button>
  );
}

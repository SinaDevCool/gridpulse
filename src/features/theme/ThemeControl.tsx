import { Moon, Sun } from "lucide-react";
import { useTheme } from "./use-theme";

export function ThemeControl() {
  const { resolved, setPreference } = useTheme();
  const next = resolved === "light" ? "dark" : "light";
  const Icon = resolved === "light" ? Sun : Moon;
  return (
    <button
      className="theme-control"
      type="button"
      onClick={() => setPreference(next)}
      aria-label={`Theme: ${resolved}. Switch to ${next}.`}
      title={`Switch to ${next} theme`}
    >
      <Icon aria-hidden="true" />
      <span>{resolved}</span>
    </button>
  );
}

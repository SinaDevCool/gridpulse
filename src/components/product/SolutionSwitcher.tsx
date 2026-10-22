import { Link } from "@tanstack/react-router";
import { ChevronDown, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { solutionForPath, solutions } from "./product-navigation";
import { enabledSolutions } from "@/config/solutions";

export function SolutionSwitcher({ pathname }: { pathname: string }) {
  const current = solutionForPath(pathname);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div
      className="solution-switcher"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        disabled={!ready}
        aria-label={`Solution: ${current.label}`}
        aria-expanded={open}
        aria-controls="solution-options"
        onClick={() => setOpen(!open)}
      >
        <span>{current.label}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      <nav id="solution-options" aria-label="Choose solution" hidden={!open}>
        <p>Choose solution</p>
        {solutions
          .filter((item) => enabledSolutions.includes(item.id))
          .map((item) =>
            item.id === current.id ? (
              <button
                key={item.id}
                type="button"
                className="solution-option current"
                onClick={() => {
                  setOpen(false);
                  trigger.current?.focus();
                }}
                aria-label={`${item.label}, current solution`}
              >
                <Check aria-hidden="true" />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            ) : (
              <Link
                key={item.id}
                to={item.to}
                className="solution-option"
                onClick={() => setOpen(false)}
              >
                <span aria-hidden="true" className="solution-option-spacer" />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </Link>
            ),
          )}
        <Link to={current.introduction} onClick={() => setOpen(false)} className="solution-option">
          About {current.label}
        </Link>
      </nav>
    </div>
  );
}

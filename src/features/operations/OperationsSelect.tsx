import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export type OperationsSelectOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
};

export function OperationsSelect<T extends string>({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string;
  label: string;
  value: T;
  options: OperationsSelectOption<T>[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [open, setOpen] = useState(false);
  const [interactive, setInteractive] = useState(false);
  useEffect(() => setInteractive(true), []);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selected = options[selectedIndex];

  useEffect(() => setActiveIndex(selectedIndex), [selectedIndex]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, open]);

  function nextEnabled(start: number, direction: 1 | -1) {
    let index = start;
    for (let count = 0; count < options.length; count += 1) {
      index = (index + direction + options.length) % options.length;
      if (!options[index]?.disabled) return index;
    }
    return start;
  }

  function openAt(index: number) {
    setActiveIndex(options[index]?.disabled ? nextEnabled(index, 1) : index);
    setOpen(true);
  }

  function handleTriggerKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) return;
    event.preventDefault();
    openAt(event.key === "ArrowUp" ? nextEnabled(selectedIndex, -1) : selectedIndex);
  }

  function handleOptionKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "Escape" || event.key === "Tab") {
      setOpen(false);
      if (event.key === "Escape") {
        event.preventDefault();
        rootRef.current?.querySelector<HTMLButtonElement>(".operations-select-trigger")?.focus();
      }
      return;
    }
    const direction = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (direction) {
      event.preventDefault();
      setActiveIndex(nextEnabled(index, direction));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const edge = event.key === "Home" ? -1 : 0;
      setActiveIndex(nextEnabled(edge, event.key === "Home" ? 1 : -1));
    }
  }

  return (
    <div className="operations-select" ref={rootRef}>
      <span id={`${id}-label`}>{label}</span>
      <select
        className="operations-select-native"
        disabled={!interactive}
        name={name}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="operations-select-trigger"
        disabled={!interactive}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        onClick={() => (open ? setOpen(false) : openAt(selectedIndex))}
        onKeyDown={handleTriggerKey}
      >
        <strong id={`${id}-value`}>{selected?.label}</strong>
        <ChevronDown aria-hidden="true" />
      </button>
      {open ? (
        <div className="operations-select-popover">
          <div id={`${id}-listbox`} role="listbox" aria-labelledby={`${id}-label`}>
            {options.map((option, index) => (
              <button
                key={option.value}
                type="button"
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                role="option"
                aria-selected={option.value === value}
                disabled={option.disabled}
                tabIndex={index === activeIndex ? 0 : -1}
                onKeyDown={(event) => handleOptionKey(event, index)}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  requestAnimationFrame(() =>
                    rootRef.current
                      ?.querySelector<HTMLButtonElement>(".operations-select-trigger")
                      ?.focus(),
                  );
                }}
              >
                <span>
                  <strong>{option.label}</strong>
                  {option.description ? <small>{option.description}</small> : null}
                </span>
                {option.value === value ? <Check aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

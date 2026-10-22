import type { MouseEvent } from "react";

/** Pointer convenience supplements, never replaces, each row's native time button. */
export function intervalRow(
  timestamp: string,
  select: (time: string) => void,
  preview?: (time: string | null) => void,
) {
  return {
    onMouseEnter: () => preview?.(timestamp),
    onMouseLeave: () => preview?.(null),
    onFocus: () => preview?.(timestamp),
    onBlur: () => preview?.(null),
    onClick: (event: MouseEvent<HTMLTableRowElement>) => {
      if (!(event.target instanceof Element) || event.target.closest("button,a,input,select"))
        return;
      select(timestamp);
    },
    className: "ops-linked-row",
  };
}

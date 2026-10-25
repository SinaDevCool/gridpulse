import { useEffect, type RefObject } from "react";

/** Shared nonmodal inspector focus lifecycle; no focus trap or scheduling state. */
export function useInspectorFocus(closeRef: RefObject<HTMLButtonElement | null>, onClose: () => void) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const dismiss = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", dismiss);
    return () => {
      document.removeEventListener("keydown", dismiss);
      if (previous?.isConnected) previous.focus();
    };
  }, [closeRef, onClose]);
}

import { useEffect, useState } from "react";
export function usePanelLayout() {
  const [open, setOpen] = useState(false),
    [mobile, setMobile] = useState(false),
    [ready, setReady] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1099px)");
    setMobile(query.matches);
    try {
      setOpen(!query.matches && localStorage.getItem("gridpulse-operations-inputs") !== "closed");
    } catch {
      setOpen(!query.matches);
    }
    setReady(true);
    const changed = () => {
      setMobile(query.matches);
      try {
        setOpen(!query.matches && localStorage.getItem("gridpulse-operations-inputs") !== "closed");
      } catch {
        setOpen(!query.matches);
      }
    };
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  }, []);
  function toggle(value: boolean) {
    setOpen(value);
    if (!mobile)
      try {
        localStorage.setItem("gridpulse-operations-inputs", value ? "open" : "closed");
      } catch {
        /* Optional presentation preference only. */
      }
  }
  return { open, mobile, ready, setOpen: toggle };
}

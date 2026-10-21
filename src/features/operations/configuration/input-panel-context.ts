import { createContext, useContext } from "react";
export const InputPanelContext = createContext<(evidence?: boolean) => void>(() => {});
export function useOpenInputs() {
  return useContext(InputPanelContext);
}

import { validateChangeReference } from "./release-guard.mjs";
validateChangeReference(process.env.CHANGE_REFERENCE);
console.log(
  "Release reference format passed. Live release policy is checked again before publication.",
);

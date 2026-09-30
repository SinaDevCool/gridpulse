import { constraintExposureSchema, type ConstraintExposure } from "./contracts";

export async function fetchConstraintExposure(
  url: string,
  signal?: AbortSignal,
): Promise<ConstraintExposure> {
  const response = await fetch(url, { signal, headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Constraint exposure request failed (${response.status})`);
  const result = constraintExposureSchema.safeParse(await response.json());
  if (!result.success) throw new Error("Constraint exposure response uses an unsupported schema");
  return result.data;
}

/** Bound actual streamed bytes; Content-Length is only an early rejection hint. */
export class OperationsPayloadError extends Error {
  constructor(
    public readonly status: 400 | 413,
    message: string,
  ) {
    super(message);
  }
}

export async function readOperationsJson(request: Request, maximumBytes: number): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > maximumBytes)
    throw new OperationsPayloadError(413, "Operations payload is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new OperationsPayloadError(400, "A JSON payload is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel();
        throw new OperationsPayloadError(413, "Operations payload is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new OperationsPayloadError(400, "Operations payload must be valid UTF-8 JSON.");
  }
}

export function stableOperationsJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableOperationsJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b, "en"))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableOperationsJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export async function operationsFingerprint(value: unknown): Promise<string> {
  return sha256(stableOperationsJson(value));
}

export async function sha256(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

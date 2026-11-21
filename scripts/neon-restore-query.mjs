import { neon } from "@neondatabase/serverless";

/** Each HTTP request gets its own deadline, including requests after a long import. */
export function createRestoreQuery(connection, timeoutMs = 60000) {
  return (text, parameters = []) =>
    neon(connection, { fetchOptions: { signal: AbortSignal.timeout(timeoutMs) } }).query(
      text,
      parameters,
    );
}

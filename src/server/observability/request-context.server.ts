import { AsyncLocalStorage } from "node:async_hooks";

type RequestContext = { requestId: string; error?: unknown };
const contexts = new AsyncLocalStorage<RequestContext>();

export function withRequestContext<T>(requestId: string, action: () => T): T {
  return contexts.run({ requestId }, action);
}
export function recordCapturedError(error: unknown) {
  const context = contexts.getStore();
  if (context) context.error = error;
}
export function consumeLastCapturedError(): unknown {
  const context = contexts.getStore();
  if (!context) return undefined;
  const error = context.error;
  delete context.error;
  return error;
}
export function currentRequestId(): string | undefined {
  return contexts.getStore()?.requestId;
}

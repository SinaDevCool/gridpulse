import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { renderErrorPage } from "./lib/error-page";
import { buildSecurityHeaders } from "./lib/security-headers";
import { unavailableSolutionResponse } from "./server/solution-boundary";
import { solutionOwner } from "./config/solutions";
import {
  consumeLastCapturedError,
  withRequestContext,
} from "./server/observability/request-context.server";

const SECURITY_HEADERS = buildSecurityHeaders(import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_OPERATIONS_MILP_ENABLED === "true" ? import.meta.env.VITE_ANALYTICS_API_URL : undefined);

export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const startHandler = createStartHandler(defaultStreamHandler);

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request) {
    return withRequestContext(crypto.randomUUID(), async () => {
      try {
        const unavailable = unavailableSolutionResponse(request);
        if (unavailable) return withSecurityHeaders(unavailable);
        const response = await startHandler(request);
        const secured = withSecurityHeaders(await normalizeCatastrophicSsrResponse(response));
        secured.headers.set(
          "x-gridpulse-solution",
          solutionOwner(new URL(request.url).pathname) ?? "platform",
        );
        return secured;
      } catch (error) {
        console.error(error);
        return withSecurityHeaders(
          new Response(renderErrorPage(), {
            status: 500,
            headers: { "content-type": "text/html; charset=utf-8" },
          }),
        );
      }
    });
  },
};

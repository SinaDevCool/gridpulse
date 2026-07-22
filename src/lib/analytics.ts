type AnalyticsValue = string | number | boolean;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function trackEvent(name: string, properties: Record<string, AnalyticsValue> = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event: name, ...properties });
  window.dispatchEvent(new CustomEvent("gridpulse:analytics", { detail: { name, properties } }));
}

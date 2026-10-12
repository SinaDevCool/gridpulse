export function secureExternalOrigin(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function buildSecurityHeaders(
  supabaseUrl?: string | null,
): Readonly<Record<string, string>> {
  const supabaseOrigin = secureExternalOrigin(supabaseUrl);
  const connectSources = [
    "'self'",
    "https://tiles.openfreemap.org",
    ...(supabaseOrigin ? [supabaseOrigin] : []),
  ];

  return {
    "content-security-policy": [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com https://tiles.openfreemap.org",
      "img-src 'self' data: blob: https://tiles.openfreemap.org",
      `connect-src ${connectSources.join(" ")}`,
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
    "cross-origin-opener-policy": "same-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "referrer-policy": "strict-origin-when-cross-origin",
    "strict-transport-security": "max-age=31536000; includeSubDomains; preload",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  };
}

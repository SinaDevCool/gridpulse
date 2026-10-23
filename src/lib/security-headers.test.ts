import { describe, expect, it } from "vitest";
import { buildSecurityHeaders, secureExternalOrigin } from "./security-headers";

describe("security headers", () => {
  it("adds only an explicitly configured HTTPS analytics origin", () => {
    const policy = buildSecurityHeaders(undefined, "https://qualified-runtime.onrender.com/v1/jobs")["content-security-policy"];
    expect(policy).toContain("https://qualified-runtime.onrender.com");
    expect(policy).not.toContain("/v1/jobs");
    expect(buildSecurityHeaders(undefined, "http://untrusted.invalid")["content-security-policy"]).not.toContain("untrusted.invalid");
    expect(buildSecurityHeaders()["content-security-policy"]).not.toContain("onrender.com");
  });
  it("permits the configured Cloudflare beacon without wildcard script or connection origins", () => {
    const policy = buildSecurityHeaders()["content-security-policy"];
    expect(policy).toContain(
      "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com;",
    );
    expect(policy).toContain(
      "connect-src 'self' https://tiles.openfreemap.org https://cloudflareinsights.com;",
    );
    expect(policy).not.toContain("https://*");
    expect(policy).not.toContain("unsafe-eval");
  });
  it("allows only the configured Supabase HTTPS origin for browser connections", () => {
    const policy = buildSecurityHeaders("https://project-ref.supabase.co/rest/v1?ignored=true")[
      "content-security-policy"
    ];

    expect(policy).toContain(
      "connect-src 'self' https://tiles.openfreemap.org https://project-ref.supabase.co",
    );
    expect(policy).not.toContain("*.supabase.co");
    expect(policy).not.toContain("another-project.supabase.co");
  });

  it.each([
    ["http://project-ref.supabase.co", null],
    ["not a URL", null],
    ["https://user:password@project-ref.supabase.co", null],
    ["https://project-ref.supabase.co/path", "https://project-ref.supabase.co"],
  ])("normalizes a secure external origin from %s", (value, expected) => {
    expect(secureExternalOrigin(value)).toBe(expected);
  });

  it("preserves the existing restrictive directives", () => {
    const headers = buildSecurityHeaders("https://project-ref.supabase.co");
    const policy = headers["content-security-policy"];

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("worker-src 'self' blob:");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["strict-transport-security"]).toContain("includeSubDomains");
  });
});

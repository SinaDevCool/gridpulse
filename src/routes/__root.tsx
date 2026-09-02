import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  notFound,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/context/AuthContext";
import { isRouteEnabled, productCapabilities } from "@/config/product-mode";
import { ThemeProvider } from "@/features/theme/ThemeProvider";
import { useTheme } from "@/features/theme/use-theme";

const siteUrl = "https://gridpulseinsights.com";
const siteTitle = "GridPulse Power Finder | German Grid Screening";
const siteDescription =
  "GridPulse Power Finder helps infrastructure developers screen German grid nodes, industrial sites, voltage context and source evidence without creating an account.";
const socialImage = `${siteUrl}/gridpulse-og.png`;

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "GridPulse",
      url: siteUrl,
      logo: `${siteUrl}/favicon.ico`,
      description: siteDescription,
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/#software`,
      name: "GridPulse",
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Web",
      url: siteUrl,
      description: siteDescription,
      areaServed: { "@type": "Country", name: "Germany" },
      provider: { "@id": `${siteUrl}/#organization` },
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "GridPulse",
      url: siteUrl,
      inLanguage: "en",
      publisher: { "@id": `${siteUrl}/#organization` },
    },
  ],
};

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: ({ location }) => {
    if (!isRouteEnabled(location.pathname)) throw notFound();
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: siteTitle },
      {
        name: "description",
        content: siteDescription,
      },
      { name: "author", content: "GridPulse" },
      { name: "gridpulse-build", content: __GRIDPULSE_BUILD_SHA__ },
      { name: "gridpulse-environment", content: __GRIDPULSE_BUILD_ENV__ },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { property: "og:site_name", content: "GridPulse" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: siteTitle },
      { property: "og:description", content: siteDescription },
      { property: "og:url", content: siteUrl },
      { property: "og:image", content: socialImage },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "GridPulse Power Finder grid screening map" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: siteTitle },
      { name: "twitter:description", content: siteDescription },
      { name: "twitter:image", content: socialImage },
      { name: "theme-color", content: "#05080f" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "sitemap", type: "application/xml", href: "/sitemap.xml" },
    ],
  }),
  shellComponent: ({ children }: { children: ReactNode }) => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=localStorage.getItem('gridpulse-theme')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}})()`,
          }}
        />
        <HeadContent />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        {children}
        <Scripts />
      </body>
    </html>
  ),
  component: RootComponent,
  notFoundComponent: () => (
    <main id="main-content" className="empty-page">
      <h1>Page not found</h1>
      <p>The requested GridPulse workspace does not exist.</p>
      <Link to="/">Return home</Link>
    </main>
  ),
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <ThemeProvider>
      <RootProviders queryClient={queryClient} />
    </ThemeProvider>
  );
}

function RootProviders({ queryClient }: { queryClient: QueryClient }) {
  const { resolved } = useTheme();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider enabled={productCapabilities.authentication}>
        <Outlet />
        <Toaster theme={resolved} position="bottom-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

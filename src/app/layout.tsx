import type { Metadata, Viewport } from "next";
import Script from "next/script";
import Link from "next/link";
import "./globals.css";
import { SITE } from "@/site";
import { graph, ld } from "@/seo/meta";
import { JsonLd } from "@/components/Blocks";
import { Lockup } from "@/components/Logo";
import { FOOTER_PAIRS, FOOTER_PLACES, TOOL_LINKS } from "@/content/nav";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { template: "%s", default: `${SITE.name} — Time Zone Converter` },
  description: SITE.descriptor,
  applicationName: SITE.name,
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/brand/app-icon-light-192.png", sizes: "192x192" }],
  },
  manifest: "/manifest.webmanifest",
  verification: {
    ...(SITE.googleVerification ? { google: SITE.googleVerification } : {}),
    ...(SITE.bingVerification ? { other: { "msvalidate.01": SITE.bingVerification } } : {}),
  },
  formatDetection: { telephone: false, date: false, address: false, email: false },
  other: SITE.adsenseClient ? { "google-adsense-account": SITE.adsenseClient } : undefined,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#080808" },
  ],
};

const NAV = [
  { href: "/world-clock", label: "World clock" },
  { href: "/time-zones", label: "Time zones" },
  { href: "/time-zone-map", label: "Map" },
  { href: "/meeting-planner", label: "Meeting planner" },
  { href: "/what-time-zone-am-i-in", label: "My time zone" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>

        <header className="site-header">
          <div className="wrap">
            <Link className="brand" href="/" aria-label={`${SITE.name} home`}>
              <Lockup />
            </Link>
            <nav className="nav" aria-label="Main">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} prefetch={false}>
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main id="main">
          <div className="wrap">{children}</div>
        </main>

        <footer className="site-footer">
          <div className="wrap">
            <div className="footcols">
              <div>
                <h2>Popular conversions</h2>
                <ul>
                  {FOOTER_PAIRS.map((p) => (
                    <li key={p.href}>
                      <Link href={p.href} prefetch={false}>
                        {p.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2>Current time</h2>
                <ul>
                  {FOOTER_PLACES.map((p) => (
                    <li key={p.href}>
                      <Link href={p.href} prefetch={false}>
                        {p.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2>Tools</h2>
                <ul>
                  {TOOL_LINKS.map((p) => (
                    <li key={p.href}>
                      <Link href={p.href} prefetch={false}>
                        {p.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2>TimeToZone</h2>
                <ul>
                  <li>
                    <Link href="/about" prefetch={false}>
                      About
                    </Link>
                  </li>
                  <li>
                    <Link href="/contact" prefetch={false}>
                      Contact
                    </Link>
                  </li>
                  <li>
                    <Link href="/privacy" prefetch={false}>
                      Privacy
                    </Link>
                  </li>
                  <li>
                    <Link href="/terms" prefetch={false}>
                      Terms
                    </Link>
                  </li>
                  {SITE.chromeStoreUrl ? (
                    <li>
                      <a href={SITE.chromeStoreUrl} rel="noopener">
                        Chrome extension
                      </a>
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
            <div className="footnote">
              <span>
                © {new Date().getUTCFullYear()} {SITE.name}. {SITE.tagline}
              </span>
              <span>All times computed from the IANA time zone database.</span>
            </div>
          </div>
        </footer>

        <JsonLd data={graph([ld.organization(), ld.website()])} />

        {SITE.adsenseClient ? (
          <Script
            id="adsbygoogle"
            strategy="afterInteractive"
            async
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${SITE.adsenseClient}`}
          />
        ) : null}

        {SITE.gaId ? (
          <>
            <Script
              id="ga-src"
              strategy="lazyOnload"
              src={`https://www.googletagmanager.com/gtag/js?id=${SITE.gaId}`}
            />
            <Script id="ga-init" strategy="lazyOnload">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${SITE.gaId}');`}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}

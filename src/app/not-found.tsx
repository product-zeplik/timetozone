import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found – TimeToZone",
  robots: { index: false, follow: true },
};

/**
 * Kept deliberately small: Next serialises this tree into the RSC payload of
 * every page on the site, so long link lists here cost bytes everywhere.
 */
export default function NotFound() {
  return (
    <>
      <h1>Page not found</h1>
      <p className="answer">
        That URL is not a time zone, a place or a conversion we recognise. The converter on the home page can convert
        any zone to any other.
      </p>
      <p>
        Conversion pages look like <span className="mono">/pst-to-est</span>, place clocks like{" "}
        <span className="mono">/time/uk/london</span>, and zone pages like <span className="mono">/zones/est</span>.
      </p>
      <p>
        <Link href="/">Go to the time zone converter</Link> · <Link href="/world-clock">World clock</Link> ·{" "}
        <Link href="/time-zones">All time zones</Link> · <Link href="/time-zone-map">Time zone map</Link>
      </p>
    </>
  );
}

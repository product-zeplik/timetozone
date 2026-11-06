import type { Metadata } from "next";
import Link from "next/link";
import { Crumbs } from "@/components/Blocks";
import { pageMeta } from "@/seo/meta";
import { SITE } from "@/site";

export const revalidate = 86400;

const TITLE = "Terms of Use – TimeToZone";
const DESCRIPTION =
  "The terms on which TimeToZone is provided: free use, no warranty of accuracy for critical scheduling, acceptable use, intellectual property and the IANA data licence.";

export const metadata: Metadata = pageMeta({ title: TITLE, description: DESCRIPTION, path: "/terms" });

export default function TermsPage() {
  return (
    <>
      <Crumbs items={[{ name: "Home", path: "/" }, { name: "Terms", path: "/terms" }]} />
      <h1>Terms of Use</h1>
      <p className="answer">
        TimeToZone is free to use for personal and commercial purposes. It is provided as is, without warranty. Do not
        rely on it alone for aviation, legal deadlines, medical or other safety-critical timing.
      </p>
      <p className="small">Last updated: 7 November 2026.</p>

      <h2>1. Use of the site</h2>
      <p>
        You may use TimeToZone freely, including at work, and you may link to any page. No account is required. You may
        not scrape the site at a rate that degrades it for others, attempt to bypass rate limiting, or republish whole
        pages as your own content.
      </p>

      <h2>2. Accuracy and no warranty</h2>
      <p>
        Conversions are computed from the IANA time zone database as shipped by the platform runtime, which we update
        regularly. Governments change time zone and daylight saving rules, sometimes with little notice, and your own
        device clock may be wrong. TimeToZone is therefore provided <strong>“as is” and “as available”</strong>, with
        no warranty of accuracy, completeness, fitness for a particular purpose or uninterrupted availability.
      </p>
      <p>
        <strong>Do not use TimeToZone as the sole source of truth</strong> for aviation or maritime operations, court
        or regulatory filing deadlines, medication schedules, financial market cut-offs, or anything else where being
        an hour out causes real harm. Confirm with an authoritative source for those uses.
      </p>

      <h2>3. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, TimeToZone and its operators are not liable for any indirect,
        incidental, special or consequential loss, including missed meetings, missed deadlines, lost profits or lost
        data, arising from use of or inability to use the site. Nothing in these terms excludes liability that cannot
        lawfully be excluded.
      </p>

      <h2>4. Advertising</h2>
      <p>
        The site carries third-party advertising. We do not control, endorse or take responsibility for advertisers or
        the sites they link to. See the{" "}
        <Link href="/privacy" prefetch={false}>
          privacy policy
        </Link>{" "}
        for the cookies involved and how to opt out of personalised ads.
      </p>

      <h2>5. Intellectual property</h2>
      <p>
        The TimeToZone name, the TZ monogram, the site design and the written explanatory text are owned by the site’s
        operators. The underlying time zone data comes from the{" "}
        <a href="https://www.iana.org/time-zones" rel="noopener nofollow">
          IANA time zone database
        </a>
        , which is in the public domain. Factual outputs — an offset, a conversion result, a daylight saving date — are
        facts and are not claimed as property. You are welcome to quote a conversion with attribution.
      </p>

      <h2>6. Links to other sites</h2>
      <p>
        Outbound links are provided for reference. We are not responsible for the content, policies or availability of
        external sites.
      </p>

      <h2>7. Changes and termination</h2>
      <p>
        We may change, suspend or discontinue any part of the site, and may update these terms. The “last updated”
        date above shows when they last changed. Continued use after a change means you accept the updated terms.
      </p>

      <h2>8. Governing law and contact</h2>
      <p>
        These terms are governed by the laws applicable at the operator’s place of business, without regard to
        conflict-of-law rules. Questions: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
      </p>
    </>
  );
}

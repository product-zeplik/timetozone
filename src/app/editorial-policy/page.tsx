import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@zeplik/seo-kit/server";
import { kit } from "@/seo.config";
import { Crumbs } from "@/components/Blocks";
import { SITE } from "@/site";

export const revalidate = 86400;

/**
 * The Editorial Policy (rulebook GR-12, GR-13). A trust page, like /privacy
 * and /terms: it says how the pages on this site are made, checked and
 * corrected, and nothing the site does not actually do. Not marketing copy;
 * change it only when the practice changes.
 *
 * The head comes from seo-kit's buildMetadata (self-canonical; noindex off
 * production, the same rule pageMeta applies to every other page).
 */
const TITLE = "Editorial Policy | TimeToZone";
const DESCRIPTION =
  "How TimeToZone pages are made: conversions computed from the IANA time zone database, where AI is used, how articles are checked, and how corrections work.";
const PATH = "/editorial-policy";

export const metadata: Metadata = buildMetadata(kit, {
  path: PATH,
  title: TITLE,
  description: DESCRIPTION,
  robots: SITE.isProduction ? "index,follow" : "noindex,follow",
  images: [{ url: `${SITE.url}/og?t=${encodeURIComponent(TITLE)}`, width: 1200, height: 630, alt: TITLE }],
});

export default function EditorialPolicyPage() {
  return (
    <>
      <Crumbs items={[{ name: "Home", path: "/" }, { name: "Editorial Policy", path: PATH }]} />
      <h1>Editorial Policy</h1>
      <p className="answer">
        TimeToZone is made by <a href="https://zeplik.com">Zeplik, Inc.</a> Its pages are AI-assisted and reviewed
        before they publish. This page explains how the numbers are produced, where AI is used, what is checked, and how
        to report a mistake.
      </p>

      <h2>What this covers</h2>
      <p>
        This policy covers the conversion, zone, place and daylight saving pages and the tools on timetozone.com, and the
        articles published in the guides, comparison, alternatives and best-of sections.
      </p>

      <h2>How the numbers are produced</h2>
      <ul>
        <li>
          <strong>Computed, not typed.</strong> Every offset, abbreviation, daylight saving date and converted time is
          computed with the platform <span className="mono">Intl</span> API from the{" "}
          <a href="https://www.iana.org/time-zones" rel="noopener nofollow">
            IANA time zone database
          </a>
          . No offset or daylight saving date is written into the page text by hand.
        </li>
        <li>
          <strong>Tested.</strong> The conversion engine is tested against the platform{"’"}s own{" "}
          <span className="mono">toLocaleString</span> on both sides of daylight saving transitions, and a page that
          fails the site{"’"}s tests or SEO checks is not deployed.
        </li>
        <li>
          <strong>Built with AI assistance.</strong> The site{"’"}s code, its page templates and its tests are
          written with an AI coding assistant.
        </li>
      </ul>

      <h2>How articles are made</h2>
      <p>Articles in the guides, comparison, alternatives and best-of sections go through our content pipeline:</p>
      <ul>
        <li>
          <strong>Drafting.</strong> An AI model writes a brief for each article from search data and the pages that
          already rank, then drafts the article from that brief. Every brief must name what the article adds, such as
          tool output or a worked example with real numbers.
        </li>
        <li>
          <strong>Automated checks.</strong> A script checks each draft before anyone reads it: every claim must have a
          source, banned filler phrases fail the draft, and the page structure, links and images are checked.
        </li>
        <li>
          <strong>Fact check.</strong> A separate AI run with web access checks every claim against a live source. The
          run that wrote a draft cannot fact-check it. Titles, descriptions, structured data and image alt text are
          checked the same way.
        </li>
        <li>
          <strong>Human review.</strong> A person reviews each new article, its sources and the flags from the fact
          check before it is published. Where our rules let a type of page be approved automatically after a long record
          of approvals without edits, a person still reviews a random 10% of each week{"’"}s pages.
        </li>
      </ul>
      <p>We do not invent statistics, quotes, studies, testimonials, user counts or results.</p>

      <h2>How we test products</h2>
      <p>We publish a comparison, an alternatives page or a best-of list only when:</p>
      <ul>
        <li>we ran every product on the page ourselves, with the same inputs;</li>
        <li>the method, date, inputs, outputs and dated screenshots of each product are on the page;</li>
        <li>every {"“"}best for{"”"} pick says why, with that evidence;</li>
        <li>
          the page says near the top that Zeplik makes any of its products that appear, and says plainly where a
          competitor wins.
        </li>
      </ul>
      <p>Rankings are never ordered by commission or by which product is ours.</p>

      <h2>Sources and dates</h2>
      <p>
        Every fact in an article links to its source, primary sources first. A page{"’"}s {"“"}Updated
        {"”"} date and its sitemap date change only when its content, structured data or links change in a way a
        reader would notice.
      </p>

      <h2>Corrections</h2>
      <p>
        If you find a conversion or a claim that is wrong, email{" "}
        <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> or use the{" "}
        <Link href="/contact" prefetch={false}>
          contact page
        </Link>
        . For a conversion, the two zones and the date are enough to reproduce it. A wrong result or claim is fixed or
        removed, and the corrected page goes through the same checks before it is published again.
      </p>
    </>
  );
}

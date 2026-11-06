import type { Metadata } from "next";
import Link from "next/link";
import { Crumbs } from "@/components/Blocks";
import { pageMeta } from "@/seo/meta";
import { SITE } from "@/site";

export const revalidate = 86400;

const TITLE = "Contact TimeToZone";
const DESCRIPTION =
  "Report an incorrect conversion, suggest a time zone or city, or ask about advertising and press. Email TimeToZone and we read every message.";

export const metadata: Metadata = pageMeta({ title: TITLE, description: DESCRIPTION, path: "/contact" });

export default function ContactPage() {
  return (
    <>
      <Crumbs items={[{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }]} />
      <h1>Contact</h1>
      <p className="answer">
        Email <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>. We read every message and reply to
        anything that looks like a real bug.
      </p>

      <h2>Reporting an incorrect time</h2>
      <p>Please include, if you can:</p>
      <ul>
        <li>the page URL</li>
        <li>the two places or zones involved</li>
        <li>the date and time you entered</li>
        <li>what the page said, and what you expected</li>
      </ul>
      <p>
        Those four lines are enough to reproduce almost any conversion bug. Time zone rules change several times a
        year, so a report of the form “Zone X moved to UTC+Y on date Z” is especially useful.
      </p>

      <h2>Missing a city or zone?</h2>
      <p>
        Cities with a population of 100,000 or more all have a page. If a smaller place matters to a lot of people,
        tell us and we will consider it. Zone abbreviations are added when search demand shows people use them.
      </p>

      <h2>Advertising and press</h2>
      <p>
        Use the same address with “Advertising” or “Press” in the subject line. TimeToZone carries Google AdSense
        advertising; see the{" "}
        <Link href="/privacy" prefetch={false}>
          privacy policy
        </Link>
        .
      </p>

      <h2>No accounts, no data to delete</h2>
      <p>
        TimeToZone has no user accounts and stores no personal profiles, so there is nothing to export or delete. Your
        saved world clock and 12/24-hour preference live only in your own browser; clearing site data removes them.
      </p>
    </>
  );
}

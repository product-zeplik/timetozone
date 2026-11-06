import type { Metadata } from "next";
import Link from "next/link";
import Converter from "@/components/Converter";
import { ToolPage } from "@/components/ToolPage";
import { LinkList } from "@/components/Blocks";
import { ExtensionCta } from "@/components/ExtensionCta";
import { sideFor } from "@/engine/entities";
import { fmtDate, isoDate, wallTime } from "@/engine/tz";
import { pageMeta } from "@/seo/meta";
import { cityClockLinks, hourLinks, topPairLinks } from "@/content/nav";

export const revalidate = 86400;

const TITLE = "Time Zone Converter – Convert Time Between Zones";
const DESCRIPTION =
  "Convert any time between any two time zones instantly. Live world clock, 24-hour tables, DST dates and meeting times for every country, city and abbreviation.";

export const metadata: Metadata = pageMeta({ title: TITLE, description: DESCRIPTION, path: "/" });

const FAQS = [
  {
    q: "How do I convert a time between two time zones?",
    a: "Type the time in the first row, then read the answer in the rows below. The converter uses the IANA time zone database, so the daylight saving rules of the date you pick are applied automatically.",
  },
  {
    q: "What time zone am I in?",
    a: "Your browser reports it, and the first row of the converter uses it. The What time zone am I in? page shows the full name, abbreviation, UTC offset, IANA id and your next clock change.",
  },
  {
    q: "Does this converter handle daylight saving time?",
    a: "Yes. Every conversion is computed for the exact date you choose, including the weeks when the US has changed its clocks and Europe has not, and the southern-hemisphere zones that are on summer time in December.",
  },
  {
    q: "Is TimeToZone free?",
    a: "Yes, completely free, with no account and no sign-up. The converter, world clock, meeting planner and every conversion page work without logging in.",
  },
];

export default function HomePage() {
  const now = Date.now();
  const today = isoDate(wallTime("UTC", now));
  const sides = [sideFor("est")!, sideFor("pst")!, sideFor("uk-time")!, sideFor("india-time")!];

  const pairs = topPairLinks(48);
  const hours = hourLinks(["pst-to-est", "est-to-ist", "cst-to-est"], [9, 10, 11, 12, 13, 17]).slice(0, 18);
  const cities = cityClockLinks(40);

  return (
    <ToolPage
      h1="Time Zone Converter"
      title={TITLE}
      description={DESCRIPTION}
      path="/"
      crumbName="Home"
      today={today}
      updatedDate={fmtDate(wallTime("UTC", now), true)}
      adSlot="home-1"
      answer={
        <>
          Convert any time between any two time zones. Pick a time, add the places you care about, and TimeToZone
          applies the correct daylight saving rules for that exact date.
        </>
      }
      faqHeading="Time zone converter FAQ"
      faqs={FAQS}
      extra={
        <>
          <section>
            <h2>Popular time zone conversions</h2>
            <LinkList items={pairs} cols />
          </section>

          <section>
            <h2>Convert a specific hour</h2>
            <LinkList items={hours} />
          </section>

          <section>
            <h2>Current time around the world</h2>
            <LinkList items={cities} cols />
          </section>

          <section>
            <h2>How TimeToZone works</h2>
            <p>
              Every number on this site is computed from the IANA time zone database that ships with the platform, at
              the moment the page is rendered. Nothing is hard-coded: no “EST = UTC−5”, no table of daylight saving
              dates that goes stale next spring. That matters for the cases most converters get wrong — the three
              weeks each March when the United States has moved its clocks and Europe has not, the half-hour zones
              (India UTC+5:30, Nepal UTC+5:45, Newfoundland UTC−3:30), Arizona and Hawaii staying on standard time all
              year, and the southern hemisphere running summer time in December.
            </p>
            <p>
              Pages work without JavaScript: the answer sentence, the 24-hour conversion table and the FAQ are all in
              the HTML. The live clocks fill in once the page loads. There are no accounts, no tracking of your
              location, and no sign-up.
            </p>
            <p>
              <Link href="/time-zones" prefetch={false}>
                Browse all 62 time zone abbreviations
              </Link>{" "}
              ·{" "}
              <Link href="/time-zone-map" prefetch={false}>
                See the world time zone map
              </Link>{" "}
              ·{" "}
              <Link href="/daylight-saving-time" prefetch={false}>
                When do the clocks change?
              </Link>
            </p>
          </section>

          <ExtensionCta />
        </>
      }
    >
      <Converter initial={sides} autoLocal allowAdd maxZones={6} heading="Time zone converter" />
    </ToolPage>
  );
}

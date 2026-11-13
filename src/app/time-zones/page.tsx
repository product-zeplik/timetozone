import type { Metadata } from "next";
import { HubCopySlot } from "@/components/HubCopySlot";
import Link from "next/link";
import { ZONES } from "@/data/zones";
import { COUNTRIES, COUNTRY_BY_SLUG, REGION_BY_ENTITY } from "@/engine/entities";
import { abbrFor } from "@/engine/side";
import { fmtOffset, offsetMinutes, seasonalOffsets, wallTime } from "@/engine/tz";
import { contentDate, contentDateLabel } from "@/seo/content-dates";
import { graph, ld, pageMeta } from "@/seo/meta";
import { multiZoneEntities } from "@/seo/gate";
import { hubArticle } from "@/seo/page-jsonld";
import { Crumbs, Faq, JsonLd, LinkList, Updated } from "@/components/Blocks";
import { Ad } from "@/components/Ad";

export const revalidate = 86400;

const TITLE = "Time Zones – List of Time Zone Abbreviations";
const H1 = "Time Zones and Abbreviations";
const DESCRIPTION =
  "Every time zone abbreviation with its UTC offset, full name, current local time and the regions that use it: EST, PST, GMT, CET, IST, JST and 56 more.";

export const metadata: Metadata = pageMeta({ title: TITLE, description: DESCRIPTION, path: "/time-zones" });

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Time zones", path: "/time-zones" },
];

export default function TimeZonesPage() {
  const now = Date.now();
  const year = wallTime("UTC", now).year;
  const rows = [...ZONES]
    .map((z) => {
      const s = seasonalOffsets(z.iana, year);
      const own = z.kind === "dst" ? (s.dst ?? s.std) : z.kind === "std" ? s.std : offsetMinutes(z.iana, now);
      return { z, own, live: abbrFor(z.iana, now) };
    })
    .sort((a, b) => a.own - b.own || a.z.abbr.localeCompare(b.z.abbr));

  const faqs = [
    {
      q: "How many time zones are there?",
      a: "There are 38 distinct UTC offsets in use, from UTC−12 to UTC+14, and several hundred IANA time zone regions. This page lists the 62 abbreviations that English-speaking searchers actually use.",
    },
    {
      q: "Why do some abbreviations mean two things?",
      a: "CST is both US Central Standard Time and China Standard Time; IST is India, Irish and Israel Standard Time; BST is British Summer Time and Bangladesh Standard Time. Each zone page on this site says which meaning it uses.",
    },
    {
      q: "What is the difference between a standard and a daylight abbreviation?",
      a: "EST is the winter name and EDT the summer name of the same clocks. The generic name, ET, covers both. A correct converter uses whichever one is in force on the date you pick.",
    },
    {
      q: "What is UTC?",
      a: "Coordinated Universal Time is the world's time standard and never changes for daylight saving time. Every other zone is described as an offset from UTC, such as UTC−5 or UTC+5:30.",
    },
  ];

  return (
    <>
      <Crumbs items={crumbs} />
      <h1>{H1}</h1>
      <p className="answer">
        There are 62 commonly used time zone abbreviations, from UTC−10 (HST) to UTC+13 (NZDT). Each row below shows
        the abbreviation, its UTC offset, the full zone name and which name is in force right now.
      </p>

      <section>
        <h2>All time zone abbreviations by offset</h2>
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Abbr</th>
                <th scope="col">Offset</th>
                <th scope="col">Name</th>
                <th scope="col" className="opt-sm">In force now</th>
                <th scope="col" className="opt-md">IANA zone</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ z, own, live }) => (
                <tr key={z.slug}>
                  <th scope="row">
                    <Link href={`/zones/${z.slug}`} prefetch={false}>
                      {z.abbr}
                    </Link>
                  </th>
                  <td className="t">{fmtOffset(own)}</td>
                  <td className="wide">{z.name}</td>
                  <td className="mark opt-sm">{live}</td>
                  <td className="wide opt-md">{z.iana}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Ad slot="zones-hub" lazy={false} />

      <section>
        <h2>Current time by country</h2>
        <p className="lead">All {COUNTRIES.length} countries and territories, ordered by search demand.</p>
        <LinkList items={COUNTRIES.map((c) => ({ href: `/time/${c.slug}`, label: c.name }))} cols tight />
      </section>

      <section>
        <h2>Countries and states with more than one time zone</h2>
        <p className="lead">
          These places span several zones, so &ldquo;what time is it there&rdquo; has more than one answer.
        </p>
        <LinkList
          items={multiZoneEntities().map((e) => {
            const country = COUNTRY_BY_SLUG.get(e.slug);
            const region = REGION_BY_ENTITY.get(e.slug);
            return {
              href: `/time-zone/${e.slug}`,
              label: country ? country.name : region ? region.name : e.slug,
            };
          })}
          cols
          tight
        />
      </section>

      <Faq items={faqs} heading="Time zone FAQ" id="faq" />

      {/* Hub copy for this page's manifest feature: renders nothing until the owner approves copy. */}
      <HubCopySlot path="/time-zones" />
      <Updated date={contentDateLabel("time-zones")} />

      <JsonLd
        data={graph([
          ld.breadcrumbs(crumbs),
          ld.faqPage(faqs),
          ld.webPage(TITLE, "/time-zones", DESCRIPTION, contentDate("time-zones")),
        ])}
      />
      {/* Article (glossary page type in seo/manifest.json, manual 6). Added 2026-11-06 (first commit). */}
      <JsonLd
        data={hubArticle({
          path: "/time-zones",
          headline: H1,
          description: DESCRIPTION,
          datePublished: "2026-11-06",
          dateModified: contentDate("time-zones"),
        })}
      />
    </>
  );
}

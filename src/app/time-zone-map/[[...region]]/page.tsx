import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ToolPage } from "@/components/ToolPage";
import { LinkList } from "@/components/Blocks";
import { usaOffsetGroups, worldOffsetGroups } from "@/content/map";
import { fmtDate, isoDate, wallTime } from "@/engine/tz";
import { pageMeta } from "@/seo/meta";

export const revalidate = 86400;
export const dynamicParams = false;

type Params = { params: Promise<{ region?: string[] }> };

const WORLD = {
  path: "/time-zone-map",
  title: "Time Zone Map – World Time Zones Right Now",
  description:
    "Interactive world time zone map. Click any country for its current local time, or read the crawlable list of every country grouped by UTC offset.",
  h1: "World Time Zone Map",
  svg: "/map/world.svg",
  crumbName: "Time zone map",
};

const USA = {
  path: "/time-zone-map/usa",
  title: "US Time Zone Map – Eastern, Central, Mountain, Pacific",
  description:
    "Interactive US time zone map: Eastern, Central, Mountain, Pacific, Alaska and Hawaii. Click a state for its current local time, or read the state-by-state list.",
  h1: "US Time Zone Map",
  svg: "/map/usa.svg",
  crumbName: "US time zone map",
};

export function generateStaticParams() {
  return [{ region: undefined as unknown as string[] }, { region: ["usa"] }];
}

function pick(region?: string[]) {
  if (!region || region.length === 0) return WORLD;
  if (region.length === 1 && region[0] === "usa") return USA;
  return null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { region } = await params;
  const cfg = pick(region);
  if (!cfg) return { title: "Not found" };
  return pageMeta({ title: cfg.title, description: cfg.description, path: cfg.path });
}

const WORLD_FAQS = [
  { q: "How many time zones are there in the world?", a: "There are 38 UTC offsets in current use, from UTC−12 to UTC+14, because several places use half-hour and quarter-hour offsets and a few Pacific islands sit beyond UTC+12." },
  { q: "Why is the map not a set of straight vertical stripes?", a: "Zone boundaries follow national and state borders rather than lines of longitude, so a country as wide as China uses one zone while a narrower country can use several." },
  { q: "Which country has the most time zones?", a: "France has the most including overseas territories, at twelve. Russia has eleven contiguous zones, the most of any single landmass, and the United States has six including Alaska and Hawaii." },
];

const USA_FAQS = [
  { q: "What are the US time zones?", a: "Eastern (UTC−5/−4), Central (UTC−6/−5), Mountain (UTC−7/−6), Pacific (UTC−8/−7), Alaska (UTC−9/−8) and Hawaii-Aleutian (UTC−10, no daylight saving time)." },
  { q: "Which states have two time zones?", a: "Alaska, Arizona (the Navajo Nation observes daylight saving time), Florida, Idaho, Indiana, Kansas, Kentucky, Michigan, Nebraska, North Dakota, Oregon, South Dakota, Tennessee and Texas are split between two zones." },
  { q: "Which US states do not change their clocks?", a: "Hawaii and most of Arizona stay on standard time all year, along with Puerto Rico, Guam, American Samoa and the US Virgin Islands." },
];

export default async function TimeZoneMapPage({ params }: Params) {
  const { region } = await params;
  const cfg = pick(region);
  if (!cfg) notFound();

  const now = Date.now();
  const isUsa = cfg === USA;
  const groups = isUsa ? usaOffsetGroups(now) : worldOffsetGroups(now);

  return (
    <ToolPage
      h1={cfg.h1}
      title={cfg.title}
      description={cfg.description}
      path={cfg.path}
      crumbName={cfg.crumbName}
      today={isoDate(wallTime("UTC", now))}
      updatedDate={fmtDate(wallTime("UTC", now), true)}
      adSlot="map-1"
      answer={
        isUsa ? (
          <>
            The United States uses six time zones: Eastern (UTC−5/−4), Central (UTC−6/−5), Mountain (UTC−7/−6),
            Pacific (UTC−8/−7), Alaska (UTC−9/−8) and Hawaii-Aleutian (UTC−10, no daylight saving time).
          </>
        ) : (
          <>
            Thirty-eight UTC offsets are in use worldwide, from UTC−12 to UTC+14. Click any country on the map for its
            current local time, or use the list below.
          </>
        )
      }
      faqHeading={isUsa ? "US time zone map FAQ" : "World time zone map FAQ"}
      faqs={isUsa ? USA_FAQS : WORLD_FAQS}
      extra={
        <>
          <section>
            <h2>{isUsa ? "US states and territories by UTC offset" : "Every country by UTC offset"}</h2>
            {groups.map((g) => (
              <div className="offsetgroup" key={g.offset}>
                <h3>
                  {g.offsetText} — {g.abbrs.slice(0, 4).join(", ")}
                </h3>
                <LinkList items={g.items} cols />
              </div>
            ))}
          </section>
          <p>
            {isUsa ? (
              <Link href="/time-zone-map" prefetch={false}>
                World time zone map
              </Link>
            ) : (
              <Link href="/time-zone-map/usa" prefetch={false}>
                US time zone map
              </Link>
            )}{" "}
            ·{" "}
            <Link href="/time-zones" prefetch={false}>
              All time zone abbreviations
            </Link>
          </p>
        </>
      }
    >
      <div className="mapwrap">
        <object type="image/svg+xml" data={cfg.svg} aria-label={cfg.h1} width={1000} height={isUsa ? 620 : 500}>
          <img src={cfg.svg} alt={cfg.h1} width={1000} height={isUsa ? 620 : 500} />
        </object>
      </div>
      <ul className="legend">
        <li>Click a {isUsa ? "state" : "country"} to see its current local time.</li>
        <li>Hover for the abbreviation and UTC offset in force right now.</li>
      </ul>
    </ToolPage>
  );
}

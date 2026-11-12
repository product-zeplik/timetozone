import type { Metadata } from "next";
import WorldClock from "@/components/tools/WorldClock";
import { ToolPage } from "@/components/ToolPage";
import { LinkList } from "@/components/Blocks";
import { sideFor } from "@/engine/entities";
import { pageMeta } from "@/seo/meta";
import { cityClockLinks } from "@/content/nav";

export const revalidate = 86400;

const TITLE = "World Clock – Current Time Around the World";
const DESCRIPTION =
  "Live world clock showing the current local time in New York, London, Paris, Dubai, India, Tokyo, Sydney and any city you add. Saved in your browser.";

export const metadata: Metadata = pageMeta({ title: TITLE, description: DESCRIPTION, path: "/world-clock" });

const DEFAULT_KEYS = [
  "new-york-time",
  "los-angeles-time",
  "chicago-time",
  "london-time",
  "paris-time",
  "dubai-time",
  "india-time",
  "manila-time",
  "tokyo-time",
  "sydney-time",
  "sao-paulo-time",
  "utc",
];

const FAQS = [
  {
    q: "How accurate is this world clock?",
    a: "It reads the clock from your device and applies each zone's current UTC offset from the IANA time zone database, so it is as accurate as your device's clock — usually within a second of real time.",
  },
  {
    q: "Can I save my own list of cities?",
    a: "Yes. Add or remove cities and the list is stored in your browser's local storage, so it is there next time you open the page. Nothing is sent to a server and no account is needed.",
  },
  {
    q: "Why does one city show a different date?",
    a: "Time zones span more than 24 hours end to end, so when it is late evening in Los Angeles it is already the next day in Tokyo. Each row shows its own weekday and date for exactly that reason.",
  },
];

export default function WorldClockPage() {
  const sides = DEFAULT_KEYS.map((k) => sideFor(k)).filter((s): s is NonNullable<typeof s> => !!s);
  return (
    <ToolPage
      h1="World Clock"
      title={TITLE}
      description={DESCRIPTION}
      path="/world-clock"
      crumbName="World clock"
      family="world-clock"
      adSlot="wc-1"
      answer={<>The current local time in twelve major cities, updated every second. Add any city or time zone and your list is saved in this browser.</>}
      faqHeading="World clock FAQ"
      faqs={FAQS}
      extra={
        <section>
          <h2>Current time in major cities</h2>
          <LinkList items={cityClockLinks(40)} cols tight />
        </section>
      }
    >
      <WorldClock initial={sides} />
    </ToolPage>
  );
}

import type { Metadata } from "next";
import { MyZone } from "@/components/tools/SmallTools";
import { ToolPage } from "@/components/ToolPage";
import { LinkList } from "@/components/Blocks";
import { pageMeta } from "@/seo/meta";
import { ZONES } from "@/data/zones";

export const revalidate = 86400;

const TITLE = "What Time Zone Am I In? – Detect My Time Zone";
const DESCRIPTION =
  "Detect your time zone instantly: full name, abbreviation, UTC offset, IANA id, your current local time and your next daylight saving change. No location access.";

export const metadata: Metadata = pageMeta({ title: TITLE, description: DESCRIPTION, path: "/what-time-zone-am-i-in" });

const FAQS = [
  {
    q: "How does this detect my time zone?",
    a: "Your browser exposes its configured time zone through the standard Intl API. This page reads that value in your browser only. It never asks for location permission and sends nothing to a server.",
  },
  {
    q: "What is an IANA time zone id?",
    a: "It is the canonical name of a zone, such as America/New_York or Asia/Kolkata. Software uses it instead of an abbreviation because abbreviations are ambiguous: CST means both US Central and China Standard Time.",
  },
  {
    q: "The time zone shown is wrong. Why?",
    a: "The value comes from your device's settings, so a wrong result means your operating system is set to another zone, or a VPN or privacy setting is reporting UTC. Change it in your system date and time settings.",
  },
];

export default function MyZonePage() {
  return (
    <ToolPage
      h1="What Time Zone Am I In?"
      title={TITLE}
      description={DESCRIPTION}
      path="/what-time-zone-am-i-in"
      crumbName="My time zone"
      family="what-time-zone-am-i-in"
      adSlot="mz-tool"
      answer={<>Your browser reports its own time zone. Below are its full name, abbreviation, UTC offset, IANA id and your next clock change — read locally, with no location access.</>}
      faqHeading="My time zone FAQ"
      faqs={FAQS}
      extra={
        <section>
          <h2>All time zone abbreviations</h2>
          <LinkList items={ZONES.map((z) => ({ href: `/zones/${z.slug}`, label: `${z.abbr} — ${z.name}` }))} cols tight />
        </section>
      }
    >
      <MyZone />
    </ToolPage>
  );
}

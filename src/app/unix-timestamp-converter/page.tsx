import type { Metadata } from "next";
import { UnixConverter } from "@/components/tools/SmallTools";
import { ToolPage } from "@/components/ToolPage";
import { pageMeta } from "@/seo/meta";

export const revalidate = 86400;

const TITLE = "Unix Timestamp Converter – Epoch to Date";
const DESCRIPTION =
  "Convert a Unix timestamp (epoch) to a UTC and local date, or a date to seconds and milliseconds. Seconds and milliseconds are detected automatically.";

export const metadata: Metadata = pageMeta({ title: TITLE, description: DESCRIPTION, path: "/unix-timestamp-converter" });

const FAQS = [
  { q: "What is a Unix timestamp?", a: "It is the number of seconds that have passed since 00:00:00 UTC on 1 January 1970, called the Unix epoch. Because it is a plain count with no time zone, it is the usual way computers store an instant." },
  { q: "Is my number in seconds or milliseconds?", a: "Seconds timestamps for today are 10 digits; milliseconds are 13. This converter treats anything above 100,000,000,000 as milliseconds, which is correct for every date after 1973." },
  { q: "What is the year 2038 problem?", a: "A signed 32-bit timestamp overflows at 03:14:07 UTC on 19 January 2038. Systems that still store time in 32 bits would wrap to 1901. Modern systems use 64-bit timestamps, which last for about 292 billion years." },
];

export default function UnixPage() {
  return (
    <ToolPage
      h1="Unix Timestamp Converter (Epoch Converter)"
      title={TITLE}
      description={DESCRIPTION}
      path="/unix-timestamp-converter"
      crumbName="Unix timestamp"
      family="unix-timestamp-converter"
      adSlot="unix-1"
      answer={<>A Unix timestamp counts the seconds since 1 January 1970 UTC. Paste one to get the UTC and local date, or pick a date to get seconds and milliseconds.</>}
      faqHeading="Unix timestamp FAQ"
      faqs={FAQS}
    >
      <UnixConverter />
    </ToolPage>
  );
}

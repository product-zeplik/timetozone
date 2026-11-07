import type { Metadata } from "next";
import { TimeCalculator } from "@/components/tools/SmallTools";
import { ZoneDifference } from "@/components/tools/ZoneDifference";
import { ToolPage } from "@/components/ToolPage";
import { fmtDate, isoDate, wallTime } from "@/engine/tz";
import { pageMeta } from "@/seo/meta";

export const revalidate = 86400;

const TITLE = "Time Calculator – Time Difference, Duration, Add & Subtract";
const DESCRIPTION =
  "Calculate the time difference between any two time zones in hours and minutes, work out how long it is between two times, or add and subtract from any date and time.";

export const metadata: Metadata = pageMeta({ title: TITLE, description: DESCRIPTION, path: "/time-calculator" });

const FAQS = [
  { q: "How do I calculate the time between two times?", a: "Enter the start and end time. If the end is earlier than the start, the calculator wraps past midnight: 10:00 PM to 6:00 AM is 8 hours, not minus 16." },
  { q: "Can I add hours across a date boundary?", a: "Yes. Pick a date and time, enter the hours and minutes to add or subtract, and the result shows the new time with its weekday and date." },
  {
    q: "How do I work out the time difference between two time zones?",
    a: "Use the time difference calculator above: pick any two time zones or cities and it states the gap in hours and minutes, which side is ahead, and the current local time on each. It reads the difference from the IANA time zone database, so daylight saving time is already accounted for on both sides.",
  },
  {
    q: "Why does the time difference between two places change during the year?",
    a: "Because the two sides start and end daylight saving time on different dates, or only one of them observes it at all. India never changes its clocks while the US does, so the gap between New York and Delhi is 9 hours 30 minutes for part of the year and 10 hours 30 minutes for the rest.",
  },
];

export default function TimeCalculatorPage() {
  const now = Date.now();
  return (
    <ToolPage
      h1="Time Calculator"
      title={TITLE}
      description={DESCRIPTION}
      path="/time-calculator"
      crumbName="Time calculator"
      today={isoDate(wallTime("UTC", now))}
      updatedDate={fmtDate(wallTime("UTC", now), true)}
      adSlot="calc-1"
      answer={<>Three calculations: the time difference between any two time zones, how long it is between two times (wrapping past midnight), and what you get when you add or subtract hours and minutes from a date and time.</>}
      faqHeading="Time calculator FAQ"
      faqs={FAQS}
    >
      <ZoneDifference />
      <TimeCalculator />
    </ToolPage>
  );
}

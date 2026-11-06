import type { Metadata } from "next";
import { TimeCalculator } from "@/components/tools/SmallTools";
import { ToolPage } from "@/components/ToolPage";
import { fmtDate, isoDate, wallTime } from "@/engine/tz";
import { pageMeta } from "@/seo/meta";

export const revalidate = 86400;

const TITLE = "Time Calculator – Add, Subtract and Time Between";
const DESCRIPTION =
  "Work out how long it is between two times, including past midnight, or add and subtract hours and minutes from any date and time.";

export const metadata: Metadata = pageMeta({ title: TITLE, description: DESCRIPTION, path: "/time-calculator" });

const FAQS = [
  { q: "How do I calculate the time between two times?", a: "Enter the start and end time. If the end is earlier than the start, the calculator wraps past midnight: 10:00 PM to 6:00 AM is 8 hours, not minus 16." },
  { q: "Can I add hours across a date boundary?", a: "Yes. Pick a date and time, enter the hours and minutes to add or subtract, and the result shows the new time with its weekday and date." },
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
      answer={<>Two calculations: how long it is between two times (wrapping past midnight), and what you get when you add or subtract hours and minutes from a date and time.</>}
      faqHeading="Time calculator FAQ"
      faqs={FAQS}
    >
      <TimeCalculator />
    </ToolPage>
  );
}

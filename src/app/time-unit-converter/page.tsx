import type { Metadata } from "next";
import { UnitConverter } from "@/components/tools/SmallTools";
import { ToolPage } from "@/components/ToolPage";
import { pageMeta } from "@/seo/meta";

export const revalidate = 86400;

const TITLE = "Time Unit Converter – Seconds, Minutes, Hours, Days";
const DESCRIPTION =
  "Convert between milliseconds, seconds, minutes, hours, days, weeks, months and years at once, plus the h:mm:ss form of any duration.";

export const metadata: Metadata = pageMeta({ title: TITLE, description: DESCRIPTION, path: "/time-unit-converter" });

const FAQS = [
  { q: "How many seconds are in a day?", a: "86,400 seconds: 24 hours × 60 minutes × 60 seconds. A day with a leap second has 86,401, but civil time and this converter use 86,400." },
  { q: "How long is a month here?", a: "30.44 days, the average length of a calendar month (365.24 ÷ 12). Use a date calculator when you need an exact calendar month rather than an average." },
  { q: "Why is a year 365.24 days?", a: "The mean tropical year is about 365.2422 days, which is why the Gregorian calendar adds a leap day in most years divisible by four. This converter uses 365.24 days." },
];

export default function UnitPage() {
  return (
    <ToolPage
      h1="Time Unit Converter"
      title={TITLE}
      description={DESCRIPTION}
      path="/time-unit-converter"
      crumbName="Time units"
      family="time-unit-converter"
      adSlot="unit-1"
      answer={<>Enter a value in any unit and every other unit updates at once: milliseconds, seconds, minutes, hours, days, weeks, months (30.44 days) and years (365.24 days).</>}
      faqHeading="Time unit FAQ"
      faqs={FAQS}
    >
      <UnitConverter />
    </ToolPage>
  );
}

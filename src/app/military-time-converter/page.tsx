import type { Metadata } from "next";
import { MilitaryChart, MilitaryTime } from "@/components/tools/SmallTools";
import { ToolPage } from "@/components/ToolPage";
import { fmtDate, isoDate, wallTime } from "@/engine/tz";
import { pageMeta } from "@/seo/meta";

export const revalidate = 86400;

const TITLE = "Military Time Converter – 24-Hour Time Chart";
const DESCRIPTION =
  "Convert military time to standard 12-hour time and back. Type any time and get the military, 24-hour and 12-hour forms, plus the full 24-row chart.";

export const metadata: Metadata = pageMeta({ title: TITLE, description: DESCRIPTION, path: "/military-time-converter" });

const FAQS = [
  { q: "What is 1300 in military time?", a: "1300 is 1:00 PM. After noon, subtract 12 from the first two digits to get the 12-hour time: 1300 − 12 = 1 PM." },
  { q: "How do I convert military time to standard time?", a: "For 0000–1159, read it as AM (0930 is 9:30 AM). For 1200–2359, subtract 12 hours from the hour part and read it as PM (1845 is 6:45 PM). 0000 is midnight and 1200 is noon." },
  { q: "Is military time the same as 24-hour time?", a: "Almost. The 24-hour clock writes a colon (14:30); military time writes four digits with no colon (1430) and is spoken as “fourteen thirty”. The underlying times are identical." },
  { q: "Is there a 2400 in military time?", a: "Midnight is normally written 0000 at the start of a day. 2400 is sometimes used to mean the end of a day, so 2400 on Monday is the same instant as 0000 on Tuesday." },
];

export default function MilitaryPage() {
  const now = Date.now();
  return (
    <ToolPage
      h1="Military Time Converter"
      title={TITLE}
      description={DESCRIPTION}
      path="/military-time-converter"
      crumbName="Military time"
      today={isoDate(wallTime("UTC", now))}
      updatedDate={fmtDate(wallTime("UTC", now), true)}
      adSlot="mil-1"
      answer={<>Military time is the 24-hour clock written as four digits: 1:00 PM is 1300, 6:45 PM is 1845, midnight is 0000. Type any time below to convert it both ways.</>}
      faqHeading="Military time FAQ"
      faqs={FAQS}
      extra={
        <section>
          <h2>Military time chart</h2>
          <MilitaryChart />
        </section>
      }
    >
      <MilitaryTime />
    </ToolPage>
  );
}

import type { Metadata } from "next";
import MeetingPlanner from "@/components/tools/MeetingPlanner";
import { ToolPage } from "@/components/ToolPage";
import { LinkList } from "@/components/Blocks";
import { sideFor } from "@/engine/entities";
import { pageMeta } from "@/seo/meta";
import { topPairLinks } from "@/content/nav";

export const revalidate = 86400;

const TITLE = "Meeting Planner – Find the Best Time Across Time Zones";
const DESCRIPTION =
  "Find a meeting time that works in up to eight time zones. See all 24 hours side by side with every participant's local time and the hours everyone is at work.";

export const metadata: Metadata = pageMeta({ title: TITLE, description: DESCRIPTION, path: "/meeting-planner" });

const FAQS = [
  {
    q: "How do I find a meeting time across several time zones?",
    a: "Add each participant's city, set the working-day range, and read the rows where every column is inside working hours. Those rows are highlighted and listed in the Best times line above the table.",
  },
  {
    q: "What if there is no overlap at all?",
    a: "With more than about ten hours of spread there is often no shared 9-to-5 window. Pick the row where the fewest people are outside their day, and consider recording the meeting for whoever cannot attend live.",
  },
  {
    q: "Does the planner account for daylight saving time?",
    a: "Yes. Change the date and every column is recomputed with the daylight saving rules in force on that date, which matters most in late March and late October when zones change on different days.",
  },
];

export default function MeetingPlannerPage() {
  const sides = ["new-york-time", "london-time", "india-time", "singapore-time"]
    .map((k) => sideFor(k))
    .filter((s): s is NonNullable<typeof s> => !!s);
  return (
    <ToolPage
      h1="Meeting Planner Across Time Zones"
      title={TITLE}
      description={DESCRIPTION}
      path="/meeting-planner"
      crumbName="Meeting planner"
      family="meeting-planner"
      adSlot="mp-1"
      answer={<>Add up to eight places, set your working day, and the planner highlights every hour where all of them are at work.</>}
      faqHeading="Meeting planner FAQ"
      faqs={FAQS}
      extra={
        <section>
          <h2>Popular two-zone conversions</h2>
          <LinkList items={topPairLinks(24)} cols tight />
        </section>
      }
    >
      <MeetingPlanner initial={sides} />
    </ToolPage>
  );
}

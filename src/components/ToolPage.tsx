import { Ad } from "./Ad";
import { Answer, Crumbs, Faq, JsonLd, Updated } from "./Blocks";
import { graph, ld } from "@/seo/meta";
import type { FaqItem } from "./Blocks";

export interface ToolPageProps {
  h1: string;
  title: string;
  description: string;
  path: string;
  answer: React.ReactNode;
  crumbName: string;
  children: React.ReactNode; // the tool itself
  extra?: React.ReactNode;
  faqs: FaqItem[];
  faqHeading: string;
  today: string;
  updatedDate: string;
  adSlot?: string;
}

export function ToolPage({
  h1,
  title,
  description,
  path,
  answer,
  crumbName,
  children,
  extra,
  faqs,
  faqHeading,
  today,
  updatedDate,
  adSlot = "tool-1",
}: ToolPageProps) {
  const crumbs =
    path === "/"
      ? [{ name: "Home", path: "/" }]
      : [
          { name: "Home", path: "/" },
          { name: crumbName, path },
        ];
  return (
    <>
      {path === "/" ? null : <Crumbs items={crumbs} />}
      <h1>{h1}</h1>
      <Answer>{answer}</Answer>
      {children}
      <Ad slot={adSlot} lazy={false} />
      {extra}
      <Faq items={faqs} heading={faqHeading} id="faq" />
      <Updated date={updatedDate} />
      <JsonLd
        data={graph([
          ...(path === "/" ? [] : [ld.breadcrumbs(crumbs)]),
          ld.webApplication(h1, description, path),
          ld.faqPage(faqs),
          ld.webPage(title, path, description, today),
        ])}
      />
    </>
  );
}

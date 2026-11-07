import type { Metadata } from "next";
import Link from "next/link";
import { buildDstHub } from "@/content/dst";
import { pageMeta, graph, ld } from "@/seo/meta";
import { Answer, Crumbs, Faq, JsonLd, LinkList, Updated } from "@/components/Blocks";
import { Ad } from "@/components/Ad";
import { isoDate, wallTime } from "@/engine/tz";

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  const c = buildDstHub();
  return pageMeta({ title: c.title, description: c.description, path: "/daylight-saving-time" });
}

export default function DstHubPage() {
  const now = Date.now();
  const c = buildDstHub(now);
  const today = isoDate(wallTime("UTC", now));
  return (
    <>
      <Crumbs items={c.crumbs} />
      <h1>{c.h1}</h1>
      <Answer text={c.answer} />

      {c.blocks.map((b) => (
        <section key={b.heading}>
          <h2>{b.heading}</h2>
          <div className="tablewrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Region</th>
                  <th scope="col">Clocks forward</th>
                  <th scope="col">Clocks back</th>
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r) => (
                  <tr key={r.label}>
                    <th scope="row" className="wide">{r.label}</th>
                    <td>{r.forward}</td>
                    <td>{r.back}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <Ad slot="dst-1" lazy={false} />

      <section>
        <h2>Daylight saving time by country</h2>
        <LinkList items={c.countries} cols tight />
      </section>

      <section>
        <h2>Countries that do not change their clocks</h2>
        <p>{c.noDst.join(", ")} and most of Asia, Africa and South America stay on one offset all year.</p>
        <p>
          <Link href="/time-zones" prefetch={false}>
            See every time zone abbreviation and offset
          </Link>
          .
        </p>
      </section>

      <Faq items={c.faqs} heading="Daylight saving time FAQ" id="faq" />

      <Updated date={c.updatedDate} />

      <JsonLd
        data={graph([
          ld.breadcrumbs(c.crumbs),
          ld.faqPage(c.faqs),
          ld.webPage(c.title, "/daylight-saving-time", c.description, today),
        ])}
      />
    </>
  );
}

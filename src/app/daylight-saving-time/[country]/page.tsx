import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildDstCountry, resolveDstCountry } from "@/content/dst";
import { dstCountries } from "@/seo/gate";
import { pageMeta, graph, ld } from "@/seo/meta";
import { Answer, Crumbs, Faq, JsonLd, Updated } from "@/components/Blocks";
import { Ad } from "@/components/Ad";
import { fmtOffset, isoDate, wallTime } from "@/engine/tz";

export const revalidate = 86400;
export const dynamicParams = false;

type Params = { params: Promise<{ country: string }> };

export function generateStaticParams() {
  return dstCountries().map((country) => ({ country }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { country } = await params;
  const c = resolveDstCountry(country);
  if (!c) return { title: "Not found" };
  const b = buildDstCountry(c);
  return pageMeta({ title: b.title, description: b.description, path: b.path });
}

export default async function DstCountryPage({ params }: Params) {
  const { country } = await params;
  const found = resolveDstCountry(country);
  if (!found) notFound();
  const now = Date.now();
  const c = buildDstCountry(found, now);
  const today = isoDate(wallTime("UTC", now));

  return (
    <>
      <Crumbs items={c.crumbs} />
      <h1>{c.h1}</h1>
      <Answer>{c.answer}</Answer>

      {c.schedules.map((s) => (
        <section key={s.heading}>
          <h2>{s.heading}</h2>
          {s.areas.length ? <p className="lead">Used in {s.areas.join(", ")}.</p> : null}
          {s.years.map((y) => (
            <div key={y.year}>
              <h3>{y.year}</h3>
              <ul>
                {y.changes.map((ch, i) => (
                  <li key={i}>
                    <strong>{ch.dateText}:</strong> clocks go {ch.direction} 1 hour at {ch.localHour} local time, from{" "}
                    {ch.fromAbbr} ({fmtOffset(ch.fromOffset)}) to {ch.toAbbr} ({fmtOffset(ch.toOffset)}). Rule: the{" "}
                    {ch.rule}.
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}

      <Ad slot="dstc-1" lazy={false} />

      {c.nonObserving.length ? (
        <section>
          <h2>Areas of {c.country.short} that never change their clocks</h2>
          <ul>
            {c.nonObserving.map((n) => (
              <li key={n.tz}>
                <strong>{n.abbr}</strong> ({n.tz}){n.areas.length ? ` — ${n.areas.join(", ")}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Faq items={c.faqs} heading={`Daylight saving time in ${c.country.short}: FAQ`} id="faq" />

      <Updated date={c.updatedDate} />

      <JsonLd
        data={graph([ld.breadcrumbs(c.crumbs), ld.faqPage(c.faqs), ld.webPage(c.title, c.path, c.description, today)])}
      />
    </>
  );
}

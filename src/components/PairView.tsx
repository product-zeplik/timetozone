import Link from "next/link";
import Converter from "./Converter";
import { Ad } from "./Ad";
import { Answer, Crumbs, Faq, JsonLd, Legend, LinkList, Related, Updated } from "./Blocks";
import { ExtensionCta } from "./ExtensionCta";
import { fmtClock, fmtDuration } from "@/engine/tz";
import { graph, ld } from "@/seo/meta";
import { zoneNote } from "@/content/labels";
import type { HourContent, PairContent } from "@/content/pair";

const shiftText = (shift: number) => (shift === 1 ? "next day" : shift === -1 ? "previous day" : "");

export function PairView({ c, today }: { c: PairContent; today: string }) {
  const noteFrom = zoneNote(c.from);
  const noteTo = zoneNote(c.to);

  return (
    <>
      <Crumbs items={c.crumbs} />
      <h1>{c.h1}</h1>
      <Answer>{c.answer}</Answer>

      <Converter
        initial={[c.from, c.to]}
        reverseHref={c.reverseHref}
        validUntil={c.validUntil}
        heading={c.h1}
      />

      <Ad slot="pair-1" lazy={false} />

      <p>{c.intro1}</p>
      <p>{c.intro2}</p>
      {noteFrom || noteTo || c.inForceNotes.length ? (
        <p className="note">{[noteFrom, noteTo, ...c.inForceNotes].filter(Boolean).join(" ")}</p>
      ) : null}

      <section>
        <h2 id="table">{c.tableHeading}</h2>
        <p className="lead">
          {c.A} to {c.B} on {c.tableDate}. {c.tableNote}
        </p>
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">{c.A}</th>
                <th scope="col">{c.B}</th>
                <th scope="col">Day</th>
              </tr>
            </thead>
            <tbody>
              {c.rows.map((r, i) => (
                <tr key={i} className={`${r.biz ? "biz" : ""}${r.night ? " night" : ""}`}>
                  <td className="t">
                    {fmtClock(r.fromH, r.fromM)} {r.fromAbbr}
                  </td>
                  <td className="t">
                    {fmtClock(r.toH, r.toM)} {r.toAbbr}
                  </td>
                  <td className="mark">{r.biz ? "work hours" : shiftText(r.shift) || (r.night ? "night" : "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Legend />
      </section>

      <Ad slot="pair-2" />

      <section>
        <h2>{c.howToHeading}</h2>
        {c.howTo.map((t, i) => (
          <p key={i}>{t}</p>
        ))}
      </section>

      <section>
        <h2>{c.diffHeading}</h2>
        <p>{c.diffLead}</p>
        {!c.diffConstant ? (
          <ul>
            {c.diffPeriodsList.map((p, i) => (
              <li key={i}>
                <strong>
                  {p.startText} – {p.endText}:
                </strong>{" "}
                {p.direction === "same"
                  ? `${c.B} and ${c.A} are on the same time.`
                  : `${c.B} is ${fmtDuration(p.minutes)} ${p.direction} of ${c.A}.`}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <h2>{c.dstHeading}</h2>
        <ul>
          {c.dstBullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{c.meetingHeading}</h2>
        <p>{c.meetingText}</p>
        <p>
          <Link href="/meeting-planner" prefetch={false}>
            Plan a meeting across more time zones
          </Link>
          .
        </p>
      </section>

      <Ad slot="pair-3" />

      <Faq items={c.faqs} heading={c.faqHeading} id="faq" />

      <Related groups={c.related} />

      <ExtensionCta />

      <Updated date={c.updatedDate} />

      <JsonLd
        data={graph([
          ld.breadcrumbs(c.crumbs),
          ld.webApplication(`${c.A} to ${c.B} converter`, c.description, c.path),
          ld.faqPage(c.faqs.map((f) => ({ q: f.q, a: f.a }))),
          ld.webPage(c.title, c.path, c.description, today),
        ])}
      />
    </>
  );
}

export function HourView({ c, today }: { c: HourContent; today: string }) {
  return (
    <>
      <Crumbs items={c.crumbs} />
      <h1>{c.h1}</h1>
      <Answer>{c.answer}</Answer>

      <Converter
        initial={[c.from, c.to]}
        lockedMinutes={c.lockedMinutes}
        validUntil={c.validUntil}
        heading={c.h1}
      />

      <Ad slot="hour-1" lazy={false} />

      <section>
        <h2>{c.otherHeading}</h2>
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Time zone</th>
                <th scope="col">{c.display} {c.A} is</th>
              </tr>
            </thead>
            <tbody>
              {c.otherRows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.href ? <Link href={r.href} prefetch={false}>{r.label}</Link> : r.label}</th>
                  <td className="t">
                    {r.time} {r.abbr}
                    {r.shift ? ` (${shiftText(r.shift)})` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>{c.quarterHeading}</h2>
        <ul>
          {c.quarters.map((q, i) => (
            <li key={i} className="mono">
              {q}
            </li>
          ))}
        </ul>
      </section>

      <LinkList
        items={[
          { href: c.prevHref, label: "‹ Previous hour" },
          { href: `/${c.slug}`, label: `All ${c.A} to ${c.B} times` },
          { href: c.nextHref, label: "Next hour ›" },
        ]}
      />

      <Ad slot="hour-2" />

      <Faq items={c.faqs} heading={c.faqHeading} id="faq" />

      <Related groups={c.related} />

      <Updated date={c.updatedDate} />

      <JsonLd
        data={graph([
          ld.breadcrumbs(c.crumbs),
          ld.webApplication(`${c.display} ${c.A} to ${c.B}`, c.description, c.path),
          ld.faqPage(c.faqs.map((f) => ({ q: f.q, a: f.a }))),
          ld.webPage(c.title, c.path, c.description, today),
        ])}
      />
    </>
  );
}

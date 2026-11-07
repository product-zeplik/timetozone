import Link from "next/link";
import Converter from "./Converter";
import { Ad } from "./Ad";
import { Answer, Crumbs, Faq, JsonLd, Legend, LinkList, Related, Updated } from "./Blocks";
import { ExtensionCta } from "./ExtensionCta";
import { fmtClock, fmtDuration } from "@/engine/tz";
import { graph, ld } from "@/seo/meta";
import { zoneNote } from "@/content/labels";
import type { HourContent, PairContent } from "@/content/pair";
import type { Row } from "@/engine/pair";

const shiftText = (shift: number) => (shift === 1 ? "next day" : shift === -1 ? "previous day" : "");
const shiftMark = (shift: number) => (shift === 1 ? "+1" : shift === -1 ? "−1" : "");

/**
 * The 24-hour table as three blocks of eight rows rather than one 24-row
 * column. Each block is a real <table> with its own caption and `th scope`, so
 * featured snippets and screen readers still get proper table semantics, while
 * the section is a third of the height and eight rows scan at a glance.
 */
function HoursGrid({ rows, A, B, date }: { rows: Row[]; A: string; B: string; date: string }) {
  const blocks = [rows.slice(0, 8), rows.slice(8, 16), rows.slice(16, 24)];
  return (
    <div className="hours">
      {blocks.map((block, i) => (
        <div className="block" key={i}>
          <table>
            <caption>
              {fmtClock(block[0].fromH, 0).replace(":00", "")} –{" "}
              {fmtClock(block[block.length - 1].fromH, 0).replace(":00", "")} {A}
            </caption>
            <thead>
              <tr>
                <th scope="col">{A}</th>
                <th scope="col">{B}</th>
              </tr>
            </thead>
            <tbody>
              {block.map((r, j) => (
                <tr key={j} className={`${r.biz ? "biz" : ""}${r.night ? " night" : ""}`}>
                  <th scope="row">{fmtClock(r.fromH, r.fromM)}</th>
                  <td>
                    {fmtClock(r.toH, r.toM)}
                    {r.shift ? (
                      <span className="roll" title={shiftText(r.shift)}>
                        {shiftMark(r.shift)}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <p className="sr-only">
        Conversion table from {A} to {B} for {date}. A tick marks hours that fall between 9 AM and 5 PM in both
        places. +1 means the next day in {B}, −1 the previous day.
      </p>
    </div>
  );
}

export function PairView({ c, today }: { c: PairContent; today: string }) {
  const noteFrom = zoneNote(c.from);
  const noteTo = zoneNote(c.to);
  const notes = [noteFrom, noteTo, ...c.inForceNotes].filter(Boolean);

  return (
    <>
      <Crumbs items={c.crumbs} />
      <h1>{c.h1}</h1>
      <Answer text={c.answer} />

      <Converter initial={[c.from, c.to]} reverseHref={c.reverseHref} validUntil={c.validUntil} heading={c.h1} />

      <p>{c.intro1}</p>
      <p>{c.intro2}</p>
      {notes.length ? <p className="note">{notes.join(" ")}</p> : null}

      <Ad slot="pair-1" lazy={false} />

      <section>
        <h2 id="table">{c.tableHeading}</h2>
        <p className="lead">
          {c.A} to {c.B} on {c.tableDate}. {c.tableNote}
        </p>
        <HoursGrid rows={c.rows} A={c.A} B={c.B} date={c.tableDate} />
        <Legend />
      </section>

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

      <Ad slot="pair-2" />

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

      <Faq items={c.faqs} heading={c.faqHeading} id="faq" />

      <Ad slot="pair-3" />

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
      <Answer text={c.answer} />

      <Converter initial={[c.from, c.to]} lockedMinutes={c.lockedMinutes} validUntil={c.validUntil} heading={c.h1} />

      <Ad slot="hour-1" lazy={false} />

      <div className="duo">
        <section className="flush">
          <h2>{c.otherHeading}</h2>
          <div className="tablewrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Time zone</th>
                  <th scope="col">
                    {c.display} {c.A} is
                  </th>
                </tr>
              </thead>
              <tbody>
                {c.otherRows.map((r) => (
                  <tr key={r.label}>
                    <th scope="row">
                      {r.href ? (
                        <Link href={r.href} prefetch={false}>
                          {r.label}
                        </Link>
                      ) : (
                        r.label
                      )}
                    </th>
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

        <section className="flush">
          <h2>{c.quarterHeading}</h2>
          <div className="tablewrap">
            <table className="tbl">
              <tbody>
                {c.quarters.map((q, i) => (
                  <tr key={i}>
                    <td className="t wide">{q}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <LinkList
              items={[
                { href: c.prevHref, label: "‹ Previous hour" },
                { href: `/${c.slug}`, label: `All ${c.A} to ${c.B} times` },
                { href: c.nextHref, label: "Next hour ›" },
              ]}
            />
          </div>
        </section>
      </div>

      <Faq items={c.faqs} heading={c.faqHeading} id="faq" />

      <Ad slot="hour-2" />

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

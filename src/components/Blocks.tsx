import Link from "next/link";
import { ldJson } from "@/seo/meta";

/* -------------------------------------------------------------------- JSON-LD */

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(data) }} />;
}

/* ---------------------------------------------------------------- breadcrumbs */

export interface Crumb {
  name: string;
  path: string;
}

export function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="crumbs">
        {items.map((c, i) => (
          <li key={c.path + i}>
            {i > 0 ? (
              <span className="sep" aria-hidden="true">
                ›
              </span>
            ) : null}
            {i === items.length - 1 ? (
              <span aria-current="page">{c.name}</span>
            ) : (
              <Link href={c.path} prefetch={false}>
                {c.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* --------------------------------------------------------------- answer line */

/** Clock times, durations and offsets inside the answer sentence. */
const NUMERIC = /(\d{1,2}:\d{2}\s?(?:AM|PM)|UTC[+−-][\d:]+|\d+\s(?:hours?|minutes?)(?:\s\d+\sminutes?)?)/g;
/** Clock times and offsets get the monospace face; a duration is just bold. */
const IS_CLOCK = /^(?:\d{1,2}:\d{2}\s?(?:AM|PM)|UTC[+−-][\d:]+)$/;

/**
 * The answer sentence. The whole line is not bolded — only the values are, so
 * the converted time and the date read as the strongest thing on the page
 * without the sentence shouting.
 */
export function Answer({ children, text }: { children?: React.ReactNode; text?: string }) {
  if (text === undefined) return <p className="answer">{children}</p>;
  const parts = text.split(NUMERIC);
  return (
    <p className="answer">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span className={IS_CLOCK.test(part) ? "num" : "val"} key={i}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

/* ------------------------------------------------------------------------ FAQ */

export interface FaqItem {
  q: string;
  a: string;
}

export function Faq({ items, heading, id }: { items: FaqItem[]; heading: string; id?: string }) {
  if (!items.length) return null;
  return (
    <section>
      <h2 id={id}>{heading}</h2>
      <div className="faq">
        {items.map((f, i) => (
          <details key={i}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ link lists */

export function LinkList({
  items,
  cols = false,
  tight = false,
}: {
  items: { href: string; label: string }[];
  cols?: boolean;
  tight?: boolean;
}) {
  if (!items.length) return null;
  // The column variant renders anchors directly: a <li> wrapper per item costs
  // real bytes in the RSC payload once a list runs to hundreds of links.
  if (cols) {
    return (
      <div className={tight ? "links cols tight" : "links cols"}>
        {items.map((l) => (
          <Link key={l.href} href={l.href} prefetch={false} title={l.label}>
            {l.label}
          </Link>
        ))}
      </div>
    );
  }
  return (
    <ul className="links">
      {items.map((l) => (
        <li key={l.href}>
          <Link href={l.href} prefetch={false}>
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export interface RelatedGroup {
  heading: string;
  items: { href: string; label: string }[];
  cols?: boolean;
}

/**
 * One quiet reference block at the foot of the page. Group headings are small
 * labels rather than content headings, so a long list of links never competes
 * with the answer above it.
 */
export function Related({ groups, heading = "Related conversions" }: { groups: RelatedGroup[]; heading?: string }) {
  const live = groups.filter((g) => g.items.length);
  if (!live.length) return null;
  return (
    <section>
      <h2>{heading}</h2>
      {live.map((g) => (
        <div key={g.heading}>
          <h3 className="label">{g.heading}</h3>
          <LinkList items={g.items} cols={g.cols} tight={g.cols} />
        </div>
      ))}
    </section>
  );
}

/* -------------------------------------------------------------------- updated */

export function Updated({ date, note }: { date: string; note?: string }) {
  return (
    <p className="updated">
      Updated {date}. Time zone data: <abbr title="Internet Assigned Numbers Authority">IANA</abbr> tz database.
      {note ? ` ${note}` : ""}
    </p>
  );
}

/* ------------------------------------------------------------------ 24h legend */

export function Legend() {
  return (
    <ul className="legend">
      <li>
        <span className="sw sw-biz" /> ✓ marks 9 AM–5 PM in both places
      </li>
      <li>
        <span className="sw sw-night" /> Greyed times are night in the destination (10 PM–6 AM)
      </li>
    </ul>
  );
}

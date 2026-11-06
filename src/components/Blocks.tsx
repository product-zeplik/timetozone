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
}: {
  items: { href: string; label: string }[];
  cols?: boolean;
}) {
  if (!items.length) return null;
  // The column variant renders anchors directly: a <li> wrapper per item costs
  // real bytes in the RSC payload once a list runs to hundreds of links.
  if (cols) {
    return (
      <div className="links cols">
        {items.map((l) => (
          <Link key={l.href} href={l.href} prefetch={false}>
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

export function Related({ groups, heading = "Related conversions" }: { groups: RelatedGroup[]; heading?: string }) {
  const live = groups.filter((g) => g.items.length);
  if (!live.length) return null;
  return (
    <section>
      <h2>{heading}</h2>
      {live.map((g) => (
        <div key={g.heading}>
          <h3>{g.heading}</h3>
          <LinkList items={g.items} cols={g.cols} />
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

/* --------------------------------------------------------------- answer line */

export function Answer({ children }: { children: React.ReactNode }) {
  return <p className="answer">{children}</p>;
}

/* ------------------------------------------------------------------ 24h table */

export function Legend() {
  return (
    <ul className="legend">
      <li>
        <span className="sw sw-biz" /> Work rows — 9 AM–5 PM in both places
      </li>
      <li>
        <span className="sw sw-night" /> Night in the destination (10 PM–6 AM)
      </li>
    </ul>
  );
}

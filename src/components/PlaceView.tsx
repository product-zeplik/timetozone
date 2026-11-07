import Link from "next/link";
import Converter from "./Converter";
import LiveClock from "./LiveClock";
import LiveTime from "./LiveTime";
import { Ad } from "./Ad";
import { Answer, Crumbs, Faq, JsonLd, LinkList, Updated } from "./Blocks";
import { graph, ld } from "@/seo/meta";
import type { MultiZoneContent, PlaceContent, ZoneContent } from "@/content/place";

function ZonesTable({
  rows,
  name,
  href,
}: {
  rows: MultiZoneContent["zoneRows"];
  name: string;
  href?: string | null;
}) {
  return (
    <section>
      <h2>Time zones in {name}</h2>
      <div className="tablewrap">
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col">Time zone</th>
              <th scope="col">Offset now</th>
              <th scope="col">Local time</th>
              <th scope="col">Main areas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tz}>
                <th scope="row">
                  {r.longName} <span className="mono">({r.abbr})</span>
                </th>
                <td className="t">{r.offsetText}</td>
                <td className="t">
                  <LiveTime tz={r.tz} />
                </td>
                <td className="wide">
                  {r.cities.length
                    ? r.cities.map((c, i) => (
                        <span key={c.href}>
                          {i > 0 ? ", " : ""}
                          <Link href={c.href} prefetch={false}>
                            {c.name}
                          </Link>
                        </span>
                      ))
                    : r.tz}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {href ? (
        <p>
          <Link href={href} prefetch={false}>
            More about the {name} time zones
          </Link>
          .
        </p>
      ) : null}
    </section>
  );
}

function FactsTable({ facts, heading }: { facts: { label: string; value: string }[]; heading: string }) {
  return (
    <section>
      <h2>{heading}</h2>
      <div className="tablewrap">
        <table className="tbl">
          <tbody>
            {facts.map((f) => (
              <tr key={f.label}>
                <th scope="row">{f.label}</th>
                <td className="wide mono">{f.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DstSection({
  years,
  name,
  observes,
  offsetFallback,
  dstHref,
}: {
  years: { year: number; changes: { dateText: string; text: string; direction: string }[] }[];
  name: string;
  observes: boolean;
  offsetFallback: string;
  dstHref?: string | null;
}) {
  return (
    <section>
      <h2>Daylight saving time in {name}</h2>
      {!observes || !years.length ? (
        <p>
          {name} does not observe daylight saving time. The clocks stay on {offsetFallback} all year, so conversions
          never shift.
        </p>
      ) : (
        years.map((y) => (
          <div key={y.year}>
            <h3>{y.year}</h3>
            <ul>
              {y.changes.map((c, i) => (
                <li key={i}>
                  <strong>{c.dateText}:</strong> {c.text}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      {dstHref ? (
        <p>
          <Link href={dstHref} prefetch={false}>
            Full daylight saving time schedule for {name}
          </Link>
          , including the rule each change follows.
        </p>
      ) : null}
    </section>
  );
}

export function PlaceView({ c, today }: { c: PlaceContent; today: string }) {
  return (
    <>
      <Crumbs items={c.crumbs} />
      <h1>{c.h1}</h1>
      <Answer text={c.answer} />

      <LiveClock tz={c.names.primary} label={c.names.name} />

      {c.zoneRows.length > 1 ? (
        <ZonesTable rows={c.zoneRows} name={c.names.name} href={c.multiZoneHref} />
      ) : null}

      <section>
        <h2>Convert {c.names.name} time</h2>
        <Converter initial={c.converterSides} heading={`Convert ${c.names.name} time`} />
      </section>

      <Ad slot="place-1" lazy={false} />

      <FactsTable facts={c.zoneFacts} heading={`Time zone of ${c.names.name}`} />

      {c.compareRows.length ? (
        <section>
          <h2>Time difference between {c.names.name} and other cities</h2>
          <div className="tablewrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">City</th>
                  <th scope="col">Difference</th>
                  <th scope="col">Local time</th>
                </tr>
              </thead>
              <tbody>
                {c.compareRows.map((r) => (
                  <tr key={r.label}>
                    <th scope="row">
                      <Link href={r.href} prefetch={false}>
                        {r.label}
                      </Link>
                    </th>
                    <td>{r.diffText}</td>
                    <td className="t">
                      <LiveTime tz={r.tz} withDay />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <DstSection
        years={c.dstYears}
        name={c.names.name}
        observes={c.observesDst}
        offsetFallback={c.zoneFacts.find((f) => f.label === "UTC offset")?.value ?? "the same offset"}
        dstHref={c.dstHref}
      />

      <Ad slot="place-2" />

      <Faq items={c.faqs} heading={`${c.names.name} time FAQ`} id="faq" />

      {c.children.map((g) => (
        <section key={g.heading}>
          <h2>{g.heading}</h2>
          <LinkList items={g.items} cols tight />
        </section>
      ))}

      <Updated date={c.updatedDate} />

      <JsonLd
        data={graph([
          ld.breadcrumbs(c.crumbs),
          ld.city({
            name: c.names.full,
            countryName: c.names.countryName,
            timeZone: c.names.primary,
            lat: c.lat,
            lng: c.lng,
            kind: c.jsonLdKind,
          }),
          ld.faqPage(c.faqs),
          ld.webPage(c.title, c.path, c.description, today),
        ])}
      />
    </>
  );
}

export function MultiZoneView({ c, today }: { c: MultiZoneContent; today: string }) {
  return (
    <>
      <Crumbs items={c.crumbs} />
      <h1>{c.h1}</h1>
      <Answer text={c.answer} />

      <LiveClock tz={c.names.primary} label={`${c.names.name} — main zone`} />

      <ZonesTable rows={c.zoneRows} name={c.names.name} />

      <section>
        <h2>Convert {c.names.name} time</h2>
        <Converter initial={c.converterSides} heading={`Convert ${c.names.name} time`} />
      </section>

      <Ad slot="mz-1" lazy={false} />

      <FactsTable facts={c.zoneFacts} heading={`Main time zone of ${c.names.name}`} />

      <DstSection
        years={c.dstYears}
        name={c.names.name}
        observes={c.observesDst}
        offsetFallback={c.zoneFacts.find((f) => f.label === "UTC offset")?.value ?? "the same offset"}
        dstHref={c.dstHref}
      />

      <Faq items={c.faqs} heading={`${c.names.name} time zone FAQ`} id="faq" />

      <p>
        <Link href={c.placeHref} prefetch={false}>
          Current time in {c.names.name}
        </Link>
      </p>

      <Updated date={c.updatedDate} />

      <JsonLd
        data={graph([
          ld.breadcrumbs(c.crumbs),
          ld.faqPage(c.faqs),
          ld.webPage(c.title, c.path, c.description, today),
        ])}
      />
    </>
  );
}

export function ZoneView({ c, today }: { c: ZoneContent; today: string }) {
  return (
    <>
      <Crumbs items={c.crumbs} />
      <h1>{c.h1}</h1>
      <Answer text={c.answer} />
      {c.note ? <p className="note">{c.note}</p> : null}

      <LiveClock tz={c.zone.iana} label={c.zone.abbr} sub={c.offsetText} />
      {c.inForceNote ? <p className="note">{c.inForceNote}</p> : null}

      <section>
        <h2>Convert {c.zone.abbr}</h2>
        <Converter initial={c.converterSides} heading={`Convert ${c.zone.abbr}`} />
      </section>

      <Ad slot="zone-1" lazy={false} />

      <section>
        <h2>Where {c.zone.abbr} is used</h2>
        <p>{c.regionText}.</p>
        {c.countries.length ? (
          <>
            <h3 className="label">Countries on the same offsets</h3>
            <LinkList items={c.countries} cols tight />
          </>
        ) : null}
        {c.cities.length ? (
          <>
            <h3 className="label">Major cities on {c.zone.iana}</h3>
            <LinkList items={c.cities} cols tight />
          </>
        ) : null}
      </section>

      <section>
        <h2>{c.dstHeading}</h2>
        <p>{c.dstText}</p>
      </section>

      {c.conversions.length ? (
        <section>
          <h2>Convert {c.zone.abbr} to other time zones</h2>
          <LinkList items={c.conversions} cols tight />
        </section>
      ) : null}

      <Faq items={c.faqs} heading={`${c.zone.abbr} FAQ`} id="faq" />

      <Updated date={c.updatedDate} />

      <JsonLd
        data={graph([
          ld.breadcrumbs(c.crumbs),
          ld.faqPage(c.faqs),
          ld.webPage(c.title, c.path, c.description, today),
        ])}
      />
    </>
  );
}

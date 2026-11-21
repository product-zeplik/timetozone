import { LinkList } from "./Blocks";
import type { HourValue, PairValue } from "@/content/value";

/**
 * Template v2 blocks (src/seo/template-flags.ts). Server components only; plain tables and lists, no client JS, no
 * images, so the CWV budgets of docs/09 hold. Rendered only while the flag is on.
 */
export function PairValueBlocks({ v }: { v: PairValue }) {
  return (
    <>
      <section>
        <h2>{v.changesHeading}</h2>
        <ul>
          {v.changes.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{v.overlapHeading}</h2>
        {v.overlapLead ? <p className="lead">{v.overlapLead}</p> : null}
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Dates</th>
                <th scope="col">Difference</th>
                <th scope="col">9 AM–5 PM overlap</th>
                <th scope="col">8 AM–8 PM overlap</th>
              </tr>
            </thead>
            <tbody>
              {v.overlapRows.map((r) => (
                <tr key={r.period}>
                  <th scope="row">{r.period}</th>
                  <td>{r.diff}</td>
                  <td>{r.core}</td>
                  <td>{r.extended}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {v.coverage.length ? (
        <section>
          <h2>{v.coverageHeading}</h2>
          {v.coverage.map((c) => (
            <div key={c.side}>
              <p>{c.text}</p>
              <LinkList items={c.links} />
            </div>
          ))}
        </section>
      ) : null}

      {v.equivalentHeading && v.equivalentText ? (
        <section>
          <h2>{v.equivalentHeading}</h2>
          <p>{v.equivalentText}</p>
          <LinkList items={v.equivalents} />
        </section>
      ) : null}
    </>
  );
}

export function HourValueBlocks({ v }: { v: HourValue }) {
  return (
    <>
      <section>
        <h2>{v.yearHeading}</h2>
        <div className="tablewrap">
          <table className="tbl">
            <tbody>
              {v.yearRows.map((r) => (
                <tr key={r.period}>
                  <th scope="row">{r.period}</th>
                  <td className="t">{r.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2>{v.dayHeading}</h2>
        {v.dayText.map((t, i) => (
          <p key={i}>{t}</p>
        ))}
      </section>
    </>
  );
}

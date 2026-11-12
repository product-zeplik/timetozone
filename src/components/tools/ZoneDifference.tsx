"use client";

import { useEffect, useState } from "react";
import ZoneSearch from "@/components/ZoneSearch";
import { aheadBehind, directionPhrase } from "@/engine/pair";
import { sideAbbr, type Side } from "@/engine/side";
import { fmtClock, offsetMinutes, fmtOffset, wallTime } from "@/engine/tz";
import { track } from "@/components/track";

const UTC: Side = { key: "utc", kind: "zone", label: "UTC", long: "Coordinated Universal Time", tz: "Etc/UTC", zoneSlug: "utc" };
const IST: Side = { key: "ist", kind: "zone", label: "IST", long: "India Standard Time", tz: "Asia/Kolkata", zoneSlug: "ist" };

/**
 * "What is the time difference between X and Y" for any two zones or cities.
 *
 * The pair pages answer this for the combinations worth a URL of their own;
 * this answers it for every other combination, including the user's own zone,
 * without minting a page per query. The sentence is written the way the
 * question is asked so the figure reads back cleanly.
 */
export function ZoneDifference() {
  const [a, setA] = useState<Side>(UTC);
  const [b, setB] = useState<Side>(IST);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Start from the visitor's own zone: it is the side they are most likely to
  // be comparing from, and it saves a search on first use.
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setA({ key: "local", kind: "city", label: "My time zone", long: tz.replace(/_/g, " "), tz });
    } catch {
      /* keep UTC */
    }
  }, []);

  const ab = now == null ? null : aheadBehind(a, b, now);

  const line = (s: Side) => {
    if (now == null) return "--:--"; // placeholder until mount: never a server-rendered clock
    const w = wallTime(s.tz, now);
    return fmtClock(w.hour, w.minute);
  };

  return (
    <section className="card zonediff">
      <h2 id="difference">Time difference calculator</h2>
      <p className="lead">Pick any two time zones or cities to see the gap between them right now.</p>

      <div className="zonediff-grid">
        {([
          [a, setA, "First time zone or city"],
          [b, setB, "Second time zone or city"],
        ] as const).map(([side, set, label], i) => (
          <div key={i} className="zonediff-side">
            <h3 className="label">{label}</h3>
            {/* Fixed two-line box. The first side is replaced with the
                visitor's own zone after mount, and a long IANA name must not
                be able to push the search box below it down. */}
            <p className="zonediff-current">
              <strong title={side.long}>{side.long}</strong>
              <span className="zonediff-meta">
                <span className="zonediff-clock">{line(side)}</span>
                <span className="faint">
                  {now == null ? "" : `${sideAbbr(side, now)} · ${fmtOffset(offsetMinutes(side.tz, now))}`}
                </span>
              </span>
            </p>
            <ZoneSearch
              onPick={(picked) => {
                set(picked);
                track("zone_diff_pick", { side: i === 0 ? "a" : "b", key: picked.key });
              }}
              placeholder="Search a city or time zone"
              label={label}
            />
          </div>
        ))}
      </div>

      <p className="zonediff-answer" aria-live="polite">
        {ab == null ? (
          <span className="faint">Calculating…</span>
        ) : ab.direction === "same" ? (
          <>
            There is <strong>no time difference</strong> between {a.long} and {b.long} right now — both are on{" "}
            {fmtOffset(offsetMinutes(a.tz, now as number))}.
          </>
        ) : (
          <>
            The time difference between {a.long} and {b.long} is{" "}
            <strong>
              {ab.duration}
            </strong>
            . {sideAbbr(b, now as number)} is {ab.duration} {directionPhrase(ab.minutes)} {sideAbbr(a, now as number)}.
          </>
        )}
      </p>
    </section>
  );
}

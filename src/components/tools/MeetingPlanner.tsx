"use client";

import { useEffect, useMemo, useState } from "react";
import ZoneSearch from "../ZoneSearch";
import { track } from "../track";
import type { Side } from "@/engine/side";
import { abbrFor } from "@/engine/side";
import { fmtClock, fmtOffset, offsetMinutes, parseIsoDate, wallTime, zonedToUtc } from "@/engine/tz";

const MAX = 8;
const pad = (n: number) => String(n).padStart(2, "0");

function fallbackDate(tz?: string) {
  if (!tz) return null;
  const w = wallTime(tz, Date.now());
  return { year: w.year, month: w.month, day: w.day };
}

export default function MeetingPlanner({ initial }: { initial: Side[] }) {
  const [sides, setSides] = useState<Side[]>(initial);
  const [dateIso, setDateIso] = useState("");
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(17);
  const [h12, setH12] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem("ttz.h12") === "0") setH12(false);
    } catch {
      /* ignore */
    }
    const w = wallTime(sides[0]?.tz ?? "UTC", Date.now());
    setDateIso(`${w.year}-${pad(w.month)}-${pad(w.day)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    // Before mount `dateIso` is empty; fall back to the reference zone's own
    // current date so the table is laid out at first paint (CLS stays at 0).
    const d = parseIsoDate(dateIso) || fallbackDate(sides[0]?.tz);
    if (!d || !sides.length) return [];
    return Array.from({ length: 24 }, (_, h) => {
      const instant = zonedToUtc(sides[0].tz, d.year, d.month, d.day, h, 0);
      const cells = sides.map((s) => {
        const w = wallTime(s.tz, instant);
        const inWork = w.hour >= startHour && w.hour < endHour;
        return { side: s, wall: w, inWork };
      });
      return { h, instant, cells, all: cells.every((c) => c.inWork) };
    });
  }, [dateIso, sides, startHour, endHour]);

  const best = rows.filter((r) => r.all);

  return (
    <section className="card" aria-label="Meeting planner">
      <div className="row mb-4">
        <div className="field">
          <label htmlFor="mp-date">Date</label>
          <input id="mp-date" type="date" value={dateIso} onChange={(e) => setDateIso(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="mp-start">Working day from</label>
          <select id="mp-start" value={startHour} onChange={(e) => setStartHour(Number(e.target.value))}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {fmtClock(h, 0, h12)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="mp-end">to</label>
          <select id="mp-end" value={endHour} onChange={(e) => setEndHour(Number(e.target.value))}>
            {Array.from({ length: 25 }, (_, h) => (
              <option key={h} value={h}>
                {h === 24 ? "midnight" : fmtClock(h, 0, h12)}
              </option>
            ))}
          </select>
        </div>
        <div className="row" role="group" aria-label="Clock format">
          <button type="button" className="btn btn-sm" aria-pressed={h12} onClick={() => setH12(true)}>
            12h
          </button>
          <button type="button" className="btn btn-sm" aria-pressed={!h12} onClick={() => setH12(false)}>
            24h
          </button>
        </div>
      </div>

      {sides.length < MAX ? (
        <div className="row mb-4">
          <ZoneSearch
            label="Add a participant's city or time zone"
            onPick={(s) => {
              if (sides.some((x) => x.tz === s.tz)) return;
              setSides([...sides, s]);
              track("add_zone", { zone: s.key, tool: "meeting-planner" });
            }}
          />
        </div>
      ) : null}

      <div className="links">
        {sides.map((s, i) => (
          <span key={`${s.key}-${i}`} className="chip">
            <span className="btn btn-sm">
              {s.label}
              {sides.length > 2 ? (
                <button
                  type="button"
                  aria-label={`Remove ${s.label}`}
                  onClick={() => setSides(sides.filter((_, n) => n !== i))}
                  className="chip-x"
                >
                  ×
                </button>
              ) : null}
            </span>
          </span>
        ))}
      </div>

      <p className="lead" suppressHydrationWarning>
        {!mounted
          ? "Loading the planner…"
          : best.length
            ? `Best times: everyone is inside ${fmtClock(startHour, 0, h12)}–${
                endHour === 24 ? "midnight" : fmtClock(endHour, 0, h12)
              } for ${best.length} hour${best.length === 1 ? "" : "s"} — starting at ${fmtClock(
                best[0].cells[0].wall.hour,
                0,
                h12
              )} ${abbrFor(sides[0].tz, best[0].instant)}.`
            : "There is no hour where everyone is inside working hours. Pick the row with the fewest people outside their day."}
      </p>

      <div className="tablewrap">
        <table className="tbl">
          <thead>
            <tr>
              {sides.map((s, i) => (
                <th scope="col" key={`${s.key}-${i}`}>
                  {s.label}
                  <br />
                  <span className="mark" suppressHydrationWarning>
                    {mounted ? fmtOffset(offsetMinutes(s.tz, Date.now())) : ""}
                  </span>
                </th>
              ))}
              <th scope="col">All in?</th>
            </tr>
          </thead>
          <tbody suppressHydrationWarning>
            {rows.map((r) => (
              <tr key={r.h} className={r.all ? "biz" : ""}>
                {r.cells.map((c, i) => (
                  <td className="t" key={i}>
                    {fmtClock(c.wall.hour, c.wall.minute, h12)}
                    {i > 0 && c.wall.day !== r.cells[0].wall.day ? (
                      <span className="mark"> {c.wall.weekday}</span>
                    ) : null}
                  </td>
                ))}
                <td>
                  <span className="mark">{r.all ? "yes" : "no"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

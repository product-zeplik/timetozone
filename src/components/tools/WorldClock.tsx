"use client";

import { useEffect, useState } from "react";
import ZoneSearch from "../ZoneSearch";
import { track } from "../track";
import type { Side } from "@/engine/side";
import { abbrFor } from "@/engine/side";
import { fmtClock, fmtDate, fmtOffset, offsetMinutes, wallTime } from "@/engine/tz";

const KEY = "ttz.wc";

export default function WorldClock({ initial }: { initial: Side[] }) {
  const [sides, setSides] = useState<Side[]>(initial);
  const [now, setNow] = useState(0);
  const [h12, setH12] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    try {
      if (localStorage.getItem("ttz.h12") === "0") setH12(false);
      const saved = localStorage.getItem(KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Side[];
        if (Array.isArray(parsed) && parsed.length && parsed.every((s) => s && s.tz && s.label)) setSides(parsed);
      }
    } catch {
      /* ignore */
    }
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const persist = (list: Side[]) => {
    setSides(list);
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  };

  const setH12Persist = (v: boolean) => {
    setH12(v);
    try {
      localStorage.setItem("ttz.h12", v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="conv" aria-label="World clock">
      <div className="conv-head">
        <ZoneSearch
          label="Add a city or time zone"
          onPick={(s) => {
            if (sides.some((x) => x.tz === s.tz && x.label === s.label)) return;
            persist([...sides, s]);
            track("add_zone", { zone: s.key, tool: "world-clock" });
          }}
        />
        <span className="spacer" />
        <div className="row" role="group" aria-label="Clock format">
          <button type="button" className="btn btn-sm" aria-pressed={h12} onClick={() => setH12Persist(true)}>
            12h
          </button>
          <button type="button" className="btn btn-sm" aria-pressed={!h12} onClick={() => setH12Persist(false)}>
            24h
          </button>
        </div>
        <button type="button" className="btn btn-sm" onClick={() => persist(initial)}>
          Reset
        </button>
      </div>

      {sides.map((s, i) => {
        const w = mounted && now ? wallTime(s.tz, now) : null;
        return (
          <div className="zrow" key={`${s.key}-${i}`}>
            <div className="zrow-main">
              <div className="zrow-name">{s.label}</div>
              <div className="zrow-sub" suppressHydrationWarning>
                {w ? `${abbrFor(s.tz, now)} · ${fmtOffset(offsetMinutes(s.tz, now))} · ${s.long}` : s.long}
              </div>
            </div>
            <div className="zrow-time">
              <span className="zrow-clock" suppressHydrationWarning>
                {w ? fmtClock(w.hour, w.minute, h12) : "--:--"}
              </span>
              <div className="zrow-date" suppressHydrationWarning>
                {w ? `${w.weekday}, ${fmtDate(w)}` : " "}
              </div>
            </div>
            <div className="zrow-actions">
              {sides.length > 1 ? (
                <button
                  type="button"
                  className="btn btn-sm btn-icon"
                  aria-label={`Remove ${s.label}`}
                  disabled={!mounted}
                  onClick={() => persist(sides.filter((_, n) => n !== i))}
                >
                  ×
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </section>
  );
}

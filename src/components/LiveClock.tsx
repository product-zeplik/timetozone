"use client";

import { useEffect, useState } from "react";
import { fmtDate, fmtOffset, offsetMinutes, wallTime } from "@/engine/tz";
import { abbrFor } from "@/engine/side";

function clockWithSeconds(h: number, m: number, s: number, h12: boolean): string {
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  if (!h12) return `${String(h).padStart(2, "0")}:${mm}:${ss}`;
  const ap = h < 12 ? "AM" : "PM";
  const h12v = h % 12 === 0 ? 12 : h % 12;
  return `${h12v}:${mm}:${ss} ${ap}`;
}

/**
 * The big clock card. Renders `--:--:--` on the server (cached HTML must never
 * contain a clock time, docs/14 #4) and fills in after mount.
 */
export default function LiveClock({
  tz,
  label,
  sub,
  seconds = true,
}: {
  tz: string;
  label?: string;
  sub?: string;
  seconds?: boolean;
}) {
  const [now, setNow] = useState(0);
  const [h12, setH12] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem("ttz.h12") === "0") setH12(false);
    } catch {
      /* ignore */
    }
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const w = now ? wallTime(tz, now) : null;

  return (
    <div className="card bigclock">
      <span className="t" suppressHydrationWarning>
        {w ? clockWithSeconds(w.hour, w.minute, seconds ? w.second : 0, h12) : seconds ? "--:--:--" : "--:--"}
      </span>
      <div className="d" suppressHydrationWarning>
        {w ? `${w.weekday}, ${fmtDate(w, true)}` : " "}
        {label ? ` · ${label}` : ""}
      </div>
      <div className="z" suppressHydrationWarning>
        {w ? `${abbrFor(tz, now)} · ${fmtOffset(offsetMinutes(tz, now))} · ${tz}` : tz}
        {sub ? ` · ${sub}` : ""}
      </div>
    </div>
  );
}

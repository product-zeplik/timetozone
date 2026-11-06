"use client";

import { useEffect, useState } from "react";
import { fmtClock, wallTime } from "@/engine/tz";

/** A small live clock for table cells. `--:--` until mounted. */
export default function LiveTime({ tz, withDay = false }: { tz: string; withDay?: boolean }) {
  const [now, setNow] = useState(0);
  const [h12, setH12] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem("ttz.h12") === "0") setH12(false);
    } catch {
      /* ignore */
    }
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <span suppressHydrationWarning>--:--</span>;
  const w = wallTime(tz, now);
  return (
    <span suppressHydrationWarning>
      {fmtClock(w.hour, w.minute, h12)}
      {withDay ? ` ${w.weekday}` : ""}
    </span>
  );
}

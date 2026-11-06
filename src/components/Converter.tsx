"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ZoneSearch from "./ZoneSearch";
import { track } from "./track";
import { ZONE_BY_SLUG } from "@/data/zones";
import type { Side } from "@/engine/side";
import { abbrFor, sideAbbr, sideOffset } from "@/engine/side";
import {
  fmtClock,
  fmtDayDate,
  fmtOffsetShort,
  isoDate,
  localZone,
  parseIsoDate,
  parseTimeInput,
  wallFromFixed,
  wallTime,
} from "@/engine/tz";

const PLACEHOLDER = "--:--";

export interface ConverterProps {
  initial: Side[];
  reverseHref?: string | null;
  lockedMinutes?: number | null;
  validUntil?: number | null;
  allowAdd?: boolean;
  maxZones?: number;
  autoLocal?: boolean;
  heading?: string;
}

interface Anchor {
  year: number;
  month: number;
  day: number;
  minutes: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

function wallOf(side: Side, ms: number) {
  return side.fixed != null ? wallFromFixed(side.fixed, ms) : wallTime(side.tz, ms);
}

/** Instant for a wall time on a side, resolving DST gaps forward. */
function instantOf(side: Side, a: Anchor): number {
  const h = Math.floor(a.minutes / 60);
  const mi = a.minutes % 60;
  const asUtc = Date.UTC(a.year, a.month - 1, a.day, h, mi);
  if (side.fixed != null) return asUtc - side.fixed * 60_000;
  const DAY = 86_400_000;
  const cands: number[] = [];
  for (const off of new Set([
    sideOffset(side, asUtc - DAY),
    sideOffset(side, asUtc),
    sideOffset(side, asUtc + DAY),
  ])) {
    const t = asUtc - off * 60_000;
    if (sideOffset(side, t) === off && !cands.includes(t)) cands.push(t);
  }
  if (cands.length) return Math.min(...cands);
  return asUtc - Math.min(sideOffset(side, asUtc - DAY), sideOffset(side, asUtc + DAY)) * 60_000;
}

function localSide(): Side {
  const tz = localZone();
  const curated = [...ZONE_BY_SLUG.values()].find((z) => z.iana === tz && z.kind !== "generic");
  const city = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
  return {
    key: `local:${tz}`,
    kind: curated ? "zone" : "city",
    label: curated ? curated.abbr : city,
    long: curated ? curated.name : `Your time zone (${tz})`,
    tz,
    zoneSlug: curated?.slug,
  };
}

export default function Converter({
  initial,
  reverseHref,
  lockedMinutes = null,
  validUntil = null,
  allowAdd = true,
  maxZones = 6,
  autoLocal = false,
  heading,
}: ConverterProps) {
  const [mounted, setMounted] = useState(false);
  const [sides, setSides] = useState<Side[]>(initial);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [live, setLive] = useState(lockedMinutes == null);
  const [now, setNow] = useState(0);
  const [h12, setH12] = useState(true);
  const [timeText, setTimeText] = useState("");
  const [timeError, setTimeError] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ref = sides[0];

  /* ------------------------------------------------------------ mount */

  useEffect(() => {
    setMounted(true);
    const t = Date.now();
    setNow(t);

    try {
      const stored = localStorage.getItem("ttz.h12");
      if (stored === "0") setH12(false);
    } catch {
      /* private mode */
    }

    let list = initial;
    if (autoLocal) {
      const ls = localSide();
      if (!list.some((s) => s.tz === ls.tz)) list = [ls, ...list].slice(0, maxZones);
      setSides(list);
    }

    const params = new URLSearchParams(window.location.search);
    const qd = params.get("d");
    const qt = params.get("t");
    const base = wallOf(list[0], t);
    const date = (qd && parseIsoDate(qd)) || { year: base.year, month: base.month, day: base.day };
    if (lockedMinutes != null) {
      setAnchor({ ...date, minutes: lockedMinutes });
      setLive(false);
    } else if (qt) {
      const mins = parseTimeInput(qt);
      if (mins != null) {
        setAnchor({ ...date, minutes: mins });
        setLive(false);
      } else {
        setAnchor({ ...date, minutes: base.hour * 60 + base.minute });
      }
    } else {
      setAnchor({ ...date, minutes: base.hour * 60 + base.minute });
      if (qd) setLive(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------------- ticking */

  useEffect(() => {
    if (!mounted || !live) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [mounted, live]);

  useEffect(() => {
    if (!mounted || !live || !ref) return;
    const w = wallOf(ref, now);
    setAnchor({ year: w.year, month: w.month, day: w.day, minutes: w.hour * 60 + w.minute });
  }, [now, live, mounted, ref]);

  useEffect(() => {
    if (!mounted || !anchor) return;
    setTimeText(fmtClock(Math.floor(anchor.minutes / 60), anchor.minutes % 60, h12));
  }, [anchor, h12, mounted]);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  };

  /* ------------------------------------------------------------- derived */

  const instant = useMemo(() => {
    if (!mounted || !anchor || !ref) return 0;
    if (live) return now;
    return instantOf(ref, anchor);
  }, [mounted, anchor, ref, live, now]);

  const refWall = mounted && ref ? wallOf(ref, instant) : null;

  const rows = useMemo(() => {
    if (!mounted || !refWall) return [];
    return sides.map((s) => {
      const w = wallOf(s, instant);
      const dayDiff =
        Math.round(
          (Date.UTC(w.year, w.month - 1, w.day) - Date.UTC(refWall.year, refWall.month - 1, refWall.day)) / 86_400_000
        ) || 0;
      return {
        side: s,
        wall: w,
        abbr: sideAbbr(s, instant),
        offset: sideOffset(s, instant),
        dayDiff,
      };
    });
  }, [sides, instant, mounted, refWall]);

  /* ------------------------------------------------------------- actions */

  const setH12Persist = (v: boolean) => {
    setH12(v);
    try {
      localStorage.setItem("ttz.h12", v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const applyTime = useCallback(
    (text: string) => {
      setTimeText(text);
      const mins = parseTimeInput(text);
      if (mins == null) {
        setTimeError(true);
        return;
      }
      setTimeError(false);
      setLive(false);
      setAnchor((a) => (a ? { ...a, minutes: mins } : a));
      track("convert", { input: text });
    },
    []
  );

  const resetNow = () => {
    if (!ref) return;
    const t = Date.now();
    setNow(t);
    setLive(lockedMinutes == null);
    const w = wallOf(ref, t);
    setAnchor({
      year: w.year,
      month: w.month,
      day: w.day,
      minutes: lockedMinutes != null ? lockedMinutes : w.hour * 60 + w.minute,
    });
    setTimeError(false);
  };

  const makeReference = (i: number) => {
    if (i === 0) return;
    setSides((list) => {
      const next = [...list];
      const [picked] = next.splice(i, 1);
      next.unshift(picked);
      return next;
    });
    setLive(false);
  };

  const removeSide = (i: number) => {
    if (sides.length <= 2) return;
    setSides((list) => list.filter((_, n) => n !== i));
  };

  const addSide = (s: Side) => {
    setSides((list) => {
      if (list.length >= maxZones) return list;
      if (list.some((x) => x.key === s.key)) return list;
      return [...list, s];
    });
    track("add_zone", { zone: s.key });
  };

  const addMyZone = () => addSide(localSide());

  const asText = () =>
    rows
      .map(
        (r) =>
          `${fmtClock(r.wall.hour, r.wall.minute, h12)} ${r.abbr}${
            r.dayDiff ? ` (${r.dayDiff > 0 ? "next day" : "previous day"})` : ""
          }`
      )
      .join(" / ");

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(asText());
      showToast("Copied");
      track("copy");
    } catch {
      showToast("Copy failed");
    }
  };

  const shareLink = async () => {
    if (!anchor) return;
    const url = new URL(window.location.href);
    url.searchParams.set("t", `${pad(Math.floor(anchor.minutes / 60))}:${pad(anchor.minutes % 60)}`);
    url.searchParams.set("d", `${anchor.year}-${pad(anchor.month)}-${pad(anchor.day)}`);
    try {
      await navigator.clipboard.writeText(url.toString());
      showToast("Link copied");
      track("share");
    } catch {
      showToast(url.toString());
    }
  };

  const downloadIcs = () => {
    if (!anchor || !ref) return;
    const start = instantOf(ref, anchor);
    const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const summary = rows.map((r) => `${fmtClock(r.wall.hour, r.wall.minute, h12)} ${r.abbr}`).join(" / ");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//TimeToZone//Converter//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${start}-timetozone@timetozone.com`,
      `DTSTAMP:${stamp(Date.now())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(start + 3_600_000)}`,
      `SUMMARY:${summary.replace(/[,;]/g, "\\$&")}`,
      `DESCRIPTION:Created with TimeToZone`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "timetozone.ics";
    a.click();
    URL.revokeObjectURL(a.href);
    track("ics");
  };

  const stale = mounted && validUntil != null && now > validUntil;

  /* ---------------------------------------------------------------- render */

  const dateValue = anchor ? `${anchor.year}-${pad(anchor.month)}-${pad(anchor.day)}` : "";

  return (
    <section className="conv" aria-label={heading || "Time zone converter"}>
      <div className="conv-head">
        <div className="field">
          <label htmlFor="ttz-time">Time{ref ? ` in ${ref.label}` : ""}</label>
          <input
            id="ttz-time"
            className="time-in"
            type="text"
            inputMode="text"
            autoComplete="off"
            value={mounted ? timeText : ""}
            placeholder={PLACEHOLDER}
            aria-invalid={timeError || undefined}
            aria-describedby={timeError ? "ttz-time-err" : undefined}
            disabled={lockedMinutes != null}
            onChange={(e) => applyTime(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="ttz-date">Date</label>
          <input
            id="ttz-date"
            type="date"
            value={dateValue}
            onChange={(e) => {
              const d = parseIsoDate(e.target.value);
              if (!d) return;
              setLive(false);
              setAnchor((a) => ({ ...d, minutes: a ? a.minutes : 540 }));
              track("convert", { date: e.target.value });
            }}
          />
        </div>
        <button type="button" className="btn" onClick={resetNow}>
          Now
        </button>
        <div className="row" role="group" aria-label="Clock format">
          <button type="button" className="btn btn-sm" aria-pressed={h12} onClick={() => setH12Persist(true)}>
            12h
          </button>
          <button type="button" className="btn btn-sm" aria-pressed={!h12} onClick={() => setH12Persist(false)}>
            24h
          </button>
        </div>
        {reverseHref ? (
          <Link className="btn btn-sm" href={reverseHref} prefetch={false} onClick={() => track("swap")}>
            ⇄ Swap
          </Link>
        ) : null}
      </div>

      {timeError ? (
        <p className="note" id="ttz-time-err" role="alert">
          Try a time like <span className="mono">9am</span>, <span className="mono">9:30 pm</span>,{" "}
          <span className="mono">21:15</span> or <span className="mono">noon</span>.
        </p>
      ) : null}

      <div>
        {(mounted ? rows : sides.map((s) => ({ side: s, wall: null, abbr: "", offset: 0, dayDiff: 0 }))).map(
          (r, i) => (
            <div className={`zrow${i === 0 ? " is-ref" : ""}`} key={r.side.key + i}>
              <div className="zrow-main">
                <div className="zrow-name">
                  {r.side.href ? (
                    <Link href={r.side.href} prefetch={false}>
                      {r.side.label}
                    </Link>
                  ) : (
                    r.side.label
                  )}
                  {i === 0 ? <span className="zrow-ref-tag">from</span> : null}
                </div>
                <div className="zrow-sub" suppressHydrationWarning>
                  {r.wall
                    ? `${r.abbr} · UTC${fmtOffsetShort(r.offset)} · ${r.side.long}`
                    : r.side.long}
                </div>
              </div>
              <div className="zrow-time">
                <span className="zrow-clock" suppressHydrationWarning>
                  {r.wall ? fmtClock(r.wall.hour, r.wall.minute, h12) : PLACEHOLDER}
                </span>
                <div className="zrow-date" suppressHydrationWarning>
                  {r.wall ? (
                    <>
                      {fmtDayDate(r.wall)}
                      {r.dayDiff ? (
                        <>
                          {" "}
                          <span className="roll">{r.dayDiff > 0 ? "next day" : "previous day"}</span>
                        </>
                      ) : null}
                    </>
                  ) : (
                    " "
                  )}
                </div>
              </div>
              {mounted ? (
                <div className="zrow-actions">
                  {i > 0 ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-icon"
                      onClick={() => makeReference(i)}
                      title={`Convert from ${r.side.label}`}
                      aria-label={`Convert from ${r.side.label}`}
                    >
                      ↑
                    </button>
                  ) : null}
                  {sides.length > 2 ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-icon"
                      onClick={() => removeSide(i)}
                      title={`Remove ${r.side.label}`}
                      aria-label={`Remove ${r.side.label}`}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        )}
      </div>

      {mounted && lockedMinutes == null ? (
        <div className="slider-row">
          <label className="sr-only" htmlFor="ttz-slider">
            Adjust the time in 15-minute steps
          </label>
          <input
            id="ttz-slider"
            type="range"
            min={0}
            max={1425}
            step={15}
            value={anchor ? Math.round(anchor.minutes / 15) * 15 : 540}
            onChange={(e) => {
              const mins = Number(e.target.value);
              setLive(false);
              setAnchor((a) => (a ? { ...a, minutes: mins } : a));
            }}
          />
          <span className="slider-val" suppressHydrationWarning>
            {anchor ? fmtClock(Math.floor(anchor.minutes / 60), anchor.minutes % 60, h12) : PLACEHOLDER}
          </span>
        </div>
      ) : null}

      {mounted && allowAdd && sides.length < maxZones ? (
        <div className="conv-foot">
          <ZoneSearch onPick={addSide} />
          <button type="button" className="btn btn-sm" onClick={addMyZone}>
            + My time zone
          </button>
        </div>
      ) : null}

      <div className="conv-foot">
        <button type="button" className="btn btn-sm" onClick={copyText} disabled={!mounted}>
          Copy
        </button>
        <button type="button" className="btn btn-sm" onClick={shareLink} disabled={!mounted}>
          Share link
        </button>
        <button type="button" className="btn btn-sm" onClick={downloadIcs} disabled={!mounted}>
          Add to calendar
        </button>
        <span className="spacer" />
        {toast ? (
          <span className="small" role="status">
            {toast}
          </span>
        ) : null}
      </div>

      {stale ? (
        <p className="note">
          A daylight saving change has happened since this page was cached. The live clocks above are correct; the
          tables below refresh within a day.
        </p>
      ) : null}

      <noscript>
        <p className="note">
          JavaScript is off, so the live clocks are not running. The answer above and the 24-hour conversion table
          below are complete without it.
        </p>
      </noscript>
    </section>
  );
}

export { abbrFor };

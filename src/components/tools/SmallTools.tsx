"use client";

import { useEffect, useMemo, useState } from "react";
import { abbrFor } from "@/engine/side";
import {
  fmtClock,
  fmtDate,
  fmtDuration,
  fmtOffset,
  localZone,
  longZoneName,
  nextTransition,
  offsetMinutes,
  parseIsoDate,
  parseTimeInput,
  seasonalOffsets,
  wallTime,
  zonedToUtc,
} from "@/engine/tz";

const pad = (n: number) => String(n).padStart(2, "0");

/* ---------------------------------------------------- What time zone am I in */

export function MyZone() {
  const [now, setNow] = useState(0);
  const [tz, setTz] = useState("");

  useEffect(() => {
    setTz(localZone());
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!tz || !now) {
    return (
      <div className="card">
        <p className="lead" suppressHydrationWarning>
          Detecting your time zone…
        </p>
      </div>
    );
  }

  const w = wallTime(tz, now);
  const off = offsetMinutes(tz, now);
  const nt = nextTransition(tz, now);
  const s = seasonalOffsets(tz, w.year);

  const facts: [string, string][] = [
    ["Your local time", `${fmtClock(w.hour, w.minute)} · ${w.weekday}, ${fmtDate(w, true)}`],
    ["Time zone name", longZoneName(tz, now)],
    ["Abbreviation", abbrFor(tz, now)],
    ["UTC offset", fmtOffset(off)],
    ["IANA time zone id", tz],
    [
      "Daylight saving time",
      s.dst === null
        ? "Not observed in your zone"
        : nt
          ? `Next change ${fmtDate(wallTime(tz, nt.at - 60_000), true)} — clocks go ${
              nt.to > nt.from ? "forward" : "back"
            } one hour to ${abbrFor(tz, nt.at + 60_000)}`
          : "Observed",
    ],
  ];

  return (
    <>
      <div className="card bigclock">
        <span className="t" suppressHydrationWarning>
          {`${fmtClock(w.hour, w.minute).replace(/ (AM|PM)$/, "")}:${pad(w.second)}${fmtClock(w.hour, w.minute).slice(-3)}`}
        </span>
        <div className="d" suppressHydrationWarning>
          {abbrFor(tz, now)} · {fmtOffset(off)}
        </div>
        <div className="z" suppressHydrationWarning>
          {tz}
        </div>
      </div>
      <div className="tablewrap mt-4">
        <table className="tbl">
          <tbody>
            {facts.map(([k, v]) => (
              <tr key={k}>
                <th scope="row">{k}</th>
                <td className="wide" suppressHydrationWarning>
                  {v}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        This is read from your browser with <span className="mono">Intl.DateTimeFormat().resolvedOptions().timeZone</span>.
        It never asks for or uses your location, and nothing is sent to a server.
      </p>
    </>
  );
}

/* ------------------------------------------------------------ Military time */

export function MilitaryTime() {
  const [text, setText] = useState("1430");
  const mins = parseTimeInput(text);
  const ok = mins != null;
  const h = ok ? Math.floor(mins! / 60) : 0;
  const m = ok ? mins! % 60 : 0;
  const military = ok ? `${pad(h)}${pad(m)}` : "—";
  const spoken = ok
    ? h === 0 && m === 0
      ? "zero hundred hours (midnight)"
      : m === 0
        ? `${numberWords(h)} hundred hours`
        : `${numberWords(h)} ${pad(m)}`
    : "—";

  return (
    <div className="card">
      <div className="field">
        <label htmlFor="mil-in">Any time (9am, 2:30 pm, 1430, 14:30)</label>
        <input id="mil-in" className="time-in" type="text" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="tablewrap mt-4">
        <table className="tbl">
          <tbody>
            <tr>
              <th scope="row">Military / 24-hour</th>
              <td className="t">{military}</td>
            </tr>
            <tr>
              <th scope="row">24-hour clock</th>
              <td className="t">{ok ? fmtClock(h, m, false) : "—"}</td>
            </tr>
            <tr>
              <th scope="row">12-hour clock</th>
              <td className="t">{ok ? fmtClock(h, m, true) : "—"}</td>
            </tr>
            <tr>
              <th scope="row">Spoken as</th>
              <td className="wide">{spoken}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {!ok ? <p className="note">Enter a time like 0930, 9:30 am or 21:15.</p> : null}
    </div>
  );
}

function numberWords(h: number): string {
  const words = [
    "zero",
    "zero one",
    "zero two",
    "zero three",
    "zero four",
    "zero five",
    "zero six",
    "zero seven",
    "zero eight",
    "zero nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
    "twenty",
    "twenty one",
    "twenty two",
    "twenty three",
  ];
  return words[h] ?? String(h);
}

export function MilitaryChart() {
  return (
    <div className="tablewrap">
      <table className="tbl">
        <thead>
          <tr>
            <th scope="col">12-hour</th>
            <th scope="col">Military</th>
            <th scope="col">Spoken</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 24 }, (_, h) => (
            <tr key={h}>
              <td className="t">{fmtClock(h, 0, true)}</td>
              <td className="t">{pad(h)}00</td>
              <td className="wide">{h === 0 ? "zero hundred hours" : `${numberWords(h)} hundred hours`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ----------------------------------------------------------- Unix timestamp */

export function UnixConverter() {
  const [now, setNow] = useState(0);
  const [stamp, setStamp] = useState("");
  const [dt, setDt] = useState("");

  useEffect(() => {
    setNow(Date.now());
    const t = Date.now();
    setStamp(String(Math.floor(t / 1000)));
    const d = new Date(t);
    setDt(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const parsed = (() => {
    const n = Number(stamp.trim());
    if (!stamp.trim() || !Number.isFinite(n)) return null;
    // > 1e11 means milliseconds
    const ms = Math.abs(n) > 1e11 ? n : n * 1000;
    if (!Number.isFinite(ms) || Math.abs(ms) > 8.64e15) return null;
    return { ms, unit: Math.abs(n) > 1e11 ? "milliseconds" : "seconds" };
  })();

  const back = (() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(dt);
    if (!m) return null;
    const ms = new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5])
    ).getTime();
    return Number.isFinite(ms) ? ms : null;
  })();

  return (
    <div className="card">
      <p className="lead">
        Current Unix time:{" "}
        <strong className="mono" suppressHydrationWarning>
          {now ? Math.floor(now / 1000) : "----------"}
        </strong>{" "}
        seconds ·{" "}
        <span className="mono" suppressHydrationWarning>
          {now ? now : "-------------"}
        </span>{" "}
        milliseconds
      </p>

      <div className="field">
        <label htmlFor="unix-in">Timestamp → date</label>
        <input id="unix-in" type="text" className="mono" value={stamp} onChange={(e) => setStamp(e.target.value)} />
      </div>
      <div className="tablewrap my-3">
        <table className="tbl">
          <tbody>
            <tr>
              <th scope="row">Detected unit</th>
              <td>{parsed ? parsed.unit : "—"}</td>
            </tr>
            <tr>
              <th scope="row">UTC</th>
              <td className="t" suppressHydrationWarning>
                {parsed ? new Date(parsed.ms).toISOString().replace("T", " ").replace(".000Z", " UTC") : "—"}
              </td>
            </tr>
            <tr>
              <th scope="row">Your local time</th>
              <td className="t" suppressHydrationWarning>
                {parsed ? new Date(parsed.ms).toLocaleString() : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="field">
        <label htmlFor="unix-dt">Date → timestamp (your local time)</label>
        <input id="unix-dt" type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} />
      </div>
      <div className="tablewrap mt-3">
        <table className="tbl">
          <tbody>
            <tr>
              <th scope="row">Seconds</th>
              <td className="t">{back != null ? Math.floor(back / 1000) : "—"}</td>
            </tr>
            <tr>
              <th scope="row">Milliseconds</th>
              <td className="t">{back != null ? back : "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- Time calculator */

export function TimeCalculator() {
  const [a, setA] = useState("9:00 am");
  const [b, setB] = useState("5:30 pm");
  const [baseDate, setBaseDate] = useState("");
  const [baseTime, setBaseTime] = useState("09:00");
  const [addH, setAddH] = useState("3");
  const [addM, setAddM] = useState("30");
  const [sub, setSub] = useState(false);

  useEffect(() => {
    const d = new Date();
    setBaseDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  }, []);

  const ma = parseTimeInput(a);
  const mb = parseTimeInput(b);
  const duration = ma != null && mb != null ? ((mb - ma + 1440) % 1440) : null;

  const result = (() => {
    const d = parseIsoDate(baseDate);
    const t = parseTimeInput(baseTime);
    if (!d || t == null) return null;
    const delta = (Number(addH) || 0) * 60 + (Number(addM) || 0);
    const ms = Date.UTC(d.year, d.month - 1, d.day, Math.floor(t / 60), t % 60) + (sub ? -delta : delta) * 60_000;
    const w = wallTime("UTC", ms);
    return `${fmtClock(w.hour, w.minute)} · ${w.weekday}, ${fmtDate(w, true)}`;
  })();

  return (
    <>
      <div className="card">
        <h3 className="tight">Time between two times</h3>
        <div className="row">
          <div className="field">
            <label htmlFor="tc-a">From</label>
            <input id="tc-a" className="time-in" type="text" value={a} onChange={(e) => setA(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="tc-b">To</label>
            <input id="tc-b" className="time-in" type="text" value={b} onChange={(e) => setB(e.target.value)} />
          </div>
        </div>
        <p className="answer ans-tight">
          {duration == null ? "Enter two times, e.g. 9:00 am and 5:30 pm." : `${fmtDuration(duration)}`}
          {duration != null && mb! < ma! ? " (wrapping past midnight)" : ""}
        </p>
      </div>

      <div className="card">
        <h3 className="tight">Add or subtract time</h3>
        <div className="row">
          <div className="field">
            <label htmlFor="tc-date">Date</label>
            <input id="tc-date" type="date" value={baseDate} onChange={(e) => setBaseDate(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="tc-time">Time</label>
            <input id="tc-time" className="time-in" type="text" value={baseTime} onChange={(e) => setBaseTime(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="tc-h">Hours</label>
            <input id="tc-h" type="number" value={addH} min={0} className="w-90" onChange={(e) => setAddH(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="tc-m">Minutes</label>
            <input id="tc-m" type="number" value={addM} min={0} className="w-90" onChange={(e) => setAddM(e.target.value)} />
          </div>
          <div className="row" role="group" aria-label="Direction">
            <button type="button" className="btn btn-sm" aria-pressed={!sub} onClick={() => setSub(false)}>
              Add
            </button>
            <button type="button" className="btn btn-sm" aria-pressed={sub} onClick={() => setSub(true)}>
              Subtract
            </button>
          </div>
        </div>
        <p className="answer ans-tight" suppressHydrationWarning>
          {result ?? "Enter a date and time."}
        </p>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ Unit converter */

const UNITS: { key: string; label: string; ms: number }[] = [
  { key: "ms", label: "Milliseconds", ms: 1 },
  { key: "s", label: "Seconds", ms: 1000 },
  { key: "min", label: "Minutes", ms: 60_000 },
  { key: "h", label: "Hours", ms: 3_600_000 },
  { key: "day", label: "Days", ms: 86_400_000 },
  { key: "week", label: "Weeks", ms: 604_800_000 },
  { key: "month", label: "Months (30.44 days)", ms: 30.44 * 86_400_000 },
  { key: "year", label: "Years (365.24 days)", ms: 365.24 * 86_400_000 },
];

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n !== 0 && Math.abs(n) < 0.001) return n.toExponential(4);
  if (Math.abs(n) >= 1e15) return n.toExponential(4);
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export function UnitConverter() {
  const [value, setValue] = useState("90");
  const [unit, setUnit] = useState("min");

  const base = useMemo(() => {
    const n = Number(value);
    const u = UNITS.find((x) => x.key === unit)!;
    return Number.isFinite(n) ? n * u.ms : NaN;
  }, [value, unit]);

  const hms = (() => {
    if (!Number.isFinite(base)) return "—";
    const total = Math.round(Math.abs(base) / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${base < 0 ? "−" : ""}${h}:${pad(m)}:${pad(s)}`;
  })();

  return (
    <div className="card">
      <div className="row">
        <div className="field">
          <label htmlFor="uc-val">Value</label>
          <input id="uc-val" type="text" className="time-in" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="uc-unit">Unit</label>
          <select id="uc-unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {UNITS.map((u) => (
              <option key={u.key} value={u.key}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="tablewrap mt-4">
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col">Unit</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {UNITS.map((u) => (
              <tr key={u.key}>
                <th scope="row">{u.label}</th>
                <td className="t">{fmtNum(base / u.ms)}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">h:mm:ss</th>
              <td className="t">{hms}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { zonedToUtc };

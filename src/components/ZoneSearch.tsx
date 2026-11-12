"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ZONE_BY_SLUG } from "@/data/zones";
import type { Side } from "@/engine/side";

type Row = [string, string, string, string]; // key, label, sublabel, tz

let CACHE: Row[] | null = null;
let LOADING: Promise<Row[]> | null = null;

/** Fetch the index once, on first focus (~227 KB raw, ~50 KB gzipped). */
function load(): Promise<Row[]> {
  if (CACHE) return Promise.resolve(CACHE);
  if (!LOADING) {
    LOADING = fetch("/api/search")
      .then((r) => r.json())
      .then((rows: Row[]) => {
        CACHE = rows;
        return rows;
      })
      .catch(() => {
        LOADING = null;
        return [];
      });
  }
  return LOADING;
}

function score(q: string, row: Row): number {
  const label = row[1].toLowerCase();
  const sub = row[2].toLowerCase();
  let s = 0;
  if (label === q) s = 100;
  else if (label.startsWith(q)) s = 80;
  else if (label.includes(q)) s = 50;
  else if (sub.includes(q)) s = 20;
  else return 0;
  if (row[2] === "Time zone") s += 5;
  else if (row[2] === "Country") s += 3;
  return s;
}

export function rowToSide(row: Row): Side {
  const z = ZONE_BY_SLUG.get(row[0]);
  if (z) {
    return {
      key: z.slug,
      kind: "zone",
      label: z.abbr,
      long: z.name,
      tz: z.iana,
      zoneSlug: z.slug,
      href: `/zones/${z.slug}`,
    };
  }
  return { key: row[0], kind: "city", label: row[1], long: row[2] ? `${row[1]}, ${row[2]}` : row[1], tz: row[3] };
}

export default function ZoneSearch({
  onPick,
  placeholder = "Add a city or time zone",
  label = "Add a city or time zone",
}: {
  onPick: (side: Side) => void;
  placeholder?: string;
  label?: string;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  /**
   * The listbox is positioned `fixed` against the input's viewport rect rather
   * than absolutely inside `.search`. The converter card is `overflow: hidden`
   * (it clips its rows to the rounded corners), and the search sits on the card's
   * last row, so an absolutely positioned list was clipped to a few pixels and
   * looked like nothing had opened. `fixed` escapes the clip without the card
   * losing its corners. It also lets the list flip above the input when there is
   * no room below.
   */
  const [pos, setPos] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
    maxHeight: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const results = (() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2 || !ready) return [] as Row[];
    const scored: { r: Row; s: number }[] = [];
    for (const r of rows) {
      const s = score(needle, r);
      if (s > 0) scored.push({ r, s });
    }
    scored.sort((a, b) => b.s - a.s || a.r[1].length - b.r[1].length);
    return scored.slice(0, 8).map((x) => x.r);
  })();

  const show = open && results.length > 0;

  useEffect(() => {
    if (!show) {
      setPos(null);
      return;
    }
    const measure = () => {
      const el = inputRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const gap = 4;
      const edge = 8;
      const below = window.innerHeight - r.bottom - gap - edge;
      const above = r.top - gap - edge;
      const flip = below < 160 && above > below;
      setPos({
        left: r.left,
        width: r.width,
        ...(flip ? { bottom: window.innerHeight - r.top + gap } : { top: r.bottom + gap }),
        maxHeight: Math.max(120, Math.min(320, flip ? above : below)),
      });
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [show, results.length]);

  const pick = (row: Row) => {
    onPick(rowToSide(row));
    setQ("");
    setOpen(false);
    setActive(0);
  };

  return (
    <div className="search field" ref={boxRef}>
      <label htmlFor={`${listId}-in`}>{label}</label>
      <input
        ref={inputRef}
        id={`${listId}-in`}
        type="text"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results.length ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={q}
        onFocus={() => {
          load().then((r) => {
            setRows(r);
            setReady(true);
          });
          setOpen(true);
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            if (results[active]) {
              e.preventDefault();
              pick(results[active]);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {show && pos ? (
        <ul
          className="search-list"
          role="listbox"
          id={listId}
          aria-label="Search results"
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
        >
          {results.map((r, i) => (
            <li
              key={r[0]}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(r);
              }}
            >
              <span>{r[1]}</span>
              <span className="sub">{r[2]}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

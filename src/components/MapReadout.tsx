"use client";

import { useEffect, useRef, useState } from "react";
import { fmtOffset, offsetMinutes } from "@/engine/tz";

/**
 * Hover readout for the map.
 *
 * The map is an <object> holding a generated SVG, so hovering used to rely on
 * the SVG's own <title>: the browser's native tooltip, which waits about a
 * second, cannot be styled, never appears on touch, and in the embedded
 * document renders in the corner rather than by the pointer.
 *
 * The SVG is same-origin, so this attaches to its document directly and fills
 * a readout above the map. Because it runs on the client it can show the
 * *live* local time, which the cached SVG cannot: the clock would be stale the
 * moment the file was cached. The <title> elements stay in the SVG for the
 * no-JS and <img> fallbacks.
 */
export function MapReadout({ kind }: { kind: "country" | "state" }) {
  const [hit, setHit] = useState<{ name: string; tz?: string } | null>(null);
  const [, tick] = useState(0);
  const wrap = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const host = wrap.current?.closest(".mapwrap-outer");
    const obj = host?.querySelector("object");
    if (!obj) return;

    let doc: Document | null = null;
    const onOver = (e: Event) => {
      const el = (e.target as Element | null)?.closest?.("[data-name]");
      if (!el) return;
      setHit({
        name: el.getAttribute("data-name") ?? "",
        tz: el.getAttribute("data-tz") ?? undefined,
      });
    };
    const onLeave = () => setHit(null);

    const attach = () => {
      try {
        doc = obj.contentDocument;
      } catch {
        return; // cross-origin: keep the native title tooltip
      }
      if (!doc) return;
      doc.addEventListener("pointerover", onOver, true);
      doc.addEventListener("focusin", onOver, true);
      doc.addEventListener("pointerleave", onLeave, true);
    };

    if (obj.contentDocument?.readyState === "complete") attach();
    obj.addEventListener("load", attach);
    return () => {
      obj.removeEventListener("load", attach);
      doc?.removeEventListener("pointerover", onOver, true);
      doc?.removeEventListener("focusin", onOver, true);
      doc?.removeEventListener("pointerleave", onLeave, true);
    };
  }, []);

  let time = "";
  let offset = "";
  if (hit?.tz) {
    try {
      const now = Date.now();
      time = new Intl.DateTimeFormat("en-GB", {
        timeZone: hit.tz,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(now);
      offset = fmtOffset(offsetMinutes(hit.tz, now));
    } catch {
      time = "";
    }
  }

  return (
    <div className="mapreadout" ref={wrap} aria-live="polite">
      {hit ? (
        <>
          <strong>{hit.name}</strong>
          {time ? (
            <>
              <span className="mapreadout-time">{time}</span>
              <span className="mapreadout-off">{offset}</span>
            </>
          ) : (
            <span className="mapreadout-off">no time zone data</span>
          )}
        </>
      ) : (
        <span className="mapreadout-hint">
          Point at any {kind} for its name and current local time.
        </span>
      )}
    </div>
  );
}

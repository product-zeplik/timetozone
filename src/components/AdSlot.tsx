"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * One reserved ad slot. Renders nothing at all until AdSense is configured, so
 * the layout never shifts and no ad code ships before approval. docs/09 §9.3.
 */
export default function AdSlot({
  client,
  slot,
  lazy = true,
  format = "auto",
  label = "Advertisement",
}: {
  client: string;
  slot?: string;
  lazy?: boolean;
  format?: string;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [push, setPush] = useState(!lazy);
  const pushed = useRef(false);

  useEffect(() => {
    if (!client || !lazy || push) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setPush(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPush(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [client, lazy, push]);

  useEffect(() => {
    if (!client || !push || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* AdSense not ready */
    }
  }, [client, push]);

  if (!client) return null;

  return (
    <div className="ad" ref={ref} role="complementary" aria-label={label}>
      {push ? (
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client={client}
          data-ad-slot={slot}
          data-ad-format={format}
          data-full-width-responsive="true"
        />
      ) : null}
    </div>
  );
}

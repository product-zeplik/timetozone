import { ImageResponse } from "next/og";
import { SITE } from "@/site";

export const runtime = "nodejs";

const MARK = "M6 14H48V27H34V86H20V27H6Z";
const MARK2 = "M52 14H94V27H69L94 73V86H52V73H77L52 27Z";

export function GET(req: Request) {
  const url = new URL(req.url);
  const raw = (url.searchParams.get("t") || `${SITE.name} — ${SITE.descriptor}`).slice(0, 110);
  const text = raw.replace(/\s*\|\s*TimeToZone\s*$/, "");
  const size = text.length > 70 ? 54 : text.length > 46 ? 64 : 76;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="56" height="56" viewBox="0 0 100 100" fill="#080808">
            <path d={MARK} />
            <path d={MARK2} />
          </svg>
          <div style={{ fontSize: 40, fontWeight: 700, color: "#080808", letterSpacing: "-0.03em" }}>TimeToZone</div>
        </div>

        <div
          style={{
            fontSize: size,
            fontWeight: 700,
            color: "#080808",
            lineHeight: 1.12,
            letterSpacing: "-0.035em",
            display: "flex",
            maxWidth: 1040,
          }}
        >
          {text}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontSize: 28, color: "#5F6368" }}>Time, translated.</div>
          <div style={{ fontSize: 26, color: "#5F6368" }}>timetozone.com</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

import { NextResponse, type NextRequest } from "next/server";

/** Canonical hostname from SITE_URL, e.g. "timetozone.com". */
const CANONICAL_HOST = (() => {
  try {
    return new URL(process.env.SITE_URL || "https://timetozone.com").host.toLowerCase();
  } catch {
    return "";
  }
})();

/** Loopback: a local production build being audited, never a crawlable host. */
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0"]);

export const config = {
  // `.txt` is deliberately NOT excluded: the IndexNow key file is served from
  // this middleware, because a `/[key].txt` route would collide with `/[pair]`.
  matcher: ["/((?!_next/|api/|.*\\.(?:svg|png|ico|xml|webmanifest|js|css|json)$).*)"],
};

/**
 * 0. The IndexNow key file.
 * 1. Any uppercase path 301s to its lowercase form. The absolute URL is built
 *    from the forwarded host/proto, never req.nextUrl, or the redirect leaks
 *    `localhost:3000` from behind Railway (docs/14 #6).
 * 2. Off production, every response carries `X-Robots-Tag: noindex, nofollow`.
 * 3. So does any response served on a host other than the canonical one.
 *    Railway hands every service a `*.up.railway.app` name, and that name
 *    served the whole site with `robots: index, follow` and its own crawlable
 *    robots.txt, bypassing Cloudflare entirely. The canonical tag pointed at
 *    timetozone.com, but a canonical is a hint rather than a directive, so a
 *    second crawlable copy of 12,000 pages was one discovery away -- and
 *    `*.up.railway.app` names are published in certificate transparency logs.
 *    This marks any non-canonical host noindex. It deliberately does not
 *    redirect: if a proxy ever forwarded a different Host than expected, a
 *    host redirect would loop and take the site down, while a header cannot.
 */

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isProd = process.env.SITE_ENV === "production";

  // IndexNow key file, served here so it does not collide with /[pair].
  const key = process.env.INDEXNOW_KEY;
  if (key && pathname === `/${key}.txt`) {
    return new NextResponse(key, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" },
    });
  }

  if (/[A-Z]/.test(pathname)) {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
    const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    const target = `${proto}://${host}${pathname.toLowerCase()}${search}`;
    const res = NextResponse.redirect(target, 301);
    if (!isProd || isOffCanonicalHost(req)) res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  const res = NextResponse.next();
  if (!isProd || isOffCanonicalHost(req)) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

function isOffCanonicalHost(req: NextRequest): boolean {
  if (!CANONICAL_HOST) return false;
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").toLowerCase();
  // An unknown host is treated as canonical: better to index a page that
  // should not be than to hide the whole site because a header went missing.
  if (!host) return false;
  const name = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
  if (LOOPBACK.has(name)) return false;
  return name !== CANONICAL_HOST;
}

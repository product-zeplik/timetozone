import { NextResponse, type NextRequest } from "next/server";

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
    if (!isProd) res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  const res = NextResponse.next();
  if (!isProd) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

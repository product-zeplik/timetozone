# 12 — Deploy: Railway + Cloudflare

## 12.1 next.config.mjs
```js
const config = {
  output: "standalone", poweredByHeader: false, reactStrictMode: true, trailingSlash: false,
  eslint: { ignoreDuringBuilds: true },            // lint runs in CI separately
  cacheHandler: process.env.REDIS_URL ? new URL("./cache-handler.mjs", import.meta.url).pathname : undefined,
  cacheMaxMemorySize: process.env.REDIS_URL ? 0 : undefined,
  async headers() { return [
    { source: "/:path*", headers: [ {key:"X-Content-Type-Options",value:"nosniff"}, {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"}, {key:"Permissions-Policy",value:"geolocation=(), camera=(), microphone=()"} ] },
    { source: "/icon.svg", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
  ]; },
};
export default config;
```
Next sets `Cache-Control: s-maxage=86400, stale-while-revalidate` on ISR pages itself; don't override it.

## 12.2 cache-handler.mjs (shared ISR cache across replicas)
A class with `get(key)`, `set(key, data, ctx)` (store `{value, lastModified, tags}` with TTL = `revalidate × 7`, index keys by tag in a Redis set), `revalidateTag(tags)` (delete the keys in each tag set) and `resetRequestCache()`. Use the `redis@4` client, created lazily and connected once, with errors swallowed (fall through to a cache miss).

## 12.3 Dockerfile (multi-stage, node:22-alpine)
1. `deps`: copy package*.json, run `npm ci`.
2. `build`: copy the source; build args `SITE_URL, SITE_ENV, NEXT_PUBLIC_ADSENSE_CLIENT, NEXT_PUBLIC_GA_ID, NEXT_PUBLIC_CHROME_STORE_URL` become env; `RUN npm run build && npm test`.
3. `run`: `NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000`; copy `.next/standalone`, `.next/static`, `public` and `cache-handler.mjs`; `CMD ["node","server.js"]`.
`.dockerignore`: node_modules, .next, extension/dist, *.zip, .git.

## 12.4 railway.json (web service)
```json
{ "build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile" },
  "deploy": { "numReplicas": 2, "healthcheckPath": "/api/health", "healthcheckTimeout": 60, "restartPolicyType": "ON_FAILURE", "restartPolicyMaxRetries": 5 } }
```
Services: **web** (above), **redis** (Railway Redis plugin; expose `REDIS_URL` to web), **cron** (same repo, `cron/railway.json`: start `node scripts/dst-watch.mjs`, `cronSchedule "5 0 * * *"`, restart NEVER). Region: US-East first. Add EU-West when the UK/EU share passes 20%. Environments: `staging` (SITE_ENV=staging, staging.timetozone.com) and `production`.

## 12.5 Environment variables
| Var | Where | Value |
|---|---|---|
| `SITE_URL` | web (build + run) | `https://timetozone.com` |
| `SITE_ENV` | web | `production` only on prod; anything else → noindex + `Disallow: /` |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | web (build arg) | `ca-pub-…` once approved (empty = no ad code) |
| `NEXT_PUBLIC_GA_ID` | web (build arg) | `G-…` |
| `NEXT_PUBLIC_CHROME_STORE_URL` | web (build arg) | the Web Store URL |
| `REDIS_URL` | web | from the Redis plugin |
| `REVALIDATE_SECRET` | web + cron | a long random string |
| `CF_ZONE_ID`, `CF_API_TOKEN` | cron | Cloudflare zone + a token with Cache Purge permission |
`NEXT_PUBLIC_*` values are inlined at build time, so redeploy after changing them.

## 12.6 scripts/dst-watch.mjs (cron)
Check ~22 representative DST zones (NY, Chicago, Denver, LA, Anchorage, Halifax, St_Johns, London, Berlin, Athens, Lisbon, Sydney, Adelaide, Auckland, Santiago, Mexico_City, Tehran, Jerusalem, Cairo, Havana, Asuncion, Casablanca). If any `longOffset` differs between now and +48 h (or −24 h and now): POST `{all:true}` to `/api/revalidate` with header `x-revalidate-secret`, then POST Cloudflare `purge_cache {purge_everything:true}`. Log the result.
`/api/revalidate`: POST only, secret header required (403 otherwise). Body `{paths?: string[], all?: boolean}` → `revalidatePath(p)` or `revalidatePath("/", "layout")`.

## 12.7 Cloudflare
- DNS: `timetozone.com` CNAME to the Railway domain, proxied (orange cloud); SSL Full (strict); always HTTPS; redirect `www` → apex with a 301 rule.
- Cache Rules: "Cache Everything" for `hostname eq timetozone.com and not starts_with(http.request.uri.path, "/api/")`, **respect origin TTL** (Next's s-maxage). Bypass when the cookie contains `__session` (future-proofing). Cache `/_next/static/*` for 1 year.
- Disable Rocket Loader and Auto Minify JS (they break hydration). Enable Brotli, HTTP/3 and Early Hints.
- Don't block AI crawlers (Bot Fight Mode off for the verified bots listed in robots.txt).

## 12.8 Launch checklist
1. Staging deploy green: build + tests + SEO lint + smoke + Playwright.
2. Production deploy with `SITE_ENV=production`; check `/robots.txt` allows crawling and `/api/health` reports the tz version.
3. GSC + Bing: verify the domain, submit the 5 sitemaps, and request indexing for the home page and the top 20 pairs.
4. IndexNow key live, with a ping after each deploy.
5. Apply for AdSense once the trust pages are live; paste `ads.txt`; enable the EU consent message; set `NEXT_PUBLIC_ADSENSE_CLIENT` and redeploy.
6. Publish the Chrome extension; set `NEXT_PUBLIC_CHROME_STORE_URL`; redeploy.
7. Monitoring: Railway metrics + alerts, uptime checks on `/`, `/pst-to-est` and `/api/health`, weekly GSC review, and the monthly keyword-map update (`docs/07`).

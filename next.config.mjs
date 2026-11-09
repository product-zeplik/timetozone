/** @type {import('next').NextConfig} */
const config = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  trailingSlash: false,
  eslint: { ignoreDuringBuilds: true },
  cacheHandler: process.env.REDIS_URL ? new URL("./cache-handler.mjs", import.meta.url).pathname : undefined,
  cacheMaxMemorySize: process.env.REDIS_URL ? 0 : undefined,
  /**
   * Colloquial spellings of the daylight-saving slugs.
   *
   * CLAUDE.md rule 2: synonyms share a URL and spellings redirect. "Daylight
   * savings" is the spelling most people actually type -- it outweighs the
   * correct singular in the keyword map (422,000/mo for "daylight savings"
   * against 167,000 for "daylight saving time") -- but it was never a slug
   * here, so /daylight-savings-time was a hard 404 for anyone who typed or
   * linked the plural. Rule 6 says no soft-404s; a real 404 on the spelling
   * half the world uses is worse. These are 308s to the canonical singular,
   * so no second URL ever targets the same keyword.
   */
  async redirects() {
    const dst = "/daylight-saving-time";
    return [
      { source: "/daylight-savings-time", destination: dst, permanent: true },
      { source: "/daylight-savings", destination: dst, permanent: true },
      { source: "/daylight-savings-time/:country", destination: `${dst}/:country`, permanent: true },
      { source: "/daylight-savings/:country", destination: `${dst}/:country`, permanent: true },
      { source: "/dst", destination: dst, permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), camera=(), microphone=()" },
        ],
      },
      {
        source: "/icon.svg",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/brand/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default config;

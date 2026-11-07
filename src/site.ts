const rawUrl = process.env.SITE_URL || "https://timetozone.com";

export const SITE = {
  name: "TimeToZone",
  tagline: "Time, translated.",
  supporting: "From any time to any zone.",
  descriptor: "A fast, precise time zone converter.",
  url: rawUrl.replace(/\/+$/, ""),
  env: process.env.SITE_ENV || "development",
  isProduction: process.env.SITE_ENV === "production",
  adsenseClient: process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "",
  gaId: process.env.NEXT_PUBLIC_GA_ID || "",
  chromeStoreUrl: process.env.NEXT_PUBLIC_CHROME_STORE_URL || "",
  contactEmail: "hello@timetozone.com",
  // comma-separated: a property can be verified by more than one account
  googleVerification: (process.env.GOOGLE_SITE_VERIFICATION || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean),
  bingVerification: process.env.BING_SITE_VERIFICATION || "",
} as const;

export const abs = (path: string) => `${SITE.url}${path === "/" ? "" : path}`;

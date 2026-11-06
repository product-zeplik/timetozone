import { SITE } from "@/site";

/** Only rendered when the Chrome Web Store URL is configured. */
export function ExtensionCta() {
  if (!SITE.chromeStoreUrl) return null;
  return (
    <div className="cta">
      <p>
        <strong>Convert a time without leaving the page.</strong>{" "}
        <a href={SITE.chromeStoreUrl} rel="noopener">
          Get the TimeToZone Chrome extension
        </a>{" "}
        — a popup world clock plus a right-click “Convert ‘3pm EST’ to my time” action.
      </p>
    </div>
  );
}

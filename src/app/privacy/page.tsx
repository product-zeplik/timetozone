import type { Metadata } from "next";
import Link from "next/link";
import { Crumbs } from "@/components/Blocks";
import { pageMeta } from "@/seo/meta";
import { SITE } from "@/site";

export const revalidate = 86400;

const TITLE = "Privacy Policy – TimeToZone";
const DESCRIPTION =
  "What TimeToZone stores in your browser, what Google AdSense and Google Analytics collect, how to opt out of personalised ads, and the EEA/UK/Swiss consent choice.";

export const metadata: Metadata = pageMeta({ title: TITLE, description: DESCRIPTION, path: "/privacy" });

export default function PrivacyPage() {
  return (
    <>
      <Crumbs items={[{ name: "Home", path: "/" }, { name: "Privacy", path: "/privacy" }]} />
      <h1>Privacy Policy</h1>
      <p className="answer">
        TimeToZone has no accounts and never asks for your location. It does serve Google advertising and use
        analytics, both of which set cookies. This page explains exactly what that means and how to opt out.
      </p>
      <p className="small">Last updated: 7 November 2026.</p>

      <h2>What we do not collect</h2>
      <ul>
        <li>No user accounts, names, email addresses or passwords.</li>
        <li>No geographic location. The site never calls the browser Geolocation API.</li>
        <li>No conversions you perform are stored on a server.</li>
      </ul>
      <p>
        Your time zone is detected in your browser with the standard{" "}
        <span className="mono">Intl.DateTimeFormat().resolvedOptions().timeZone</span> API. That value stays on your
        device.
      </p>

      <h2>Data stored in your browser</h2>
      <p>
        TimeToZone uses your browser’s local storage for two preferences. This is not a cookie, is never transmitted,
        and is removed when you clear site data for this domain.
      </p>
      <ul>
        <li>
          <span className="mono">ttz.h12</span> — whether you prefer the 12-hour or 24-hour clock.
        </li>
        <li>
          <span className="mono">ttz.wc</span> — the list of cities you saved on the World Clock page.
        </li>
      </ul>

      <h2>Advertising: Google AdSense</h2>
      <p>
        TimeToZone is funded by advertising served by Google AdSense. Google and its advertising partners use cookies
        and similar technologies to serve and measure ads, and may serve personalised ads based on your prior visits
        to this and other websites.
      </p>
      <ul>
        <li>
          Google uses the <strong>DoubleClick / DSID and IDE cookies</strong> and similar identifiers for ad selection,
          delivery, reporting and frequency capping.
        </li>
        <li>
          You can opt out of personalised advertising at{" "}
          <a href="https://adssettings.google.com" rel="noopener nofollow">
            Google Ads Settings
          </a>
          , and from many other networks at{" "}
          <a href="https://optout.aboutads.info" rel="noopener nofollow">
            optout.aboutads.info
          </a>{" "}
          and{" "}
          <a href="https://optout.networkadvertising.org" rel="noopener nofollow">
            optout.networkadvertising.org
          </a>
          .
        </li>
        <li>
          Google’s own description of how it uses data from sites that use its services is at{" "}
          <a href="https://policies.google.com/technologies/partner-sites" rel="noopener nofollow">
            policies.google.com/technologies/partner-sites
          </a>
          .
        </li>
      </ul>

      <h2>Consent in the EEA, the UK and Switzerland</h2>
      <p>
        If you are in the European Economic Area, the United Kingdom or Switzerland, you are shown a consent message
        before any advertising or analytics cookie that requires consent is set, using a Google-certified consent
        management platform under the IAB Transparency and Consent Framework. You may accept, reject or manage
        individual purposes, and you can change your choice at any time through the “Privacy &amp; cookies” control in
        the consent message. Rejecting consent means you see non-personalised advertising instead; the site itself
        works identically.
      </p>

      <h2>Analytics: Google Analytics 4</h2>
      <p>
        When configured, TimeToZone uses Google Analytics 4 to count page views and a small number of interaction
        events (a conversion performed, a zone added, a link copied or shared, a calendar file downloaded). IP
        addresses are anonymised by Google before storage and we never attempt to identify an individual visitor. The
        analytics script is loaded only after consent where consent is required.
      </p>

      <h2>Server logs and hosting</h2>
      <p>
        The site is served from Railway behind the Cloudflare content delivery network. Both keep short-lived
        operational logs containing the requested URL, HTTP status, user agent and IP address, used for security,
        abuse prevention and debugging, and retained only as long as needed for those purposes.
      </p>

      <h2>Chrome extension</h2>
      <p>
        The TimeToZone Chrome extension performs all conversion locally and collects no data. Your pinned zones and
        clock format are stored in Chrome’s own sync storage so they follow your Chrome profile; they are never sent
        to us.
      </p>

      <h2>Children</h2>
      <p>
        TimeToZone is a general-audience utility and is not directed to children under 13. We do not knowingly collect
        personal information from children.
      </p>

      <h2>Your rights</h2>
      <p>
        Because we hold no personal profiles there is nothing for us to export or erase. For the data Google processes
        as a controller, use Google’s own{" "}
        <a href="https://myaccount.google.com/data-and-privacy" rel="noopener nofollow">
          data and privacy controls
        </a>
        . If you believe this policy is incomplete or incorrect, write to us at{" "}
        <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
      </p>

      <h2>Changes</h2>
      <p>
        Material changes to this policy will be reflected in the “last updated” date above. Continued use of the site
        after a change means you accept the updated policy.
      </p>

      <p className="small">
        See also the{" "}
        <Link href="/terms" prefetch={false}>
          terms of use
        </Link>
        .
      </p>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Crumbs } from "@/components/Blocks";
import { pageMeta } from "@/seo/meta";
import { SITE } from "@/site";
import { BUILD_META, COUNTRIES, PLACES } from "@/engine/entities";

export const revalidate = 86400;

const TITLE = "About TimeToZone";
const DESCRIPTION =
  "TimeToZone is a conversion-first time zone utility: every offset, daylight saving date and conversion is computed from the IANA time zone database at render time.";

export const metadata: Metadata = pageMeta({ title: TITLE, description: DESCRIPTION, path: "/about" });

export default function AboutPage() {
  return (
    <>
      <Crumbs items={[{ name: "Home", path: "/" }, { name: "About", path: "/about" }]} />
      <h1>About TimeToZone</h1>
      <p className="answer">
        TimeToZone converts a time from any zone to any other zone, correctly, on any date. {SITE.tagline}
      </p>

      <h2>What this site does</h2>
      <p>
        TimeToZone answers one kind of question: what is this time, over there? It covers all {COUNTRIES.length}{" "}
        countries and territories, {PLACES.length.toLocaleString("en-US")} cities with a population over 100,000, every
        US state, Canadian province and Australian state, and the 62 time zone abbreviations people actually search
        for. Any entity can be converted to any other.
      </p>

      <h2>How the numbers are produced</h2>
      <p>
        Every offset, abbreviation, daylight saving date and converted time is computed at render time from the{" "}
        <a href="https://www.iana.org/time-zones" rel="noopener nofollow">
          IANA time zone database
        </a>{" "}
        that ships with the platform runtime. Nothing is hard-coded. There is no stored table of “EST = UTC−5” and no
        list of daylight saving dates that goes stale next spring, which is why the site stays correct through the
        weeks when the United States has changed its clocks and Europe has not.
      </p>
      <p>
        The conversion engine is a small, dependency-free module tested against the platform’s own{" "}
        <span className="mono">toLocaleString</span> for every pair of the 30 most-used zones at both sides of every
        transition in the year. It is the same code on the website and in the Chrome extension.
      </p>

      <h2>Design principles</h2>
      <ul>
        <li>
          <strong>Answer first.</strong> The first sentence after the heading contains the numbers you came for.
        </li>
        <li>
          <strong>Direction is explicit.</strong> Source and destination are never ambiguous, and a next-day or
          previous-day rollover is always shown.
        </li>
        <li>
          <strong>DST is explained</strong> when, and only when, it changes the result.
        </li>
        <li>
          <strong>It works without JavaScript.</strong> The answer, the 24-hour table and the FAQ are in the HTML.
        </li>
        <li>
          <strong>No scope creep.</strong> No weather, no holidays, no calendars of events, no accounts.
        </li>
      </ul>

      <h2>Privacy</h2>
      <p>
        Your time zone is read from your browser with the standard{" "}
        <span className="mono">Intl.DateTimeFormat().resolvedOptions().timeZone</span> API. TimeToZone never asks for
        or uses your geographic location. See the{" "}
        <Link href="/privacy" prefetch={false}>
          privacy policy
        </Link>{" "}
        for what is collected by analytics and advertising.
      </p>

      <h2>Data version</h2>
      <p className="mono small">
        tzdata {BUILD_META.tzdata} · Node {BUILD_META.node} · data built {BUILD_META.builtAt.slice(0, 10)}
      </p>

      <h2>Contact</h2>
      <p>
        Corrections and questions:{" "}
        <Link href="/contact" prefetch={false}>
          contact page
        </Link>
        . If you find a conversion that is wrong, please tell us the two zones and the date — that is enough to
        reproduce it.
      </p>
    </>
  );
}

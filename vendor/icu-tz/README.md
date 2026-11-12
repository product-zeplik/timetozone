# vendor/icu-tz — the time zone database we actually serve

Node resolves every offset and DST rule from the tzdata compiled into its
bundled ICU, so the rules only move when Node cuts a release. That is a real
correctness problem for this site: on 2026-11-12 production ran Node's
tzdata 2026e while IANA had shipped 2026f, and every page for Cuba stated
UTC−5 for a country that was on UTC−4. Fifteen pages, wrong by an hour, with
nothing failing.

ICU reads these four files from `ICU_TIMEZONE_FILES_DIR` in preference to its
built-in copy. Vendoring them pins the time data to the repo instead of to the
runtime, and makes the build hermetic.

- Source: https://github.com/unicode-org/icu-data `tzdata/icunew/<release>/44/le`
- Current release: see `VERSION`
- ICU data format `44`, little-endian — matches Node 22 (ICU 78.x)

## Updating

```
npm run tzdata:update          # to IANA's current release
npm run tzdata:update 2026f    # or pin one
```

The script refuses a truncated download and verifies that Node actually loads
the release before it writes, so a half-applied update cannot ship.

`scripts/dst-watch.mjs` compares what we serve against
`https://data.iana.org/time-zones/tzdb/version` every 15 minutes and warns in
the Railway logs when a new release lands. That warning is the signal to run
the update and deploy.

Wired in at: `Dockerfile` (build **and** run stages — static generation bakes
offsets into the HTML), `cron/Dockerfile`, and `scripts/with-tzdata.mjs` for
local builds, tests and `npm run dev`.

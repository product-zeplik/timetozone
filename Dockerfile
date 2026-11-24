# syntax=docker/dockerfile:1
# TimeToZone — Railway (Docker) behind Cloudflare. docs/12 §12.3.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# @zeplik/* install from tarballs (file: specs), so they must be in place before npm ci.
COPY vendor/zeplik ./vendor/zeplik
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ARG SITE_URL=https://timetozone.com
ARG SITE_ENV=production
ARG NEXT_PUBLIC_ADSENSE_CLIENT=
ARG NEXT_PUBLIC_GA_ID=
ARG NEXT_PUBLIC_CHROME_STORE_URL=
# PostHog (shared Zeplik Portfolio project). NEXT_PUBLIC_* is inlined into the
# client bundle by `next build`, so it has to be here, not only at runtime.
ARG NEXT_PUBLIC_POSTHOG_KEY=
ARG NEXT_PUBLIC_POSTHOG_HOST=
ARG NEXT_PUBLIC_POSTHOG_PRODUCT=
# Read at module scope in src/site.ts, so they must exist at build time for the
# statically generated pages to carry the tags.
ARG GOOGLE_SITE_VERIFICATION=
ARG BING_SITE_VERIFICATION=
ARG INDEXNOW_KEY=
# Railway-provided, declared so the build can see them (scripts/build-id.mjs:
# build id from the commit, as .git is not in the context; scripts/static-carry.mjs:
# only the production build reads the live site's chunk index).
ARG RAILWAY_GIT_COMMIT_SHA=
ARG RAILWAY_ENVIRONMENT_NAME=
ENV SITE_URL=$SITE_URL \
    SITE_ENV=$SITE_ENV \
    NEXT_PUBLIC_ADSENSE_CLIENT=$NEXT_PUBLIC_ADSENSE_CLIENT \
    NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID \
    NEXT_PUBLIC_CHROME_STORE_URL=$NEXT_PUBLIC_CHROME_STORE_URL \
    NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY \
    NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST \
    NEXT_PUBLIC_POSTHOG_PRODUCT=$NEXT_PUBLIC_POSTHOG_PRODUCT \
    GOOGLE_SITE_VERIFICATION=$GOOGLE_SITE_VERIFICATION \
    BING_SITE_VERIFICATION=$BING_SITE_VERIFICATION \
    INDEXNOW_KEY=$INDEXNOW_KEY \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Static generation bakes UTC offsets into the HTML, so the build must read the
# same tzdata the server will. vendor/icu-tz overrides the copy inside Node's
# bundled ICU, which otherwise only moves when Node cuts a release.
ENV ICU_TIMEZONE_FILES_DIR=/app/vendor/icu-tz
RUN node -e "if(process.versions.tz!==require('fs').readFileSync('vendor/icu-tz/VERSION','utf8').trim())throw new Error('tzdata override not loaded: '+process.versions.tz)" \
 && npm run build && npm test && npm run seo:lint
# Deploy skew (scripts/static-carry.mjs): add the chunks `next build` carried
# from earlier deploys to the standalone tree, beside (never over) this build's,
# and write public/static-assets.json there for the next build to read. Never
# fails the image: without it the site still serves its own build.
RUN node scripts/static-carry.mjs merge .next/standalone \
 || echo "WARNING: static-carry merge failed; earlier deploys' chunks are not served"

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1 \
    ICU_TIMEZONE_FILES_DIR=/app/vendor/icu-tz
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
# The standalone tree first: it holds the carried chunks in .next/static and
# public/static-assets.json. This build's own static and public merge over it.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/cache-handler.mjs ./cache-handler.mjs
COPY --from=build --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=build --chown=nextjs:nodejs /app/vendor/icu-tz ./vendor/icu-tz
USER nextjs
EXPOSE 3000
CMD ["node", "scripts/serve.mjs"]

# syntax=docker/dockerfile:1
# TimeToZone — Railway (Docker) behind Cloudflare. docs/12 §12.3.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ARG SITE_URL=https://timetozone.com
ARG SITE_ENV=production
ARG NEXT_PUBLIC_ADSENSE_CLIENT=
ARG NEXT_PUBLIC_GA_ID=
ARG NEXT_PUBLIC_CHROME_STORE_URL=
# Read at module scope in src/site.ts, so they must exist at build time for the
# statically generated pages to carry the tags.
ARG GOOGLE_SITE_VERIFICATION=
ARG BING_SITE_VERIFICATION=
ARG INDEXNOW_KEY=
ENV SITE_URL=$SITE_URL \
    SITE_ENV=$SITE_ENV \
    NEXT_PUBLIC_ADSENSE_CLIENT=$NEXT_PUBLIC_ADSENSE_CLIENT \
    NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID \
    NEXT_PUBLIC_CHROME_STORE_URL=$NEXT_PUBLIC_CHROME_STORE_URL \
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

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1 \
    ICU_TIMEZONE_FILES_DIR=/app/vendor/icu-tz
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/cache-handler.mjs ./cache-handler.mjs
COPY --from=build --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=build --chown=nextjs:nodejs /app/vendor/icu-tz ./vendor/icu-tz
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

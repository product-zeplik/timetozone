# The DST watcher needs nothing but Node's built-ins and its own tzdata, so it
# gets a tiny image instead of rebuilding the 2,375-page site. docs/12 §12.4.
FROM node:22-alpine
WORKDIR /app
COPY scripts/dst-watch.mjs scripts/indexnow.mjs ./scripts/
# The watcher compares offsets, so it must read the same tzdata the site serves.
COPY vendor/icu-tz ./vendor/icu-tz
ENV ICU_TIMEZONE_FILES_DIR=/app/vendor/icu-tz
RUN addgroup -g 1001 -S nodejs && adduser -S cron -u 1001 && chown -R cron:nodejs /app
USER cron
CMD ["node", "scripts/dst-watch.mjs"]

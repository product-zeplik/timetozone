/**
 * Redis-backed ISR cache so the Railway replicas share one cache.
 * Enabled only when REDIS_URL is set (see next.config.mjs). docs/12 §12.2.
 */
import { createClient } from "redis";
import { readFileSync } from "node:fs";

/**
 * The cache is namespaced by build, because it outlives the deploy that filled
 * it. Entries are kept for revalidate*7 (a week), so with one fixed prefix a
 * deploy that corrected a page went on serving the old one until something
 * revalidated it: Cuba stayed an hour wrong, and "behind of" stayed on every
 * pair page, through a successful deploy that had fixed both. Keying on the
 * build id means a new deploy simply cannot read the previous build's HTML.
 * Old keys fall out on their own TTL.
 */
const BUILD = (() => {
  for (const f of [".next/BUILD_ID", "./BUILD_ID"]) {
    try {
      const id = readFileSync(f, "utf8").trim();
      if (id) return id;
    } catch {
      /* try the next location */
    }
  }
  return process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 12) || "dev";
})();

const PREFIX = `ttz:isr:${BUILD}:`;
const TAG_PREFIX = `ttz:tag:${BUILD}:`;

let client = null;
let connecting = null;

async function redis() {
  if (client?.isOpen) return client;
  if (!process.env.REDIS_URL) return null;
  if (!connecting) {
    client = createClient({ url: process.env.REDIS_URL, socket: { reconnectStrategy: (n) => Math.min(n * 200, 3000) } });
    client.on("error", () => {});
    connecting = client.connect().catch(() => {
      connecting = null;
      return null;
    });
  }
  await connecting;
  return client?.isOpen ? client : null;
}

export default class CacheHandler {
  constructor(options) {
    this.options = options;
  }

  async get(key) {
    try {
      const c = await redis();
      if (!c) return null;
      const raw = await c.get(PREFIX + key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async set(key, data, ctx = {}) {
    try {
      const c = await redis();
      if (!c) return;
      const revalidate = typeof ctx.revalidate === "number" ? ctx.revalidate : 86400;
      const ttl = Math.max(60, revalidate * 7);
      const tags = ctx.tags ?? [];
      const payload = JSON.stringify({ value: data, lastModified: Date.now(), tags });
      await c.set(PREFIX + key, payload, { EX: ttl });
      for (const tag of tags) {
        await c.sAdd(TAG_PREFIX + tag, key);
        await c.expire(TAG_PREFIX + tag, ttl);
      }
    } catch {
      /* cache miss on failure */
    }
  }

  async revalidateTag(tags) {
    const list = Array.isArray(tags) ? tags : [tags];
    try {
      const c = await redis();
      if (!c) return;
      for (const tag of list) {
        const keys = await c.sMembers(TAG_PREFIX + tag);
        if (keys.length) await c.del(keys.map((k) => PREFIX + k));
        await c.del(TAG_PREFIX + tag);
      }
    } catch {
      /* ignore */
    }
  }

  resetRequestCache() {}
}

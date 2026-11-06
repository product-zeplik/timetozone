/**
 * Redis-backed ISR cache so the Railway replicas share one cache.
 * Enabled only when REDIS_URL is set (see next.config.mjs). docs/12 §12.2.
 */
import { createClient } from "redis";

const PREFIX = "ttz:isr:";
const TAG_PREFIX = "ttz:tag:";

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
